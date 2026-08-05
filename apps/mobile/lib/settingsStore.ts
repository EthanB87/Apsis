/**
 * apps/mobile/lib/settingsStore.ts
 *
 * A tiny zustand store exposing the active per-domain unit display preferences
 * (D-01/ONB-04/D-05) so any screen can convert metric storage to display (kg<->lb,
 * km<->mi) via the `@apsis/shared` unit helpers without re-querying `user_profile`
 * itself. `useProfile` hydrates this store on load and on every successful units
 * update — this store never writes to the database directly; it only mirrors the
 * profile row's three unit buckets for cheap cross-screen reads. Storage always stays
 * metric (ONB-04) — this is a display-only signal, matching the profileVersion.ts
 * precedent (Plan 05) of a small module-scoped zustand store for a cross-cutting signal.
 *
 * Phase 09 (D-01): the single `units` field is split into three independent buckets —
 * lifts, bodyweight, and runs — so a user can display imperial lifts alongside km runs
 * on the same day. The legacy `user_profile.units` DB column is retained only as the
 * D-04 backfill source + rollback anchor; this store's job is display fan-out to the
 * three buckets, never the single legacy value.
 */

import { create } from 'zustand';
import type { Units } from '@apsis/shared';

interface SettingsState {
  liftsUnits: Units;
  bodyweightUnits: Units;
  runUnits: Units;
  /** Sync the store from a `user_profile.lifts_units` read/write — never mutates storage itself. */
  setLiftsUnits: (units: Units) => void;
  /** Sync the store from a `user_profile.bodyweight_units` read/write — never mutates storage itself. */
  setBodyweightUnits: (units: Units) => void;
  /** Sync the store from a `user_profile.run_units` read/write — never mutates storage itself. */
  setRunUnits: (units: Units) => void;
}

export const useSettingsStore = create<SettingsState>()((set) => ({
  liftsUnits: 'metric',
  bodyweightUnits: 'metric',
  runUnits: 'metric',
  setLiftsUnits: (liftsUnits) => set({ liftsUnits }),
  setBodyweightUnits: (bodyweightUnits) => set({ bodyweightUnits }),
  setRunUnits: (runUnits) => set({ runUnits }),
}));
