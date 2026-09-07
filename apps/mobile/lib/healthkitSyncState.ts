/**
 * apps/mobile/lib/healthkitSyncState.ts
 *
 * Drizzle-backed accessor for the four HealthKit sync-state columns on the single
 * `user_profile` row: `healthkitConnected` (D-19/D-21), `healthkitAnchor` (D-02 Pattern 2),
 * `healthkitLastSyncAt` (D-24), and `bodyweightSetAt` (D-17). Called from `healthkitImport.ts`
 * and `useForegroundHealthKitSync.ts` (later plans in this phase) — this file itself performs
 * no HealthKit I/O of its own.
 *
 * Mirrors `useSaveProfile.ts`'s try/catch + console.error + generic-failure discipline, but as
 * plain async functions (not hooks), since these are called from non-component sync code. Per
 * D-25, a sync-state write failure must NEVER throw to the UI — it's caught, logged (Error
 * object only, T-05-01 — never raw bodyweight/HR values), and reported as a boolean/`null` so
 * the caller can treat it like any other silent HK failure (the next foreground sync retries
 * naturally, since a failed write means `healthkitLastSyncAt`/`healthkitAnchor` never advance).
 *
 * Uses parameterized drizzle builders exclusively (`eq` on the single-row id) — never a raw
 * `sql` template with an interpolated value (T-1-01).
 */

import { eq } from 'drizzle-orm';
import { userProfile, type DB } from '@apsis/db';

export interface HealthKitSyncState {
  id: number;
  healthkitConnected: boolean;
  healthkitAnchor: string | null;
  healthkitLastSyncAt: Date | null;
  bodyweightSetAt: Date | null;
}

export interface HealthKitSyncStatePatch {
  healthkitConnected?: boolean;
  healthkitAnchor?: string | null;
  healthkitLastSyncAt?: Date | null;
  bodyweightSetAt?: Date | null;
}

/**
 * Reads the single `user_profile` row's HK sync-state columns. Returns `null` if no profile
 * row exists yet (pre-onboarding) or on any read failure — logged (Error object only), never
 * thrown (D-25).
 */
export async function getSyncState(database: DB): Promise<HealthKitSyncState | null> {
  try {
    const rows = await database
      .select({
        id: userProfile.id,
        healthkitConnected: userProfile.healthkitConnected,
        healthkitAnchor: userProfile.healthkitAnchor,
        healthkitLastSyncAt: userProfile.healthkitLastSyncAt,
        bodyweightSetAt: userProfile.bodyweightSetAt,
      })
      .from(userProfile)
      .limit(1);
    const row = rows[0];
    if (row == null) return null;
    return {
      id: row.id,
      healthkitConnected: row.healthkitConnected ?? false,
      healthkitAnchor: row.healthkitAnchor,
      healthkitLastSyncAt: row.healthkitLastSyncAt,
      bodyweightSetAt: row.bodyweightSetAt,
    };
  } catch (err: unknown) {
    console.error('[Apsis] healthkitSyncState getSyncState failed:', err);
    return null;
  }
}

/**
 * Writes `patch` onto the single `user_profile` row via a parameterized `eq` on `id`
 * (T-1-01). Per D-25, a write failure must never throw to the UI — it's caught, logged
 * (Error object only), and reported as `false`. Also returns `false` (logged, no-op) if no
 * profile row exists yet — sync state has nothing to attach to before onboarding completes.
 */
export async function setSyncState(database: DB, patch: HealthKitSyncStatePatch): Promise<boolean> {
  if (Object.keys(patch).length === 0) return true;
  try {
    const rows = await database.select({ id: userProfile.id }).from(userProfile).limit(1);
    const row = rows[0];
    if (row == null) {
      console.error('[Apsis] healthkitSyncState setSyncState failed: no user_profile row exists yet');
      return false;
    }
    await database.update(userProfile).set(patch).where(eq(userProfile.id, row.id));
    return true;
  } catch (err: unknown) {
    console.error('[Apsis] healthkitSyncState setSyncState failed:', err);
    return false;
  }
}
