/**
 * apps/mobile/components/history/DayRow.tsx
 *
 * A single calendar day in the History ledger (HOME-05/HOME-06, D-25..D-27, UI-SPEC section
 * 9). Three visual states:
 *   - REST (no sessions): thin ash date + "REST" mono label, not tappable/expandable (D-27).
 *   - Single-session day: date + day HSS, tap toggles an inline accordion revealing the one
 *     session sub-row (still useful so the athlete can tap through to session detail).
 *   - Multi-session day (D-26): same accordion, PLUS an amber "N SESSIONS · ADJUSTED" chip
 *     inline before the HSS, and — once expanded — a "DAY TOTAL X · INCL. +Y DOUBLE-DAY LOAD"
 *     line where X is the persisted, authoritative `load_daily.dayHss` (never re-summed, same
 *     "authoritative value" discipline `TodayBreakdownSheet.tsx` uses for its own Day Total
 *     row) and Y = `dailyHSS(scores) - sum(scores)` via `@apsis/engine` (never a hand-rolled
 *     multiplier).
 *
 * Swipe-to-delete (D-29): session sub-rows reuse the exact `ExerciseCard.tsx`
 * `Swipeable`/`renderRightActions` pattern. The actual delete (confirm dialog +
 * `discardWorkout` + list refresh) is owned by the parent screen
 * (`app/(tabs)/history/index.tsx`) — this component only requests it via
 * `onRequestDeleteSession`, mirroring how `onSelectSession` defers navigation to the parent.
 */

import { Pressable, StyleSheet, Text, View } from 'react-native';
import Swipeable from 'react-native-gesture-handler/ReanimatedSwipeable';
import { dailyHSS } from '@apsis/engine';

import Colors from '../../constants/Colors';
import { HAIRLINE_WIDTH, Mono, Radius, Spacing, Typography, tabularNums } from '../../constants/theme';

const MONTH_ABBR = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

export interface DaySession {
  id: string;
  /** workout.type — 'endurance' renders as "Run" for readability (see capitalize below). */
  type: 'strength' | 'endurance' | 'hybrid';
  title: string | null;
  hss: number;
  /** workout.source (D-08 provenance) — drives the ash "APPLE HEALTH" chip below. */
  source: 'manual' | 'healthkit';
}

export interface DayRowProps {
  localDate: string;
  /** Persisted, authoritative `load_daily.dayHss` for this day (double-penalty already applied). */
  dayHss: number;
  sessionCount: number;
  sessions: DaySession[];
  expanded: boolean;
  onToggleExpand: () => void;
  onSelectSession: (workoutId: string) => void;
  onRequestDeleteSession: (workoutId: string) => void;
}

function formatDayLabel(localDate: string): string {
  const [, month, day] = localDate.split('-').map((part) => Number.parseInt(part, 10));
  return `${MONTH_ABBR[(month ?? 1) - 1]} ${day}`;
}

function sessionLabel(session: DaySession): string {
  if (session.title) return session.title;
  return session.type === 'endurance' ? 'Run' : session.type === 'hybrid' ? 'Hybrid' : 'Strength';
}

function DeleteAction({ onPress }: { onPress: () => void }): React.JSX.Element {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel="Delete session"
      style={styles.deleteAction}>
      <Text style={styles.deleteActionLabel}>Delete</Text>
    </Pressable>
  );
}

export function DayRow({
  localDate,
  dayHss,
  sessionCount,
  sessions,
  expanded,
  onToggleExpand,
  onSelectSession,
  onRequestDeleteSession,
}: DayRowProps): React.JSX.Element {
  const isRest = sessionCount === 0;

  if (isRest) {
    return (
      <View style={styles.restRow}>
        <Text style={styles.restDate}>{formatDayLabel(localDate)}</Text>
        <Text style={styles.restLabel}>REST</Text>
      </View>
    );
  }

  // D-26: the honest double-session math — Y is always derived from the SAME engine
  // function the recompute pipeline uses (dailyHSS), never a hand-rolled `* penalty`.
  const doubleDayLoad =
    sessionCount > 1 ? dailyHSS(sessions.map((s) => s.hss)) - sessions.reduce((sum, s) => sum + s.hss, 0) : 0;

  return (
    <View>
      <Pressable
        onPress={onToggleExpand}
        accessibilityRole="button"
        accessibilityLabel={`${formatDayLabel(localDate)}, ${Math.round(dayHss)} HSS, ${sessionCount} session${sessionCount === 1 ? '' : 's'}`}
        accessibilityState={{ expanded }}
        style={styles.dayRow}>
        <View style={styles.dayRowLeft}>
          <Text style={styles.dateLabel}>{formatDayLabel(localDate)}</Text>
          {sessionCount > 1 ? (
            <View style={styles.chip}>
              <Text style={styles.chipLabel}>{`${sessionCount} SESSIONS · ADJUSTED`}</Text>
            </View>
          ) : null}
        </View>
        <Text style={[styles.dayHss, tabularNums]}>{Math.round(dayHss)}</Text>
      </Pressable>

      {expanded ? (
        <View style={styles.accordion}>
          {sessions.map((session) => (
            <Swipeable
              key={session.id}
              renderRightActions={() => (
                <DeleteAction onPress={() => onRequestDeleteSession(session.id)} />
              )}
              overshootRight={false}>
              <Pressable
                onPress={() => onSelectSession(session.id)}
                accessibilityRole="button"
                accessibilityLabel={`${sessionLabel(session)}, ${Math.round(session.hss)} HSS`}
                style={styles.sessionRow}>
                <View style={styles.sessionRowLeft}>
                  <Text style={styles.sessionLabel}>{sessionLabel(session)}</Text>
                  {session.source === 'healthkit' ? (
                    // D-08 provenance chip -- ash tint (never volt/amber), reuses the exact
                    // pill shape as the "N SESSIONS · ADJUSTED" chip above (styles.chip).
                    <View style={styles.sourceChip}>
                      <Text style={styles.sourceChipLabel}>APPLE HEALTH</Text>
                    </View>
                  ) : null}
                </View>
                <Text style={[styles.sessionHss, tabularNums]}>{Math.round(session.hss)}</Text>
              </Pressable>
            </Swipeable>
          ))}

          {sessionCount > 1 ? (
            // Copywriting Contract (04-UI-SPEC.md, D-26): one combined mono ash line, not a
            // separate total row + warning line — "DAY TOTAL {X} · INCL. +{Y} DOUBLE-DAY LOAD".
            <Text style={styles.doubleDayLine}>
              {`DAY TOTAL ${Math.round(dayHss)} · INCL. +${Math.round(doubleDayLoad)} DOUBLE-DAY LOAD`}
            </Text>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  dayRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    minHeight: 56,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.dark.border,
  },
  dayRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    flexShrink: 1,
  },
  dateLabel: {
    ...Typography.body,
    color: Colors.dark.text,
  },
  dayHss: {
    ...Typography.heading,
    color: Colors.dark.text,
  },
  chip: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: Radius.pill,
    backgroundColor: 'rgba(205,190,74,0.15)',
  },
  chipLabel: {
    ...Mono,
    fontSize: 11,
    color: Colors.dark.warning,
  },
  restRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    minHeight: 32,
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.dark.border,
  },
  restDate: {
    ...Typography.label,
    color: Colors.dark.mutedText,
  },
  restLabel: {
    ...Mono,
    color: Colors.dark.mutedText,
  },
  accordion: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.sm,
    backgroundColor: Colors.dark.surface,
  },
  sessionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    minHeight: 44,
    paddingLeft: Spacing.lg,
    backgroundColor: Colors.dark.surface,
  },
  sessionRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    flexShrink: 1,
  },
  sessionLabel: {
    ...Typography.label,
    color: Colors.dark.text,
  },
  // D-08 provenance chip -- ash tint (not the amber `chip` style above), Mono at fontSize 11,
  // same Radius.pill shape as "N SESSIONS · ADJUSTED".
  sourceChip: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: Radius.pill,
    backgroundColor: 'rgba(138,144,152,0.15)',
  },
  sourceChipLabel: {
    ...Mono,
    fontSize: 11,
    color: Colors.dark.mutedText,
  },
  sessionHss: {
    ...Mono,
    color: Colors.dark.mutedText,
  },
  // "DAY TOTAL {X} · INCL. +{Y} DOUBLE-DAY LOAD" (Copywriting Contract, D-26) — Mono role, ash.
  doubleDayLine: {
    ...Mono,
    color: Colors.dark.mutedText,
    paddingLeft: Spacing.lg,
    marginTop: Spacing.sm,
    paddingTop: Spacing.sm,
    borderTopWidth: HAIRLINE_WIDTH,
    borderTopColor: Colors.dark.border,
  },
  deleteAction: {
    width: 88,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.dark.destructive,
  },
  deleteActionLabel: {
    fontFamily: 'Archivo_500Medium',
    fontSize: 14,
    color: Colors.dark.text,
  },
});
