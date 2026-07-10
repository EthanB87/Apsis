/**
 * apps/mobile/components/session/ExerciseCard.tsx
 *
 * A single exercise's card in the active-session scroll (D-22): a secondary-surface
 * container with a Heading name + Label last-session summary header, a mono uppercase
 * column-header row (units/entry-mode aware) labeling the set-row columns, its SetRows
 * stacked with hairline dividers, and a full-width "+ Add set" ghost row that clones the
 * previous set (D-11/LIFT-06). Swipe-left -> Delete (D-11) removes a set inline; if the set
 * was already committed, the persisted row is deleted and the session HSS recomputed BEFORE
 * the row leaves the in-memory list, so the live header never shows a stale total.
 *
 * Header padding and the column-header row share SetRow's values-row left edge (both
 * Spacing.md), and the column labels reuse SetRow's exported fixed column widths so they
 * sit exactly over their columns — see .planning/debug/session-logger-ui-spacing.md for
 * the prior left-edge offset this closes (Plan 03-10).
 */

import { Pressable, StyleSheet, Text, View } from 'react-native';
import Swipeable from 'react-native-gesture-handler/ReanimatedSwipeable';
import { db } from '@apsis/db';

import Colors from '../../constants/Colors';
import { HAIRLINE_WIDTH, HIT_TARGET_MIN, Mono, Radius, Spacing, Typography } from '../../constants/theme';
import { uncommitSet } from '../../lib/commitSet';
import { useSessionStore, type ExerciseCardState, type SetDraft } from '../../stores/sessionStore';
import {
  SET_ROW_CHIP_WIDTH,
  SET_ROW_LOAD_GROUP_WIDTH,
  SET_ROW_VALUE_GROUP_WIDTH,
  SetRow,
} from './SetRow';

function DeleteAction({ onPress }: { onPress: () => void }): React.JSX.Element {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel="Delete set"
      style={styles.deleteAction}>
      <Text style={styles.deleteActionLabel}>Delete</Text>
    </Pressable>
  );
}

export interface ExerciseCardProps {
  exercise: ExerciseCardState;
}

export function ExerciseCard({ exercise }: ExerciseCardProps): React.JSX.Element {
  const workoutId = useSessionStore((s) => s.workoutId);
  const profileBodyweightKg = useSessionStore((s) => s.profileBodyweightKg);
  const units = useSessionStore((s) => s.units);
  const removeSet = useSessionStore((s) => s.removeSet);
  const addSet = useSessionStore((s) => s.addSet);
  const setLiveHss = useSessionStore((s) => s.setLiveHss);

  async function handleDelete(set: SetDraft): Promise<void> {
    if (set.committed && workoutId) {
      try {
        const result = await uncommitSet(db, workoutId, set.id, profileBodyweightKg);
        setLiveHss(result.hss, result.warnings);
      } catch (err: unknown) {
        // Don't remove the row from the in-memory list if the DB delete failed — a
        // "successful" swipe-delete that silently leaves the set persisted would drift
        // the UI away from the SQLite source of truth (D-13's whole point).
        console.error('[Apsis] uncommitSet (swipe-delete) failed:', err);
        return;
      }
    }
    removeSet(exercise.exerciseId, set.id);
  }

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.name}>{exercise.name}</Text>
        {exercise.lastSessionSummary ? (
          <Text style={styles.summary}>{exercise.lastSessionSummary}</Text>
        ) : null}
      </View>

      <View style={styles.columnHeaderRow}>
        <View style={styles.columnHeaderChipSpace} />
        <Text style={[styles.columnHeader, styles.columnHeaderLoad]}>
          {units === 'imperial' ? 'LB' : 'KG'}
        </Text>
        <Text style={[styles.columnHeader, styles.columnHeaderReps]}>
          {exercise.entryMode === 'timed' ? 'SEC' : 'REPS'}
        </Text>
      </View>

      {exercise.sets.map((set, index) => (
        <Swipeable
          key={set.id}
          renderRightActions={() => <DeleteAction onPress={() => handleDelete(set)} />}
          overshootRight={false}>
          <View style={index > 0 ? styles.setDivider : undefined}>
            <SetRow
              exerciseId={exercise.exerciseId}
              exerciseBwFactor={exercise.bwFactor}
              entryMode={exercise.entryMode}
              set={set}
            />
          </View>
        </Swipeable>
      ))}

      <Pressable
        onPress={() => addSet(exercise.exerciseId)}
        accessibilityRole="button"
        accessibilityLabel="Add set"
        style={styles.addSetRow}>
        <Text style={styles.addSetLabel}>+ Add set</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.dark.surface,
    borderRadius: Radius.lg,
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.lg,
    overflow: 'hidden',
  },
  header: {
    // Spacing.md matches SetRow's primary-row paddingHorizontal (Task 1) so the exercise
    // name / summary shares the same left edge as the set-row content beneath it.
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.xl,
    paddingBottom: Spacing.sm,
  },
  name: {
    ...Typography.heading,
    color: Colors.dark.text,
  },
  summary: {
    ...Mono,
    color: Colors.dark.mutedText,
    marginTop: Spacing.xs,
  },
  // Mono uppercase column labels above the set rows. Widths/gap/padding EXACTLY mirror
  // SetRow's values-row geometry (SET_ROW_* exports) so each label sits over its column —
  // the RPE column moved to SetRow's second (actions) line and carries its own inline
  // mono caption there, so it has no header label here.
  columnHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.xs,
  },
  columnHeaderChipSpace: {
    width: SET_ROW_CHIP_WIDTH,
  },
  columnHeader: {
    ...Mono,
    color: Colors.dark.mutedText,
    textAlign: 'center',
  },
  columnHeaderLoad: {
    width: SET_ROW_LOAD_GROUP_WIDTH,
  },
  columnHeaderReps: {
    width: SET_ROW_VALUE_GROUP_WIDTH,
  },
  setDivider: {
    borderTopWidth: HAIRLINE_WIDTH,
    borderTopColor: Colors.dark.border,
  },
  // Full-width ghost row (DESIGN-SYSTEM.md §5 Secondary/ghost: transparent fill, no inset
  // margin box, no dashed border) separated from the set list by a top hairline divider.
  addSetRow: {
    minHeight: HIT_TARGET_MIN,
    alignItems: 'center',
    justifyContent: 'center',
    borderTopWidth: HAIRLINE_WIDTH,
    borderTopColor: Colors.dark.border,
  },
  addSetLabel: {
    ...Typography.body,
    color: Colors.dark.text,
  },
  deleteAction: {
    width: 88,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.dark.destructive,
  },
  deleteActionLabel: {
    ...Typography.body,
    color: Colors.dark.text,
  },
});
