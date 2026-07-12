/**
 * apps/mobile/hooks/useProfile.ts
 *
 * Reads the single `user_profile` row via a parameterized drizzle builder (T-1-01) and
 * exposes an update path for the Settings profile editor (ONB-02). The update is a plain
 * `UPDATE user_profile SET ... WHERE id = ?` — it only ever touches `user_profile`, never
 * `strength_set.stressScore`/`endurance_segment.stressScore`/`workout.hss`/`load_daily`
 * rows, so edits apply to FUTURE calculations only and never rewrite a persisted,
 * version-stamped score (D-05, Phase 02 D-06). `useSaveProfile` (Plan 05) remains the
 * insert-only path used once during onboarding; this hook is the update-in-place path
 * `useSaveProfile`'s doc comment anticipates for Plan 09.
 *
 * On every successful read/update this hydrates `useSettingsStore`'s `units` mirror
 * (lib/settingsStore.ts) so other screens can convert metric storage to display without
 * re-querying the profile row themselves (ONB-04).
 *
 * Security (V7/T-1-02, T-03-08): the raw error is console.error'd for developer
 * diagnostics only; the UI-SPEC's generic string is the only user-facing error surface —
 * never the raw error object, and never raw bodyweight/HR/pace values.
 */

import { useCallback, useEffect, useState } from 'react';
import { eq } from 'drizzle-orm';
import { db, userProfile } from '@apsis/db';
import type { Sex, Units } from '@apsis/shared';
import { useSettingsStore } from '../lib/settingsStore';

const UPDATE_ERROR_MESSAGE = "Couldn't save your profile. Check available storage and try again.";
const LOAD_ERROR_MESSAGE = "Couldn't load your profile. Try again.";

export interface ProfileValues {
  id: number;
  sex: Sex | null;
  bodyweightKg: number | null;
  thresholdHr: number | null;
  thresholdPaceSecPerKm: number | null;
  units: Units;
  restTimerDefaultSec: number;
}

export interface ProfileUpdateInput {
  sex?: Sex;
  bodyweightKg?: number;
  /** CR-02/D-17: callers MUST stamp this whenever `bodyweightKg` is manually changed —
   * most-recent-wins conflict resolution against HK samples compares this timestamp; a
   * missing stamp lets an older HK body-mass sample silently overwrite the manual edit. */
  bodyweightSetAt?: Date;
  thresholdHr?: number;
  thresholdPaceSecPerKm?: number;
  units?: Units;
  restTimerDefaultSec?: number;
}

export interface UseProfileResult {
  profile: ProfileValues | null;
  loading: boolean;
  submitting: boolean;
  errorMessage: string | null;
  /** Generic message when the initial profile read failed (WR-07) — never the raw error. */
  loadErrorMessage: string | null;
  /** Re-runs the initial profile read — the retry action for the load-failure state. */
  reload: () => Promise<void>;
  /** Forward-only UPDATE against `user_profile` (D-05) — never touches stored scores. */
  update: (patch: ProfileUpdateInput) => Promise<boolean>;
}

export function useProfile(): UseProfileResult {
  const [profile, setProfile] = useState<ProfileValues | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [loadErrorMessage, setLoadErrorMessage] = useState<string | null>(null);
  const setUnits = useSettingsStore((state) => state.setUnits);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadErrorMessage(null);
    try {
      const rows = await db.select().from(userProfile).limit(1);
      const row = rows[0];
      if (row != null) {
        const next: ProfileValues = {
          id: row.id,
          sex: row.sex,
          bodyweightKg: row.bodyweightKg,
          thresholdHr: row.thresholdHr,
          thresholdPaceSecPerKm: row.thresholdPaceSecPerKm,
          units: (row.units ?? 'metric') as Units,
          restTimerDefaultSec: row.restTimerDefaultSec ?? 120,
        };
        setProfile(next);
        setUnits(next.units);
      }
    } catch (err: unknown) {
      // Raw error logged for developer diagnostics only — never rendered (T-03-08).
      // WR-07: surface a generic load-error state so callers can show a retry action
      // instead of an indefinite spinner.
      console.error('[Apsis] useProfile select failed:', err);
      setLoadErrorMessage(LOAD_ERROR_MESSAGE);
    } finally {
      setLoading(false);
    }
  }, [setUnits]);

  useEffect(() => {
    load();
  }, [load]);

  async function update(patch: ProfileUpdateInput): Promise<boolean> {
    if (profile == null || Object.keys(patch).length === 0) return false;
    setSubmitting(true);
    setErrorMessage(null);
    try {
      // Edits-forward only (D-05): this UPDATE targets user_profile exclusively, scoped
      // by the mandatory single-row id. It must never write to strength_set.stressScore,
      // endurance_segment.stressScore, workout.hss, or load_daily — those are recomputed
      // only from logged sets/segments, never rewritten by a profile edit.
      await db.update(userProfile).set(patch).where(eq(userProfile.id, profile.id));
      const next: ProfileValues = { ...profile, ...patch };
      setProfile(next);
      if (patch.units != null) setUnits(patch.units);
      return true;
    } catch (err: unknown) {
      console.error('[Apsis] useProfile update failed:', err);
      setErrorMessage(UPDATE_ERROR_MESSAGE);
      return false;
    } finally {
      setSubmitting(false);
    }
  }

  return { profile, loading, submitting, errorMessage, loadErrorMessage, reload: load, update };
}
