/**
 * apps/mobile/app/(tabs)/log/session.tsx — the active-session screen (D-22)
 *
 * One scrollable screen: a pinned live-HSS sticky header, a scrollable list of exercise
 * cards, and an "Add exercise" opener at the bottom — the Strong/Hevy shape. On mount, if
 * `sessionStore` isn't already initialized for this `workoutId` (i.e. this is a resumed
 * session reached via the D-14 ResumePrompt, not a freshly-created one from `log/index.tsx`
 * which already called `startSession`), `rehydrateFromDb` rebuilds the exact in-memory shape
 * from SQLite. Also mounts the Plan 07/08 stub components (`RestTimerBanner`,
 * `HSSBreakdownSheet`) so those plans extend this session purely through the store/their own
 * files — this screen is never touched again.
 */

import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { eq } from 'drizzle-orm';
import { db, workout } from '@apsis/db';

import Colors from '@/constants/Colors';
import { Spacing } from '@/constants/theme';
import { fetchProfileSummary } from '@/lib/commitSet';
import { ExerciseCard } from '@/components/session/ExerciseCard';
import { ExercisePickerSheet } from '@/components/session/ExercisePickerSheet';
import { HSSBreakdownSheet } from '@/components/session/HSSBreakdownSheet';
import { LiveHssHeader } from '@/components/session/LiveHssHeader';
import { RestTimerBanner } from '@/components/session/RestTimerBanner';
import { useSessionStore, type AddExerciseInput } from '@/stores/sessionStore';

export default function SessionScreen(): React.JSX.Element {
  const params = useLocalSearchParams<{ workoutId: string }>();
  const workoutId = params.workoutId;
  const router = useRouter();

  const storeWorkoutId = useSessionStore((s) => s.workoutId);
  const exercises = useSessionStore((s) => s.exercises);
  const addExercise = useSessionStore((s) => s.addExercise);
  const rehydrateFromDb = useSessionStore((s) => s.rehydrateFromDb);

  const [startedAt, setStartedAt] = useState<Date | null>(null);
  const [pickerVisible, setPickerVisible] = useState(false);

  // D-14 resume: only rehydrate when the store isn't already primed for this workout (a
  // freshly-created workout already has the store initialized via log/index.tsx's
  // startSession, so this only fires on the ResumePrompt's "Resume" path).
  //
  // FOCUS-GATED (checkpoint fix): this was a plain useEffect, which runs on UNFOCUSED
  // screens too. expo-router keeps prior session screens mounted in the log stack (e.g.
  // the finished workout A's screen under a new workout B's screen), so two mounted
  // session screens each saw `storeWorkoutId !== their workoutId` and rehydrated in turn —
  // an infinite A<->B store oscillation that (a) kept resurrecting the last finished
  // workout on screen and (b) wiped restTimerEndsAt/restNotificationId on every
  // rehydrateFromDb call (it resets to INITIAL_SESSION), killing the rest-timer banner
  // and notifications. useFocusEffect means only the screen the user is actually on can
  // touch the store.
  //
  // FINISHED-WORKOUT GUARD: if a stale session screen regains focus for a workout that is
  // already finished (or discarded), it must NOT re-open it — it replaces itself with the
  // Log start screen instead. Without this, finishing a workout (Done -> replace to
  // /(tabs)/log) landed back on the still-stacked session screen, which then rehydrated
  // the finished workout from SQLite — the "looping the last finished workout" report.
  useFocusEffect(
    useCallback(() => {
      if (!workoutId || storeWorkoutId === workoutId) return;
      let cancelled = false;
      (async () => {
        try {
          const rows = await db
            .select({ finishedAt: workout.finishedAt, deletedAt: workout.deletedAt })
            .from(workout)
            .where(eq(workout.id, workoutId))
            .limit(1);
          if (cancelled) return;
          const row = rows[0];
          if (!row || row.finishedAt != null || row.deletedAt != null) {
            router.replace('/(tabs)/log');
            return;
          }
          const profile = await fetchProfileSummary(db);
          if (cancelled) return;
          await rehydrateFromDb(workoutId, profile);
        } catch (err: unknown) {
          console.error('[Apsis] session rehydrate failed:', err);
        }
      })();
      return () => {
        cancelled = true;
      };
    }, [workoutId, storeWorkoutId, rehydrateFromDb, router])
  );

  useEffect(() => {
    if (!workoutId) return;
    let cancelled = false;
    db.select({ createdAt: workout.createdAt })
      .from(workout)
      .where(eq(workout.id, workoutId))
      .limit(1)
      .then((rows) => {
        if (!cancelled) setStartedAt(rows[0]?.createdAt ?? new Date());
      })
      .catch((err: unknown) => {
        console.error('[Apsis] session startedAt query failed:', err);
        if (!cancelled) setStartedAt(new Date());
      });
    return () => {
      cancelled = true;
    };
  }, [workoutId]);

  async function handleFinish(): Promise<void> {
    if (!workoutId) return;
    try {
      // Mark finished here (Finish is the user's explicit intent) so a normal finish flow
      // never leaves a dangling "open" workout that would spuriously re-trigger the D-14
      // resume prompt on next launch.
      await db.update(workout).set({ finishedAt: new Date() }).where(eq(workout.id, workoutId));
    } catch (err: unknown) {
      console.error('[Apsis] marking workout finished failed:', err);
    }
    router.push({ pathname: '/session/finish', params: { workoutId } });
  }

  function handleSelectExercise(exercise: AddExerciseInput): void {
    setPickerVisible(false);
    addExercise(exercise).catch((err: unknown) => {
      console.error('[Apsis] addExercise failed:', err);
    });
  }

  return (
    <View style={styles.container}>
      <LiveHssHeader startedAt={startedAt ?? new Date()} onFinish={handleFinish} />

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {exercises.map((exercise) => (
          <ExerciseCard key={exercise.exerciseId} exercise={exercise} />
        ))}

        <Pressable
          onPress={() => setPickerVisible(true)}
          accessibilityRole="button"
          accessibilityLabel="Add exercise"
          style={styles.addExerciseButton}>
          <Text style={styles.addExerciseLabel}>+ Add exercise</Text>
        </Pressable>
      </ScrollView>

      <RestTimerBanner />
      <HSSBreakdownSheet />
      <ExercisePickerSheet
        visible={pickerVisible}
        onClose={() => setPickerVisible(false)}
        onSelect={handleSelectExercise}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.dark.background,
  },
  scrollContent: {
    paddingTop: Spacing.md,
    paddingBottom: Spacing.xxxxl,
  },
  // Ghost affordance matching the card language (hairline border, card radius); volt stays
  // reserved for the live HSS readout and Finish so the accent keeps its signal value.
  addExerciseButton: {
    minHeight: 52,
    marginHorizontal: Spacing.lg,
    marginTop: Spacing.xs,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addExerciseLabel: {
    fontFamily: 'Archivo_500Medium',
    fontSize: 15,
    color: Colors.dark.text,
  },
});
