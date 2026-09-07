/**
 * apps/mobile/components/home/TodayBreakdownSheet.tsx
 *
 * The D-24 ring-tap breakdown: adapts `HSSBreakdownSheet.tsx`'s per-exercise pattern to
 * PER-SESSION rows for Home's mixed lift+run day. Lists each of today's sessions with its
 * own HSS, then a Day Total row; when more than one session was logged, also shows the
 * honest D-26 double-day math ("INCL. +Y DOUBLE-DAY LOAD") computed via `@apsis/engine`'s
 * `dailyHSS` -- never a hand-rolled multiplier (Don't Hand-Roll table, 04-RESEARCH.md).
 *
 * The Day Total row uses the caller-supplied `dayTotal` (the persisted `load_daily.dayHss`)
 * rather than re-summing sessions locally, so this sheet never drifts from what the ring
 * itself displays -- same "authoritative value, not a re-sum" discipline `HSSBreakdownSheet`
 * uses for its own total row (`sessionStore.liveHss`).
 */

import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import BottomSheet, { BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { dailyHSS } from '@apsis/engine';

import Colors from '../../constants/Colors';
import { Mono, Spacing, Typography, tabularNums } from '../../constants/theme';

export interface TodaySessionSummary {
  id: string;
  /** e.g. "Strength", "Run" -- the row's own bone title, distinct from the mono metadata line. */
  title: string;
  /** Mono metadata line, e.g. "LOWER · 6 LIFTS · RPE 8" or "6.2 KM · 5:30 /KM · 142 BPM". */
  metaLine: string;
  hss: number;
}

export interface TodayBreakdownSheetProps {
  open: boolean;
  onClose: () => void;
  sessions: TodaySessionSummary[];
  /** Authoritative persisted `load_daily.dayHss` for today. */
  dayTotal: number;
}

export function TodayBreakdownSheet({
  open,
  onClose,
  sessions,
  dayTotal,
}: TodayBreakdownSheetProps): React.JSX.Element {
  const doubleDayLoad = useMemo(() => {
    if (sessions.length <= 1) return 0;
    const scores = sessions.map((s) => s.hss);
    const total = scores.reduce((sum, s) => sum + s, 0);
    return dailyHSS(scores) - total;
  }, [sessions]);

  return (
    <BottomSheet
      index={open ? 0 : -1}
      snapPoints={['55%']}
      enablePanDownToClose
      onClose={onClose}
      backgroundStyle={styles.background}
      handleIndicatorStyle={styles.handleIndicator}>
      <BottomSheetScrollView contentContainerStyle={styles.content}>
        {sessions.length === 0 ? (
          <Text style={styles.emptyLabel}>No sessions logged yet today.</Text>
        ) : (
          sessions.map((session) => (
            <View key={session.id} style={styles.row}>
              <View style={styles.rowText}>
                <Text style={styles.sessionTitle}>{session.title}</Text>
                <Text style={styles.sessionMeta}>{session.metaLine}</Text>
              </View>
              <Text style={[styles.sessionStress, tabularNums]}>{Math.round(session.hss)}</Text>
            </View>
          ))
        )}

        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>Day Total</Text>
          <Text style={[styles.total, tabularNums]}>{Math.round(dayTotal)}</Text>
        </View>

        {sessions.length > 1 ? (
          <Text style={styles.doubleDayLine}>{`INCL. +${Math.round(doubleDayLoad)} DOUBLE-DAY LOAD`}</Text>
        ) : null}
      </BottomSheetScrollView>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  background: {
    backgroundColor: Colors.dark.surface,
  },
  handleIndicator: {
    backgroundColor: Colors.dark.border,
  },
  content: {
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.xxxl,
  },
  emptyLabel: {
    ...Typography.label,
    color: Colors.dark.mutedText,
    textAlign: 'center',
    marginTop: Spacing.xl,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.dark.border,
  },
  rowText: {
    flexShrink: 1,
    paddingRight: Spacing.sm,
    gap: 2,
  },
  sessionTitle: {
    fontFamily: 'Archivo_500Medium',
    fontSize: 16,
    color: Colors.dark.text,
  },
  sessionMeta: {
    ...Mono,
    color: Colors.dark.mutedText,
  },
  sessionStress: {
    ...Mono,
    color: Colors.dark.mutedText,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: Spacing.lg,
    paddingTop: Spacing.lg,
  },
  totalLabel: {
    ...Typography.heading,
    color: Colors.dark.text,
  },
  total: {
    ...Typography.heading,
    color: Colors.dark.accent,
  },
  doubleDayLine: {
    ...Mono,
    color: Colors.dark.warning,
    textAlign: 'center',
    marginTop: Spacing.sm,
  },
});
