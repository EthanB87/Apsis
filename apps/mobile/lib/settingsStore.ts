/**
 * apps/mobile/lib/settingsStore.ts
 *
 * A tiny zustand store exposing the active `units` display preference (ONB-04/D-05) so
 * any screen can convert metric storage to display (kg<->lb, km<->mi) via the
 * `@apsis/shared` unit helpers without re-querying `user_profile` itself. `useProfile`
 * hydrates this store on load and on every successful units update — this store never
 * writes to the database directly; it only mirrors the profile row's `units` column for
 * cheap cross-screen reads. Storage always stays metric (ONB-04) — this is a display-only
 * signal, matching the profileVersion.ts precedent (Plan 05) of a small module-scoped
 * zustand store for a cross-cutting signal.
 */

import { create } from 'zustand';
import type { Units } from '@apsis/shared';

interface SettingsState {
  units: Units;
  /** Sync the store from a `user_profile.units` read/write — never mutates storage itself. */
  setUnits: (units: Units) => void;
}

export const useSettingsStore = create<SettingsState>()((set) => ({
  units: 'metric',
  setUnits: (units) => set({ units }),
}));
