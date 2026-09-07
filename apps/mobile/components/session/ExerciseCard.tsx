/**
 * apps/mobile/components/session/ExerciseCard.tsx
 *
 * A single exercise's card in the active-session scroll (D-22) — REDESIGNED with SetRow
 * under user-granted full creative control at the Plan 03-10 checkpoint (palette-only
 * constraint; DESIGN-SYSTEM.md component specs superseded for this surface).
 *
 * Hierarchy, top to bottom: exercise name (heavy Archivo, uppercase) with the last-session
 * line (mono, ash) directly beneath it as its metadata; a mono column-header row (SET ·
 * KG/LB · REPS-or-SEC · RPE · LOG) built from SetRow's exported grid constants so labels
 * always sit over their columns; the set ledger rows; and a full-width "+ Add set" ghost
 * row that clones the previous set (D-11/LIFT-06). Swipe-left -> Delete (D-11) removes a
 * set inline; if the set was already committed, the persisted row is deleted and the
 * session HSS recomputed BEFORE the row leaves the in-memory list, so the live header
 * never shows a stale total.
 */

import { Pressable, StyleSheet, Text, View } from 'react-native';
import Swipeable from 'react-native-gesture-handler/ReanimatedSwipeable';
import { db } from '@apsis/db';

import Colors from '../../constants/Colors';
import { HAIRLINE_WIDTH, HIT_TARGET_MIN, Spacing } from '../../constants/theme';
import { uncommitSet } from '../../lib/commitSet';
import { useSessionStore, type ExerciseCardState, type SetDraft } from '../../stores/sessionStore';
import {
  SET_ROW_GAP,
  SET_ROW_H_PADDING,
  SET_ROW_LOG_COL,
  SET_ROW_RPE_COL,
  SET_ROW_SET_COL,
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

      {/* Column headers reuse SetRow's exact grid (same fixed columns, flex split, gap,
          padding) so each label sits over its column at any width. */}
      <View style={styles.columnHeaderRow}>
        <Text style={[styles.columnHeader, styles.columnHeaderSet]}>SET</Text>
        <Text style={[styles.columnHeader, styles.columnHeaderFlex]}>
          {units === 'imperial' ? 'LB' : 'KG'}
        </Text>
        <Text style={[styles.columnHeader, styles.columnHeaderFlex]}>
          {exercise.entryMode === 'timed' ? 'SEC' : 'REPS'}
        </Text>
        <Text style={[styles.columnHeader, styles.columnHeaderRpe]}>RPE</Text>
        <Text style={[styles.columnHeader, styles.columnHeaderLog]}>LOG</Text>
      </View>

      {exercise.sets.map((set) => (
        <Swipeable
          key={set.id}
          renderRightActions={() => <DeleteAction onPress={() => handleDelete(set)} />}
          overshootRight={false}>
          <SetRow
            exerciseId={exercise.exerciseId}
            exerciseBwFactor={exercise.bwFactor}
            entryMode={exercise.entryMode}
            set={set}
          />
        </Swipeable>
      ))}

      <Pressable
        onPress={() => addSet(exercise.exerciseId)}
        accessibilityRole="button"
        accessibilityLabel="Add set"
        style={({ pressed }) => [styles.addSetRow, pressed && styles.addSetRowPressed]}>
        <Text style={styles.addSetLabel}>+ Add set</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.dark.surface,
    borderRadius: 12,
    borderWidth: HAIRLINE_WIDTH,
    borderColor: Colors.dark.border,
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.md,
    overflow: 'hidden',
  },
  header: {
    paddingHorizontal: SET_ROW_H_PADDING,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.md,
    gap: Spacing.xs,
  },
  name: {
    fontFamily: 'Archivo_800ExtraBold',
    fontSize: 17,
    lineHeight: 21,
    letterSpacing: -0.2,
    textTransform: 'uppercase',
    color: Colors.dark.text,
  },
  summary: {
    fontFamily: 'JetBrainsMono_400Regular',
    fontSize: 11,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: Colors.dark.mutedText,
  },
  columnHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SET_ROW_GAP,
    paddingHorizontal: SET_ROW_H_PADDING,
    paddingBottom: Spacing.xs,
  },
  columnHeader: {
    fontFamily: 'JetBrainsMono_500Medium',
    fontSize: 10,
    letterSpacing: 1.2,
    color: Colors.dark.mutedText,
    textAlign: 'center',
  },
  columnHeaderSet: {
    width: SET_ROW_SET_COL,
  },
  columnHeaderFlex: {
    flex: 1,
  },
  columnHeaderRpe: {
    width: SET_ROW_RPE_COL,
  },
  columnHeaderLog: {
    width: SET_ROW_LOG_COL,
  },
  // Full-width ghost row: transparent fill, hairline divider above, quiet bone label.
  addSetRow: {
    minHeight: HIT_TARGET_MIN,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.xs,
    borderTopWidth: HAIRLINE_WIDTH,
    borderTopColor: Colors.dark.border,
  },
  addSetRowPressed: {
    backgroundColor: Colors.dark.steel,
  },
  addSetLabel: {
    fontFamily: 'Archivo_500Medium',
    fontSize: 14,
    color: Colors.dark.text,
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
