/**
 * apps/mobile/components/session/ExercisePickerSheet.tsx
 *
 * Search-first exercise picker (LIFT-01/D-10): auto-focused search, a "Recents" section
 * (most recently logged exercises, D-10) above an A-Z-by-body-part list, all filtered
 * in-memory against the seeded exercise library — no db query runs per keystroke (only the
 * Recents lookup runs once, when the sheet opens). Only exercises with a Phase 3 entry mode
 * ('reps' | 'timed') are shown; `type: 'endurance'` seeded rows (run, ski-erg, etc.) have
 * `entryMode: null` and are Phase 4's running logger, not this picker (03-RESEARCH Pitfall 5).
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import type { ElementRef } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import BottomSheet, { BottomSheetSectionList, BottomSheetTextInput } from '@gorhom/bottom-sheet';
import { db, STARTER_EXERCISES, recentExerciseIds } from '@apsis/db';

import Colors from '../../constants/Colors';
import { HIT_TARGET_MIN, Radius, Spacing, Typography } from '../../constants/theme';
import type { AddExerciseInput } from '../../stores/sessionStore';

type LoggableExercise = (typeof STARTER_EXERCISES)[number] & {
  entryMode: 'reps' | 'timed';
};

const LOGGABLE_EXERCISES: LoggableExercise[] = STARTER_EXERCISES.filter(
  (exercise): exercise is LoggableExercise => exercise.entryMode != null
);

const RECENTS_LIMIT = 5;

interface Section {
  title: string;
  data: LoggableExercise[];
}

function capitalize(value: string): string {
  return value.length === 0 ? value : value[0]!.toUpperCase() + value.slice(1);
}

function toAddExerciseInput(exercise: LoggableExercise): AddExerciseInput {
  return {
    id: exercise.id,
    name: exercise.name,
    bodyPart: exercise.bodyPart,
    bwFactor: exercise.bwFactor,
    entryMode: exercise.entryMode,
    // Not carried in the in-memory seed array (only the DB row has it); Plan 07's rest-timer
    // implementation reads the per-exercise override from the DB directly when it needs it.
    restTimerSec: null,
  };
}

export interface ExercisePickerSheetProps {
  visible: boolean;
  onClose: () => void;
  onSelect: (exercise: AddExerciseInput) => void;
}

export function ExercisePickerSheet({
  visible,
  onClose,
  onSelect,
}: ExercisePickerSheetProps): React.JSX.Element {
  const [search, setSearch] = useState('');
  const [recentIds, setRecentIds] = useState<string[]>([]);
  const searchInputRef = useRef<ElementRef<typeof BottomSheetTextInput>>(null);

  useEffect(() => {
    if (!visible) {
      setSearch('');
      return;
    }
    recentExerciseIds(db, RECENTS_LIMIT)
      .then((rows) => setRecentIds(rows.map((row) => row.exerciseId)))
      .catch((err: unknown) => {
        console.error('[Apsis] recentExerciseIds query failed:', err);
        setRecentIds([]);
      });
    const focusTimer = setTimeout(() => searchInputRef.current?.focus(), 300);
    return () => clearTimeout(focusTimer);
  }, [visible]);

  const { sections, isEmpty } = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (query.length > 0) {
      const matches = LOGGABLE_EXERCISES.filter((exercise) =>
        exercise.name.toLowerCase().includes(query)
      );
      return {
        sections: matches.length > 0 ? [{ title: 'Results', data: matches }] : [],
        isEmpty: matches.length === 0,
      };
    }

    const result: Section[] = [];
    const recents = recentIds
      .map((id) => LOGGABLE_EXERCISES.find((exercise) => exercise.id === id))
      .filter((exercise): exercise is LoggableExercise => exercise != null);
    if (recents.length > 0) {
      result.push({ title: 'Recents', data: recents });
    }

    const byBodyPart = new Map<string, LoggableExercise[]>();
    for (const exercise of [...LOGGABLE_EXERCISES].sort((a, b) => a.name.localeCompare(b.name))) {
      const key = exercise.bodyPart ?? 'other';
      const list = byBodyPart.get(key) ?? [];
      list.push(exercise);
      byBodyPart.set(key, list);
    }
    for (const [bodyPart, list] of [...byBodyPart.entries()].sort((a, b) =>
      a[0].localeCompare(b[0])
    )) {
      result.push({ title: capitalize(bodyPart), data: list });
    }

    return { sections: result, isEmpty: false };
  }, [search, recentIds]);

  return (
    <BottomSheet
      index={visible ? 0 : -1}
      snapPoints={['85%']}
      enablePanDownToClose
      onClose={onClose}
      keyboardBehavior="extend"
      keyboardBlurBehavior="restore"
      backgroundStyle={styles.background}
      handleIndicatorStyle={styles.handleIndicator}>
      <View style={styles.searchRow}>
        <BottomSheetTextInput
          ref={searchInputRef}
          value={search}
          onChangeText={setSearch}
          placeholder="Search exercises"
          placeholderTextColor={Colors.dark.mutedText}
          style={styles.searchInput}
          accessibilityLabel="Search exercises"
          autoCorrect={false}
        />
      </View>

      {isEmpty ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyHeading}>No matches</Text>
          <Text style={styles.emptyBody}>
            Try a different name, or scroll the list below by body part.
          </Text>
        </View>
      ) : (
        <BottomSheetSectionList
          sections={sections}
          keyExtractor={(item) => item.id}
          renderSectionHeader={({ section }) => (
            <Text style={styles.sectionHeader}>{section.title}</Text>
          )}
          renderItem={({ item }) => (
            <Pressable
              onPress={() => onSelect(toAddExerciseInput(item))}
              accessibilityRole="button"
              accessibilityLabel={item.name}
              style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}>
              <Text style={styles.rowLabel}>{item.name}</Text>
            </Pressable>
          )}
          contentContainerStyle={styles.listContent}
        />
      )}
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
  searchRow: {
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.sm,
  },
  searchInput: {
    ...Typography.body,
    color: Colors.dark.text,
    backgroundColor: Colors.dark.background,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    minHeight: HIT_TARGET_MIN,
  },
  listContent: {
    paddingBottom: Spacing.xl,
  },
  sectionHeader: {
    ...Typography.label,
    color: Colors.dark.mutedText,
    backgroundColor: Colors.dark.surface,
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.xs,
  },
  row: {
    minHeight: HIT_TARGET_MIN,
    justifyContent: 'center',
    paddingHorizontal: Spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.dark.border,
  },
  rowPressed: {
    backgroundColor: Colors.dark.background,
  },
  rowLabel: {
    ...Typography.body,
    color: Colors.dark.text,
  },
  emptyState: {
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.xl,
    alignItems: 'center',
  },
  emptyHeading: {
    ...Typography.heading,
    color: Colors.dark.text,
    marginBottom: Spacing.xs,
  },
  emptyBody: {
    ...Typography.body,
    color: Colors.dark.mutedText,
    textAlign: 'center',
  },
});
