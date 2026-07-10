/**
 * apps/mobile/components/session/ExerciseCard.tsx
 *
 * A single exercise's card in the active-session scroll (D-22): a secondary-surface
 * container with a Heading name + Label last-session summary header, its SetRows stacked
 * with hairline dividers, and a full-width "+ Add set" ghost row that clones the previous
 * set (D-11/LIFT-06). Swipe-left -> Delete (D-11) removes a set inline; if the set was
 * already committed, the persisted row is deleted and the session HSS recomputed BEFORE the
 * row leaves the in-memory list, so the live header never shows a stale total.
 */

import { Pressable, StyleSheet, Text, View } from 'react-native';
import Swipeable from 'react-native-gesture-handler/ReanimatedSwipeable';
import { db } from '@apsis/db';

import Colors from '../../constants/Colors';
import { HAIRLINE_WIDTH, HIT_TARGET_MIN, Mono, Radius, Spacing, Typography } from '../../constants/theme';
import { uncommitSet } from '../../lib/commitSet';
import { useSessionStore, type ExerciseCardState, type SetDraft } from '../../stores/sessionStore';
import { SetRow } from './SetRow';

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
    marginHorizontal: Spacing.md,
    marginBottom: Spacing.md,
    overflow: 'hidden',
  },
  header: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
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
  setDivider: {
    borderTopWidth: HAIRLINE_WIDTH,
    borderTopColor: Colors.dark.border,
  },
  addSetRow: {
    minHeight: HIT_TARGET_MIN,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: Colors.dark.accent,
    borderRadius: Radius.md,
    marginHorizontal: Spacing.md,
    marginTop: Spacing.sm,
    marginBottom: Spacing.md,
  },
  addSetLabel: {
    ...Typography.body,
    color: Colors.dark.accent,
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
