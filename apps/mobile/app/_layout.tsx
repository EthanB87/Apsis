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
 *
 * Crash reporting (T-06-01/D-01/D-02/D-03, REL-03):
 *   Sentry.init runs at module scope, alongside SplashScreen.preventAutoHideAsync(), once
 *   per app launch. Scope is native crashes + unhandled JS errors ONLY — tracesSampleRate 0
 *   (no performance tracing), attachScreenshot/attachViewHierarchy false, sendDefaultPii
 *   false (no identity ever attached). `beforeSend: sanitizeSentryEvent` (lib/sentrySanitize.ts)
 *   is an ALLOWLIST — only exception + contexts.device/app ever survive; health-derived
 *   values (HR/HSS/bodyweight/distance/duration) cannot leak by omission, not by a denylist
 *   that would need updating per field. Defense in depth against Pitfall 6 (default
 *   integrations re-capturing console.* as breadcrumbs): the installed SDK line (7.11.0) has
 *   no integration literally named 'Console' — its `breadcrumbsIntegration` (name
 *   'Breadcrumbs') is the one with `console: true` by default, so THAT is the integration
 *   filtered out of the default set below; `sanitizeSentryEvent` also unconditionally empties
 *   `event.breadcrumbs` regardless, so console capture is blocked at both layers even if this
 *   SDK's internal naming changes again in a future upgrade.
 */

import { useEffect, useState } from 'react';
import { StyleSheet } from 'react-native';
import { Stack, useRouter, type Href } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import * as Sentry from '@sentry/react-native';
import { useFonts } from 'expo-font';
import {
  Archivo_400Regular,
  Archivo_500Medium,
  Archivo_800ExtraBold,
  Archivo_900Black,
} from '@expo-google-fonts/archivo';
import { JetBrainsMono_400Regular, JetBrainsMono_500Medium } from '@expo-google-fonts/jetbrains-mono';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useMigrations } from 'drizzle-orm/op-sqlite/migrator';
import type { InferSelectModel } from 'drizzle-orm';
import { db, migrations, seedExercises, workout, openWorkout, softDeleteWorkout } from '@apsis/db';
import { LoadingScreen, ErrorScreen, ResumePrompt } from '../components/BootStates';
import { useProfileExists } from '../hooks/useProfileExists';
import { sanitizeSentryEvent } from '../lib/sentrySanitize';

type WorkoutRow = InferSelectModel<typeof workout>;

// Keep the splash screen up until the database is ready (success or error).
SplashScreen.preventAutoHideAsync();

// Crash reporting (D-01/D-02/D-03, REL-03) — see module doc comment above.
Sentry.init({
  dsn: process.env.EXPO_PUBLIC_SENTRY_DSN,
  sendDefaultPii: false, // D-03: no PII ever added by active integrations
  tracesSampleRate: 0, // D-02: no performance tracing
  attachScreenshot: false,
  attachViewHierarchy: false,
  beforeSend: sanitizeSentryEvent,
  integrations: (defaults) => defaults.filter((integration) => integration.name !== 'Breadcrumbs'),
});

function RootLayout(): React.JSX.Element | null {
  const [fontsLoaded] = useFonts({
    Archivo_400Regular,
    Archivo_500Medium,
    Archivo_800ExtraBold,
    Archivo_900Black,
    JetBrainsMono_400Regular,
    JetBrainsMono_500Medium,
  });
  const { success, error } = useMigrations(db, migrations);
  const router = useRouter();
  const hasProfile = useProfileExists(success);
  const [openWorkoutRow, setOpenWorkoutRow] = useState<'loading' | WorkoutRow | null>('loading');
  const [pendingRoute, setPendingRoute] = useState<Href | null>(null);

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

  // --- Deferred resume-prompt navigation (D-14) ---
  // ResumePrompt renders *instead of* a navigator, so calling router.push synchronously
  // from its handlers targets a navigator that has never mounted — expo-router rejects
  // that ("Attempted to navigate before mounting the Root Layout component"). Store the
  // target and push from an effect that runs only after the openWorkoutRow === null
  // re-render has actually mounted the <Stack>.
  useEffect(() => {
    if (openWorkoutRow === null && pendingRoute != null) {
      router.push(pendingRoute);
      setPendingRoute(null);
    }
  }, [openWorkoutRow, pendingRoute, router]);

  // --- Hide splash screen when boot is complete (success or error) AND fonts have settled ---
  // (design-system fontFamily references would render as system fallback if the splash hid
  // before Archivo/JetBrains Mono finished loading — quick task 260709-qmv).
  useEffect(() => {
    if ((success || error) && fontsLoaded) {
      SplashScreen.hideAsync().catch(() => {
        // hideAsync() throws if the splash was already hidden — safe to swallow.
      });
    }
  }, [success, error, fontsLoaded]);

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

  // --- Loading gate: wait for fonts, migrations, profile-exists, and resume-check to settle ---
  if (!fontsLoaded || !success || hasProfile === 'loading' || openWorkoutRow === 'loading') {
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
            setPendingRoute({ pathname: '/(tabs)/log/session', params: { workoutId } });
            setOpenWorkoutRow(null);
          }}
          onFinishNow={() => {
            setPendingRoute({ pathname: '/session/finish', params: { workoutId } });
            setOpenWorkoutRow(null);
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

// D-01/REL-03: Sentry.wrap adds touch-event breadcrumb tracking + a top-level error
// boundary around the whole app. Wraps the named RootLayout declaration above rather than
// exporting a default function directly.
export default Sentry.wrap(RootLayout);

const styles = StyleSheet.create({
  fill: { flex: 1 },
});
