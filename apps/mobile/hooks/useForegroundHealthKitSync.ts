/**
 * apps/mobile/hooks/useForegroundHealthKitSync.ts
 *
 * The D-02 foreground sync trigger: mirrors `RestTimerBanner.tsx`'s `AppState`
 * `'change'`-listener + cleanup-on-unmount shape exactly. On `nextState === 'active'`, if
 * `healthkitConnected` is true (D-21 toggle gate — off pauses all HK reads), fires a silent
 * anchor-delta `runHealthKitSync(db, { initial: false })`. Guarded by an in-flight ref (no
 * overlapping syncs) plus a short debounce window (a rapid background/foreground bounce — e.g.
 * Control Center or a notification-center pull — must not double-trigger a sync; this guard has
 * no analog in `RestTimerBanner.tsx` and is a new discretion item per 05-PATTERNS.md).
 *
 * D-25 (silent failure): a rejected `runHealthKitSync` is caught here and never rethrown or
 * surfaced as an error banner — the console.error is for developer diagnostics only (T-05-01,
 * Error object only, never a raw HK value); `healthkitLastSyncAt`/`healthkitAnchor` simply fail
 * to advance, so the next foreground sync retries the same window naturally.
 *
 * Mounted exactly once in `app/(tabs)/_layout.tsx` (the tab shell — always alive while the app
 * is usable, and deliberately outside every logging screen so sync never touches the logging
 * path, matching the project's local-first "logging never blocks" constraint). Renders no UI.
 *
 * Exports `useHealthKitImportSignal` (a `profileVersion.ts`-style tiny zustand store) as the
 * mechanism 05-09's TODAY notice will read for the quiet transient import count (D-10) — the
 * hook writes to it after every successful sync; it starts at `null`/`null` (nothing synced
 * yet this app session) and is intentionally NOT persisted (a notice should only ever fire for
 * a sync that happened during the current session).
 */

import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { create } from 'zustand';
import { db } from '@apsis/db';
import { runHealthKitSync } from '../lib/healthkitImport';
import { getSyncState } from '../lib/healthkitSyncState';

/** Guards a rapid background/foreground bounce from firing a second overlapping sync. */
const DEBOUNCE_MS = 2000;

interface HealthKitImportSignalState {
  lastImportedCount: number | null;
  lastSyncedAt: Date | null;
  setLastImport: (summary: { importedCount: number; syncedAt: Date }) => void;
}

/** 05-09's TODAY notice reads `lastImportedCount`/`lastSyncedAt` from this store (D-10). */
export const useHealthKitImportSignal = create<HealthKitImportSignalState>()((set) => ({
  lastImportedCount: null,
  lastSyncedAt: null,
  setLastImport: ({ importedCount, syncedAt }) =>
    set({ lastImportedCount: importedCount, lastSyncedAt: syncedAt }),
}));

/**
 * Mounts the `AppState` foreground listener described above. Call once, at the tab-shell root.
 */
export function useForegroundHealthKitSync(): void {
  const inFlightRef = useRef(false);
  const lastRunAtRef = useRef(0);
  const setLastImport = useHealthKitImportSignal((s) => s.setLastImport);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState !== 'active') return;
      if (inFlightRef.current) return;
      const now = Date.now();
      if (now - lastRunAtRef.current < DEBOUNCE_MS) return;
      lastRunAtRef.current = now;
      inFlightRef.current = true;

      void (async () => {
        try {
          const syncState = await getSyncState(db);
          if (syncState?.healthkitConnected !== true) return; // D-21 toggle gate
          const summary = await runHealthKitSync(db, { initial: false });
          setLastImport({ importedCount: summary.importedCount, syncedAt: new Date() });
        } catch (err: unknown) {
          // D-25: silent no-op — never surfaced to the UI; next foreground sync retries.
          console.error('[Apsis] useForegroundHealthKitSync sync failed:', err);
        } finally {
          inFlightRef.current = false;
        }
      })();
    });
    return () => subscription.remove();
  }, [setLastImport]);
}
