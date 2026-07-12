/**
 * apps/mobile/hooks/useSaveProfile.ts
 *
 * Inserts the user_profile row via a parameterized drizzle builder (T-1-01) from the
 * onboarding review screen's Save (D-04/ONB-01).
 *
 * Phase 05 (05-07, Pitfall 2 fix): this hook no longer bumps `useProfileVersion` on
 * success. Doing so here used to flip Plan 04's `Stack.Protected` gate to the tab shell
 * the instant the row was inserted, racing past the new terminal HealthKit onboarding
 * step (D-23) before it could ever be shown. The bump now happens in that step's own
 * "Connect Apple Health"/"Not now" handlers (see app/onboarding/healthkit.tsx) — both
 * paths bump it, since declining still completes onboarding (D-20). `review.tsx`'s
 * `handleSubmit` explicitly `router.push`es to `/onboarding/healthkit` after a
 * successful `save()` instead of relying on this hook/the gate to navigate.
 *
 * Security (V7/T-1-02, T-03-11): the raw error is console.error'd for developer
 * diagnostics only; the UI-SPEC's hardcoded generic string is the only user-facing
 * error surface — never the raw error object, message, or file paths. Never logs
 * raw bodyweight/HR/pace values.
 *
 * WR-09: defensively upserts against the singleton user_profile row — if a row already
 * exists (a re-invoked save() after navigating back into onboarding), it is UPDATEd in
 * place rather than INSERTed a second time, since duplicate profile rows make every
 * `.limit(1)` reader (useProfile, getSyncState, fetchThresholds) nondeterministic.
 */

import { useState } from 'react';
import { eq } from 'drizzle-orm';
import { db, userProfile } from '@apsis/db';
import type { Sex, Units } from '@apsis/shared';

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

  async function save(input: SaveProfileInput): Promise<boolean> {
    setSubmitting(true);
    setErrorMessage(null);
    try {
      const values = {
        sex: input.sex,
        bodyweightKg: input.bodyweightKg,
        // CR-02/D-17: stamp the manual entry time — a null bodyweightSetAt makes
        // bodyweightSampleIsNewer(x, null) true for ANY HK sample, letting a months-old
        // body-mass sample overwrite the value the user typed minutes ago in onboarding.
        bodyweightSetAt: new Date(),
        thresholdHr: input.thresholdHr,
        thresholdPaceSecPerKm: input.thresholdPaceSecPerKm,
        units: input.units,
      };
      // WR-09: user_profile is a singleton — if a row already exists (e.g. save() re-invoked
      // after navigating back into onboarding), UPDATE it in place. A second INSERT would
      // create two profile rows, and every reader uses `.limit(1)` with no ORDER BY, so which
      // row wins would be undefined (sync state and thresholds could split across rows).
      const existing = await db.select({ id: userProfile.id }).from(userProfile).limit(1);
      const existingRow = existing[0];
      if (existingRow != null) {
        await db.update(userProfile).set(values).where(eq(userProfile.id, existingRow.id));
      } else {
        await db.insert(userProfile).values(values);
      }
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
