/**
 * apps/mobile/lib/runEntry.ts
 *
 * The run/erg/conditioning save handler (RUN-01..05): a single-screen "log a run in under a
 * minute" write path, mirroring `commitSet.ts`'s persist-then-recompute shape but at SESSION
 * (not per-set) scope, since an endurance session is complete on save - no open-session
 * lifecycle like lifting (D-13 in RESEARCH). Steps: read profile thresholds, resolve the
 * segment's intensity factor (gated per activity type - Pitfall 6/T-04-10, see
 * `runEntryLogic.ts`), insert the finished `workout` + `endurance_segment` rows, write the
 * session HSS, then recompute `load_daily` so Home reflects the new session immediately.
 *
 * Security (T-04-08/T-1-01): every query here is a parameterized drizzle builder - no raw
 * `sql` template literals with interpolated user-supplied values; `note` is stored as a bound
 * value. Errors are console.error'd for diagnostics then re-thrown (T-04-09) - the caller
 * shows a generic, hardcoded message, never the raw error.
 */

import { randomUUID } from 'expo-crypto';
import { enduranceSegment, userProfile, workout, type DB } from '@apsis/db';
import { sessionHSSDetailed } from '@apsis/engine';
import { eq } from 'drizzle-orm';
import { recomputeLoadDaily } from './recomputeLoadDaily';
import { resolveRunSegment, type RunActivityType } from './runEntryLogic';

export interface RunEntryInput {
  activityType: RunActivityType;
  distanceM?: number;
  durationS: number;
  avgHr?: number;
  note?: string;
  localDate: string;
}

/** The mandatory user_profile row's endurance thresholds - null when never set in onboarding
 * (a profile always exists past the onboarding gate, D-01, but thresholds are optional). */
async function fetchThresholds(
  database: DB
): Promise<{ thresholdHr: number | null; thresholdPaceSecPerKm: number | null }> {
  const rows = await database
    .select({
      thresholdHr: userProfile.thresholdHr,
      thresholdPaceSecPerKm: userProfile.thresholdPaceSecPerKm,
    })
    .from(userProfile)
    .limit(1);
  const row = rows[0];
  return {
    thresholdHr: row?.thresholdHr ?? null,
    thresholdPaceSecPerKm: row?.thresholdPaceSecPerKm ?? null,
  };
}

/**
 * Persists a finished endurance session (run/erg/conditioning) and returns the new
 * `workoutId`. Resolves the segment's intensity factor via `resolveRunSegment` (pace gated to
 * `activityType === 'run'` only, Pitfall 6/T-04-10), writes `workout.hss` via
 * `sessionHSSDetailed`, then awaits `recomputeLoadDaily` so Home's ring/band/trend reflect the
 * new session immediately. Never throws away errors - re-throws after logging (T-04-09) so
 * the caller can show its own generic message.
 */
export async function saveRun(database: DB, input: RunEntryInput): Promise<string> {
  try {
    const thresholds = await fetchThresholds(database);

    const { intensityFactor, es, warnings } = resolveRunSegment({
      activityType: input.activityType,
      durationS: input.durationS,
      distanceM: input.distanceM,
      avgHr: input.avgHr,
      thresholdHr: thresholds.thresholdHr,
      thresholdPaceSecPerKm: thresholds.thresholdPaceSecPerKm,
    });
    if (warnings.length > 0) {
      console.warn('[Apsis] saveRun resolveIF/enduranceStress warnings:', warnings);
    }

    const workoutId = randomUUID();
    await database.insert(workout).values({
      id: workoutId,
      localDate: input.localDate,
      type: 'endurance',
      note: input.note ?? null,
      // Endurance sessions are complete on save - no open-session lifecycle (RESEARCH D-13).
      finishedAt: new Date(),
    });

    await database.insert(enduranceSegment).values({
      id: randomUUID(),
      workoutId,
      activityType: input.activityType,
      distanceM: input.distanceM ?? null,
      durationS: input.durationS,
      avgHr: input.avgHr ?? null,
      intensityFactor,
      stressScore: es,
    });

    const { hss } = sessionHSSDetailed({
      enduranceSegments: [{ durationS: input.durationS, intensityFactor }],
    });
    await database.update(workout).set({ hss }).where(eq(workout.id, workoutId));

    await recomputeLoadDaily(database);

    return workoutId;
  } catch (err: unknown) {
    console.error('[Apsis] saveRun failed:', err);
    throw err;
  }
}
