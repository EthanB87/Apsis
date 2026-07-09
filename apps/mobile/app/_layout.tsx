/**
 * apps/mobile/app/_layout.tsx — Apsis root layout
 *
 * Boot sequence (executed once per app launch):
 *   1. SplashScreen held open while database initialises.
 *   2. useMigrations(db, migrations) runs drizzle migrations on the on-device SQLite file.
 *   3. On success → seedExercises(db) (idempotent: skips if rows already exist).
 *   4. useProfileExists(success) queries whether a user_profile row exists (D-01).
 *   5. openWorkout(db) queries for an unfinished, non-deleted workout row (D-14 crash
 *      recovery) — if found, a ResumePrompt renders before the tab shell ever mounts.
 *   6. SplashScreen hidden once migrations settle; expo-router Stack.Protected gates
 *      onboarding vs. the tab shell by profile existence (D-01).
 *
 * Security (V7 / T-1-02 — Error Handling):
 *   Migration/query errors are console.error'd for developer diagnostics.
 *   ErrorScreen shows only a hardcoded generic string — raw error.message and file paths
 *   are NEVER rendered to the user. ResumePrompt renders only a formatted local time, no
 *   raw workout/profile detail (T-03-08).
 *
 * Navigation: expo-router only (no @react-navigation/* imports).
 *   Stack.Protected gates the entire app behind profile existence (D-01) — once past
 *   this gate, downstream code may assume a profile row exists (no null-profile branches).
 *   ONB-03 is satisfied structurally: no readiness UI is reachable before a profile exists.
 */

import { useEffect, useState } from 'react';
import { StyleSheet } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useMigrations } from 'drizzle-orm/op-sqlite/migrator';
import type { InferSelectModel } from 'drizzle-orm';
import { db, migrations, seedExercises, workout, openWorkout, softDeleteWorkout } from '@apsis/db';
import { LoadingScreen, ErrorScreen, ResumePrompt } from '../components/BootStates';
import { useProfileExists } from '../hooks/useProfileExists';

type WorkoutRow = InferSelectModel<typeof workout>;

// Keep the splash screen up until the database is ready (success or error).
SplashScreen.preventAutoHideAsync();

export default function RootLayout(): React.JSX.Element | null {
  const { success, error } = useMigrations(db, migrations);
  const router = useRouter();
  const hasProfile = useProfileExists(success);
  const [openWorkoutRow, setOpenWorkoutRow] = useState<'loading' | WorkoutRow | null>('loading');

  // --- Seed exercises once migrations succeed ---
  useEffect(() => {
    if (!success) return;
    seedExercises(db).catch((err: unknown) => {
      // Seed failure is non-fatal for the boot sequence — log for diagnostics.
      console.error('[Apsis] seedExercises failed:', err);
    });
  }, [success]);

  // --- Crash/kill resume detection (D-14): query for an open workout row ---
  useEffect(() => {
    if (!success) return;
    let cancelled = false;

    openWorkout(db)
      .then((rows) => {
        if (!cancelled) setOpenWorkoutRow(rows[0] ?? null);
      })
      .catch((err: unknown) => {
        console.error('[Apsis] openWorkout query failed:', err);
        if (!cancelled) setOpenWorkoutRow(null);
      });

    return () => {
      cancelled = true;
    };
  }, [success]);

  // --- Hide splash screen when boot is complete (success or error) ---
  useEffect(() => {
    if (success || error) {
      SplashScreen.hideAsync().catch(() => {
        // hideAsync() throws if the splash was already hidden — safe to swallow.
      });
    }
  }, [success, error]);

  // --- Error gate (V7 / T-1-02) ---
  if (error) {
    // Log raw error for developer diagnostics; ErrorScreen renders a generic string only.
    console.error('[Apsis] useMigrations error — raw details (developer only):', error);
    return (
      <GestureHandlerRootView style={styles.fill}>
        <ErrorScreen />
      </GestureHandlerRootView>
    );
  }

  // --- Loading gate: wait for migrations, profile-exists, and resume-check to settle ---
  if (!success || hasProfile === 'loading' || openWorkoutRow === 'loading') {
    return (
      <GestureHandlerRootView style={styles.fill}>
        <LoadingScreen />
      </GestureHandlerRootView>
    );
  }

  // --- Crash/kill resume prompt (D-14) — rendered before the tab shell ever mounts ---
  if (openWorkoutRow) {
    const workoutId = openWorkoutRow.id;
    return (
      <GestureHandlerRootView style={styles.fill}>
        <ResumePrompt
          startedAt={openWorkoutRow.createdAt ?? new Date()}
          onResume={() => {
            setOpenWorkoutRow(null);
            router.push({ pathname: '/(tabs)/log/session', params: { workoutId } });
          }}
          onFinishNow={() => {
            setOpenWorkoutRow(null);
            router.push({ pathname: '/session/finish', params: { workoutId } });
          }}
          onDiscard={() => {
            softDeleteWorkout(db, workoutId, new Date())
              .then(() => setOpenWorkoutRow(null))
              .catch((err: unknown) => {
                console.error('[Apsis] softDeleteWorkout (resume discard) failed:', err);
                // Fail safe: stop blocking the app even if the write failed — the row
                // simply reappears as an open workout again on the next launch.
                setOpenWorkoutRow(null);
              });
          }}
        />
      </GestureHandlerRootView>
    );
  }

  // --- Success: profile-gated route tree (D-01) ---
  // GestureHandlerRootView is required by @gorhom/bottom-sheet (ExercisePickerSheet,
  // HSSBreakdownSheet) and react-native-gesture-handler's Swipeable (ExerciseCard
  // swipe-to-delete), both introduced in Plan 06 — must wrap the whole app, not just the
  // log stack, per the library's own setup requirement.
  return (
    <GestureHandlerRootView style={styles.fill}>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Protected guard={!hasProfile}>
          <Stack.Screen name="onboarding" />
        </Stack.Protected>
        <Stack.Protected guard={hasProfile}>
          <Stack.Screen name="(tabs)" />
        </Stack.Protected>
      </Stack>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
});
