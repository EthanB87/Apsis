/**
 * apps/mobile/hooks/useSaveProfile.ts
 *
 * Inserts the user_profile row via a parameterized drizzle builder (T-1-01) from the
 * onboarding review screen's Save (D-04/ONB-01). On success, bumps the shared
 * `useProfileVersion` counter (Plan 05 deviation, see lib/profileVersion.ts) so
 * `useProfileExists` re-queries and Plan 04's Stack.Protected gate flips from
 * onboarding to the tab shell without an app relaunch.
 *
 * Security (V7/T-1-02, T-03-11): the raw error is console.error'd for developer
 * diagnostics only; the UI-SPEC's hardcoded generic string is the only user-facing
 * error surface — never the raw error object, message, or file paths. Never logs
 * raw bodyweight/HR/pace values.
 *
 * Insert-only in this plan (first-time onboarding, no existing row). Plan 09's
 * Settings editor reuses `ProfileReview` and will extend this pattern with an
 * update-in-place path against an existing profile row.
 */

import { useState } from 'react';
import { db, userProfile } from '@apsis/db';
import type { Sex, Units } from '@apsis/shared';
import { useProfileVersion } from '../lib/profileVersion';

const SAVE_ERROR_MESSAGE = "Couldn't save your profile. Check available storage and try again.";

export interface SaveProfileInput {
  sex: Sex;
  bodyweightKg: number;
  thresholdHr: number;
  thresholdPaceSecPerKm: number;
  units: Units;
}

export interface UseSaveProfileResult {
  submitting: boolean;
  errorMessage: string | null;
  save: (input: SaveProfileInput) => Promise<boolean>;
}

export function useSaveProfile(): UseSaveProfileResult {
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const bumpProfileVersion = useProfileVersion((state) => state.bump);

  async function save(input: SaveProfileInput): Promise<boolean> {
    setSubmitting(true);
    setErrorMessage(null);
    try {
      await db.insert(userProfile).values({
        sex: input.sex,
        bodyweightKg: input.bodyweightKg,
        thresholdHr: input.thresholdHr,
        thresholdPaceSecPerKm: input.thresholdPaceSecPerKm,
        units: input.units,
      });
      bumpProfileVersion();
      return true;
    } catch (err: unknown) {
      // Raw error logged for developer diagnostics only — never rendered (T-03-11).
      console.error('[Apsis] useSaveProfile insert failed:', err);
      setErrorMessage(SAVE_ERROR_MESSAGE);
      return false;
    } finally {
      setSubmitting(false);
    }
  }

  return { submitting, errorMessage, save };
}
