/**
 * apps/mobile/app/(tabs)/history/index.tsx -- History tab (HOME-05/HOME-06, D-25..D-29)
 *
 * The true day-grouped training ledger: date + day HSS + session count, month-grouped with
 * sticky headers, REST days rendered as explicit rows, an accordion per day revealing its
 * individual sessions (honest "DAY TOTAL X · INCL. +Y DOUBLE-DAY LOAD" math on multi-session
 * days), and swipe-to-delete on session sub-rows.
 *
 * Data sources (never re-summed locally): `load_daily.dayHss` is the persisted, authoritative
 * per-day total (double-penalty already applied by `recomputeLoadDaily`); `sessionCountsByDate`
 * feeds the multi-session chip; `dayGroupedSessions` feeds the per-day accordion rows. Because
 * `computeLoadDailyUpsertRows` already gap-fills a calendar-contiguous `load_daily` row for
 * every day from the athlete's first-ever session through whatever "today" was at the last
 * recompute, REST days mostly fall out of that table for free -- the one gap this screen must
 * bridge itself (via `addDaysLocal`) is between that last-recomputed date and the ACTUAL
 * current calendar day (e.g. the athlete hasn't logged anything in a few days), so those days
 * still render as REST rather than silently vanishing (D-27).
 *
 * Every `load_daily`/`workout` read here uses `useFocusEffect` (never a bare `useEffect`,
 * Pitfall 5/STATE.md Phase 3 P10 lesson) so a stacked-screen focus regain (e.g. returning from
 * session/detail) can't resurrect stale state.
 *
 * Pagination: the full `load_daily`/session dataset is read in one focus-triggered query (same
 * "read everything, do the work in-memory" discipline `recomputeLoadDaily` already uses at
 * full-history scope) and windowed client-side -- the most recent ~30 days render immediately;
 * scrolling near the bottom grows the visible window in ~30-day slices (D-28's "older months
 * fetch on scroll-near-bottom" contract, backed by an in-memory slice rather than a second SQL
 * round-trip, since a single-user local dataset is small enough for this to be instant).
 */

import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, SectionList, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { db, dayGroupedSessions, loadDaily, sessionCountsByDate } from '@apsis/db';

import { DayRow, type DaySession } from '../../../components/history/DayRow';
import { ScreenHeader } from '../../../components/ScreenHeader';
import Colors from '../../../constants/Colors';
import { HIT_TARGET_MIN, Kicker, Radius, Spacing, Typography } from '../../../constants/theme';
import { discardWorkout } from '../../../lib/finishWorkout';
import { addDaysLocal, todayLocalDate } from '../../../lib/localDate';

const MONTH_NAMES = [
  'JANUARY',
  'FEBRUARY',
  'MARCH',
  'APRIL',
  'MAY',
  'JUNE',
  'JULY',
  'AUGUST',
  'SEPTEMBER',
  'OCTOBER',
  'NOVEMBER',
  'DECEMBER',
];

const INITIAL_WINDOW_DAYS = 30;
const LOAD_MORE_WINDOW_DAYS = 30;
const LOAD_ERROR_MESSAGE = "Couldn't load your history. Pull down to try again.";
const DELETE_CONFIRM_MESSAGE =
  "Delete this session? Its HSS will be removed from your training load and can't be recovered.";

interface HistoryDayEntry {
  localDate: string;
  dayHss: number;
  sessionCount: number;
  sessions: DaySession[];
}

interface HistorySection {
  key: string;
  title: string;
  data: HistoryDayEntry[];
}

function monthLabel(localDate: string): string {
  const [year, month] = localDate.split('-').map((part) => Number.parseInt(part, 10));
  return `${MONTH_NAMES[(month ?? 1) - 1]} ${year}`;
}

function monthKey(localDate: string): string {
  return localDate.slice(0, 7);
}

export default function HistoryScreen(): React.JSX.Element {
  const router = useRouter();
  const [allDays, setAllDays] = useState<HistoryDayEntry[]>([]);
  const [windowDays, setWindowDays] = useState(INITIAL_WINDOW_DAYS);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [expandedDate, setExpandedDate] = useState<string | null>(null);
  const [pendingDeleteWorkoutId, setPendingDeleteWorkoutId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const loadHistory = useCallback(async () => {
    try {
      setErrorMessage(null);
      const [dailyRows, counts, sessions] = await Promise.all([
        db.select().from(loadDaily),
        sessionCountsByDate(db),
        dayGroupedSessions(db),
      ]);

      if (dailyRows.length === 0 && sessions.length === 0) {
        setAllDays([]);
        setLoading(false);
        return;
      }

      const dayHssByDate = new Map<string, number>(dailyRows.map((row) => [row.localDate, row.dayHss ?? 0]));
      const countByDate = new Map<string, number>(counts.map((row) => [row.localDate, row.sessionCount]));
      const sessionsByDate = new Map<string, DaySession[]>();
      for (const s of sessions) {
        const list = sessionsByDate.get(s.localDate) ?? [];
        list.push({ id: s.id, type: s.type, title: s.title, hss: s.hss ?? 0 });
        sessionsByDate.set(s.localDate, list);
      }

      // When load_daily hasn't been recomputed yet, dayHssByDate can be empty even though
      // finished sessions exist -- fall back to session dates so History never drops them
      // behind a false "No sessions yet" empty state (dayHss defaults to 0 via the ?? below).
      const knownDates = new Set<string>([...dayHssByDate.keys(), ...sessionsByDate.keys()]);
      const sortedDates = [...knownDates].sort();
      const lastComputedDate = sortedDates[sortedDates.length - 1]!;
      const today = todayLocalDate();

      // Bridge any gap between the last recompute's "today" boundary and the actual current
      // calendar day -- those days must still render as explicit REST rows, not vanish.
      const bridgeDates: string[] = [];
      let cursor = lastComputedDate;
      while (cursor < today) {
        cursor = addDaysLocal(cursor, 1);
        bridgeDates.push(cursor);
      }

      const allDatesAscending = [...sortedDates, ...bridgeDates];

      const entries: HistoryDayEntry[] = allDatesAscending
        .map((localDate) => ({
          localDate,
          dayHss: dayHssByDate.get(localDate) ?? 0,
          sessionCount: countByDate.get(localDate) ?? 0,
          sessions: sessionsByDate.get(localDate) ?? [],
        }))
        .reverse(); // most recent first

      setAllDays(entries);
      setLoading(false);
    } catch (err: unknown) {
      console.error('[Apsis] History load failed:', err);
      setErrorMessage(LOAD_ERROR_MESSAGE);
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadHistory();
    }, [loadHistory])
  );

  const sections = useMemo<HistorySection[]>(() => {
    const visible = allDays.slice(0, windowDays);
    const map = new Map<string, HistorySection>();
    const order: string[] = [];
    for (const day of visible) {
      const key = monthKey(day.localDate);
      let section = map.get(key);
      if (!section) {
        section = { key, title: monthLabel(day.localDate), data: [] };
        map.set(key, section);
        order.push(key);
      }
      section.data.push(day);
    }
    return order.map((key) => map.get(key)!);
  }, [allDays, windowDays]);

  function handleEndReached(): void {
    setWindowDays((w) => (w >= allDays.length ? w : Math.min(w + LOAD_MORE_WINDOW_DAYS, allDays.length)));
  }

  function handleToggleExpand(localDate: string): void {
    setExpandedDate((prev) => (prev === localDate ? null : localDate));
  }

  function handleSelectSession(workoutId: string): void {
    router.push({ pathname: '/session/detail', params: { workoutId } });
  }

  async function handleConfirmDelete(): Promise<void> {
    if (!pendingDeleteWorkoutId || busy) return;
    setBusy(true);
    try {
      await discardWorkout(db, pendingDeleteWorkoutId, new Date());
    } catch (err: unknown) {
      console.error('[Apsis] History swipe-delete failed:', err);
    } finally {
      setBusy(false);
    }
    setPendingDeleteWorkoutId(null);
    await loadHistory();
  }

  const listHeader = (
    <View style={styles.screenHeader}>
      <ScreenHeader kicker="LEDGER" title="History" />
      {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}
    </View>
  );

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <SectionList
        sections={sections}
        keyExtractor={(item) => item.localDate}
        renderItem={({ item }) => (
          <DayRow
            localDate={item.localDate}
            dayHss={item.dayHss}
            sessionCount={item.sessionCount}
            sessions={item.sessions}
            expanded={expandedDate === item.localDate}
            onToggleExpand={() => handleToggleExpand(item.localDate)}
            onSelectSession={handleSelectSession}
            onRequestDeleteSession={setPendingDeleteWorkoutId}
          />
        )}
        renderSectionHeader={({ section }) => (
          <View style={styles.monthHeader}>
            <Text style={styles.monthHeaderLabel}>{section.title}</Text>
          </View>
        )}
        stickySectionHeadersEnabled
        onEndReached={handleEndReached}
        onEndReachedThreshold={0.5}
        ListHeaderComponent={listHeader}
        ListEmptyComponent={
          !loading && !errorMessage ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyHeading}>No sessions yet</Text>
              <Text style={styles.emptyBody}>Log a lift or a run and it&apos;ll show up here.</Text>
            </View>
          ) : null
        }
        ListFooterComponent={
          windowDays < allDays.length ? (
            <View style={styles.footerLoading}>
              <ActivityIndicator color={Colors.dark.mutedText} />
            </View>
          ) : null
        }
        contentContainerStyle={styles.listContent}
      />

      {loading ? (
        <View style={styles.loadingOverlay} pointerEvents="none">
          <ActivityIndicator color={Colors.dark.accent} />
        </View>
      ) : null}

      <Modal
        visible={pendingDeleteWorkoutId != null}
        transparent
        animationType="fade"
        onRequestClose={() => setPendingDeleteWorkoutId(null)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalMessage}>{DELETE_CONFIRM_MESSAGE}</Text>
            <View style={styles.modalButtonColumn}>
              <Pressable
                onPress={() => setPendingDeleteWorkoutId(null)}
                disabled={busy}
                accessibilityRole="button"
                accessibilityLabel="Keep"
                style={styles.modalSecondaryButton}>
                <Text style={styles.modalSecondaryLabel}>Keep</Text>
              </Pressable>
              <Pressable
                onPress={handleConfirmDelete}
                disabled={busy}
                accessibilityRole="button"
                accessibilityLabel="Delete Session"
                style={styles.modalDestructiveButton}>
                <Text style={styles.modalDestructiveLabel}>Delete session</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.dark.background,
  },
  screenHeader: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.xl,
    paddingBottom: Spacing.sm,
  },
  errorText: {
    ...Typography.label,
    color: Colors.dark.destructive,
    marginTop: Spacing.sm,
  },
  listContent: {
    paddingBottom: Spacing.xxxl,
  },
  monthHeader: {
    backgroundColor: Colors.dark.background,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.xs,
  },
  monthHeaderLabel: {
    ...Kicker,
    color: Colors.dark.mutedText,
  },
  emptyState: {
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.xl,
    marginTop: Spacing.xxxl,
  },
  emptyHeading: {
    ...Typography.heading,
    color: Colors.dark.text,
  },
  emptyBody: {
    ...Typography.body,
    color: Colors.dark.mutedText,
    textAlign: 'center',
  },
  footerLoading: {
    paddingVertical: Spacing.xl,
    alignItems: 'center',
  },
  loadingOverlay: {
    position: 'absolute',
    top: Spacing.xxxl,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.xl,
  },
  modalCard: {
    width: '100%',
    backgroundColor: Colors.dark.surface,
    borderRadius: Radius.lg,
    padding: Spacing.xl,
  },
  modalMessage: {
    ...Typography.body,
    color: Colors.dark.text,
    marginBottom: Spacing.xl,
  },
  modalButtonColumn: {
    gap: Spacing.sm,
  },
  modalSecondaryButton: {
    minHeight: HIT_TARGET_MIN,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalSecondaryLabel: {
    ...Typography.body,
    color: Colors.dark.text,
  },
  modalDestructiveButton: {
    minHeight: HIT_TARGET_MIN,
    borderRadius: Radius.lg,
    backgroundColor: Colors.dark.destructive,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalDestructiveLabel: {
    ...Typography.body,
    color: Colors.dark.text,
  },
});
