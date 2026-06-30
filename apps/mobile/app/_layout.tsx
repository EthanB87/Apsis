/**
 * apps/mobile/app/_layout.tsx — Apsis root layout
 *
 * Boot sequence (executed once per app launch):
 *   1. SplashScreen held open while database initialises.
 *   2. useMigrations(db, migrations) runs drizzle migrations on the on-device SQLite file.
 *   3. On success → seedExercises(db) (idempotent: skips if rows already exist).
 *   4. SplashScreen hidden; expo-router Slot renders the active route.
 *
 * Security (V7 / T-1-02 — Error Handling):
 *   Migration errors are console.error'd for developer diagnostics.
 *   ErrorScreen shows only a hardcoded generic string — raw error.message and file paths
 *   are NEVER rendered to the user.
 *
 * Navigation: expo-router only (no @react-navigation/* imports).
 *   Slot renders whichever file-system route is currently active (e.g. app/(tabs)/).
 */

import { useEffect } from 'react';
import { Slot } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useMigrations } from 'drizzle-orm/op-sqlite/migrator';
import { db, migrations, seedExercises } from '@apsis/db';
import { LoadingScreen, ErrorScreen } from '../components/BootStates';

// Keep the splash screen up until the database is ready (success or error).
SplashScreen.preventAutoHideAsync();

export default function RootLayout(): React.JSX.Element | null {
  const { success, error } = useMigrations(db, migrations);

  // --- Seed exercises once migrations succeed ---
  useEffect(() => {
    if (!success) return;
    seedExercises(db).catch((err: unknown) => {
      // Seed failure is non-fatal for the boot sequence — log for diagnostics.
      console.error('[Apsis] seedExercises failed:', err);
    });
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
    return <ErrorScreen />;
  }

  // --- Loading gate ---
  if (!success) {
    return <LoadingScreen />;
  }

  // --- Success: hand off to expo-router file-system routing ---
  return <Slot />;
}
