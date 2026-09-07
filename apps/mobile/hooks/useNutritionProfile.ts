/**
 * apps/mobile/hooks/useNutritionProfile.ts
 *
 * Reads the singleton `user_profile` row (mirroring `useProfile.ts`'s single-row read shape)
 * and assembles a typed `NutritionProfile` via the pure `buildNutritionProfile`/
 * `isNutritionProfileComplete` helpers (`lib/nutritionProfile.ts`). Depends on
 * `useProfileVersion` so it re-reads after the nutrition-setup screen's batched UPDATE bumps
 * the signal — the NUTR-20 gate clears without an app relaunch, mirroring
 * `useProfileExists.ts`'s existing re-check pattern. `currentYear` is computed here (the
 * impure hook layer), never inside the pure lib module (RESEARCH.md Pitfall 2/3).
 *
 * Security (V7/T-1-02): query failures are console.error'd for developer diagnostics only;
 * on failure this resolves to `{ profile: null, complete: false }` — the safe default routes
 * back to the Nutrition Setup prompt rather than risking a NULL-derived target.
 */

import { useEffect, useState } from 'react';
import { db, userProfile } from '@apsis/db';
import type { NutritionProfile } from '@apsis/shared';
import { buildNutritionProfile, isNutritionProfileComplete, type NutritionProfileRow } from '../lib/nutritionProfile';
import { useProfileVersion } from '../lib/profileVersion';

export interface UseNutritionProfileResult {
  profile: NutritionProfile | null;
  complete: boolean;
  loading: boolean;
}

export function useNutritionProfile(): UseNutritionProfileResult {
  const [row, setRow] = useState<NutritionProfileRow | null>(null);
  const [loading, setLoading] = useState(true);
  const version = useProfileVersion((state) => state.version);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    db.select({
      sex: userProfile.sex,
      bodyweightKg: userProfile.bodyweightKg,
      heightCm: userProfile.heightCm,
      birthYear: userProfile.birthYear,
      goalMode: userProfile.goalMode,
    })
      .from(userProfile)
      .limit(1)
      .then((rows) => {
        if (cancelled) return;
        setRow(rows[0] ?? null);
      })
      .catch((err: unknown) => {
        console.error('[Apsis] useNutritionProfile select failed:', err);
        if (!cancelled) setRow(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [version]);

  const currentYear = new Date().getFullYear();
  const complete = row != null && isNutritionProfileComplete(row);
  const profile = row != null ? buildNutritionProfile(row, currentYear) : null;

  return { profile, complete, loading };
}
