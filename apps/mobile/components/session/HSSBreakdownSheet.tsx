/**
 * apps/mobile/components/session/HSSBreakdownSheet.tsx
 *
 * The D-24 breakdown: a `@gorhom/bottom-sheet` opened by `sessionStore.breakdownOpen`,
 * listing per-exercise Label-size subtotal rows (name + set count + stress subtotal)
 * ending in a Heading-size session total row. Never shows raw formula internals or
 * engine config constants — the number, not the math (honest-number voice).
 *
 * Store-driven only (never imports session.tsx): each exercise card's committed sets are
 * re-run through the SAME per-set engine formulas `lib/commitSet.ts` uses for the real
 * recompute (`strengthStressDetailed`/`carryStressDetailed`), just grouped per exercise
 * instead of session-wide. Because `ss`/`cs` are linear sums scaled by a single constant
 * (`kStrength`/`kCarry`), summing these per-exercise subtotals is mathematically
 * equivalent to the session-wide `sessionHSSDetailed` call — so the rows always foot to
 * the session total. The total row itself uses `sessionStore.liveHss` directly (the
 * authoritative, DB-recomputed value) rather than re-summing, so it never drifts.
 */

import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import BottomSheet, { BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { carryStressDetailed, estimateE1RM, estimateE1RMFromRepMaxTable, strengthStressDetailed } from '@apsis/engine';

import Colors from '../../constants/Colors';
import { Mono, Spacing, Typography, tabularNums } from '../../constants/theme';
import { computeEffectiveLoad } from '../../lib/effectiveLoad';
import { useSessionStore, type ExerciseCardState } from '../../stores/sessionStore';

interface ExerciseSubtotal {
  exerciseId: string;
  name: string;
  setCount: number;
  stress: number;
}

function isLowerBody(bodyPart: string | null): boolean {
  return bodyPart === 'lower';
}

/** Rolls up committed-set stress for one exercise card using the same per-set engine
 * formulas `lib/commitSet.ts` uses for the real recompute (D-24). */
function computeExerciseSubtotal(card: ExerciseCardState, profileBodyweightKg: number): number {
  const committed = card.sets.filter((set) => set.committed);
  if (committed.length === 0) return 0;

  if (card.entryMode === 'timed') {
    return committed.reduce((sum, set) => {
      const loadKg = computeEffectiveLoad({ bwFactor: card.bwFactor }, set.loadFieldKg, profileBodyweightKg);
      return (
        sum +
        carryStressDetailed({
          loadKg,
          bodyweightKg: profileBodyweightKg,
          durationS: set.durationS,
          rpe: set.rpe,
          isWarmup: set.isWarmup,
        }).cs
      );
    }, 0);
  }

  const strengthSets = committed.map((set) => {
    const loadKg = computeEffectiveLoad({ bwFactor: card.bwFactor }, set.loadFieldKg, profileBodyweightKg);
    const e1rmKg =
      card.bwFactor != null
        ? estimateE1RMFromRepMaxTable(loadKg, set.reps)
        : estimateE1RM(loadKg, set.reps);
    return {
      loadKg,
      reps: set.reps,
      rpe: set.rpe,
      e1rmKg,
      isLowerBody: isLowerBody(card.bodyPart),
      isWarmup: set.isWarmup,
    };
  });

  return strengthStressDetailed(strengthSets).ss;
}

export function HSSBreakdownSheet(): React.JSX.Element {
  const breakdownOpen = useSessionStore((s) => s.breakdownOpen);
  const liveHss = useSessionStore((s) => s.liveHss);
  const exercises = useSessionStore((s) => s.exercises);
  const profileBodyweightKg = useSessionStore((s) => s.profileBodyweightKg);
  const setBreakdownOpen = useSessionStore((s) => s.setBreakdownOpen);

  const subtotals = useMemo<ExerciseSubtotal[]>(
    () =>
      exercises
        .map((card) => ({
          exerciseId: card.exerciseId,
          name: card.name,
          setCount: card.sets.filter((set) => set.committed).length,
          stress: computeExerciseSubtotal(card, profileBodyweightKg),
        }))
        .filter((row) => row.setCount > 0),
    [exercises, profileBodyweightKg]
  );

  return (
    <BottomSheet
      index={breakdownOpen ? 0 : -1}
      snapPoints={['55%']}
      enablePanDownToClose
      onClose={() => setBreakdownOpen(false)}
      backgroundStyle={styles.background}
      handleIndicatorStyle={styles.handleIndicator}>
      <BottomSheetScrollView contentContainerStyle={styles.content}>
        {subtotals.length === 0 ? (
          <Text style={styles.emptyLabel}>No committed sets yet.</Text>
        ) : (
          subtotals.map((row) => (
            <View key={row.exerciseId} style={styles.row}>
              <Text style={styles.exerciseLabel}>
                {`${row.name} · ${row.setCount} set${row.setCount === 1 ? '' : 's'}`}
              </Text>
              <Text style={[styles.exerciseStress, tabularNums]}>{Math.round(row.stress)}</Text>
            </View>
          ))
        )}

        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>Session Total</Text>
          <Text style={[styles.total, tabularNums]}>{Math.round(liveHss)}</Text>
        </View>
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
  exerciseLabel: {
    ...Typography.label,
    color: Colors.dark.text,
    flexShrink: 1,
    paddingRight: Spacing.sm,
  },
  exerciseStress: {
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
});
