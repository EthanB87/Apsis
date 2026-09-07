/**
 * apps/mobile/lib/runEntry.ts
 *
 * The run/erg/conditioning save handler (RUN-01..05): a single-screen "log a run in under a
 * minute" write path, mirroring `commitSet.ts`'s persist-then-recompute shape but at SESSION
 * (not per-set) scope, since an endurance session is complete on save - no open-session
 * lifecycle like lifting (D-13 in RESEARCH). Steps: read profile thresholds, resolve the
 * segment's intensity factor (gated per activity type - Pitfall 6/T-04-10, see
 * `runEntryLogic.ts`), insert the finished `workout` + `endurance_segment` rows, write the
 * session HSS, then recompute `load_daily` so Home reflects the new session immediately, then
 * `recomputeNutritionTarget` (Plan 07-05, NUTR-16/17) so today's adaptive target folds in this
 * session's fresh `dayHss`.
 *
 * HealthKit write-back (HK-04/D-12): after a successful save, if HealthKit is connected
 * (`getSyncState`), fires a fire-and-forget `writeBackRun` tail and stores the returned
 * sample uuid on the workout row. This tail can never fail the save itself (D-25) - it runs
 * after `recomputeLoadDaily`, outside the function's own try/catch-and-rethrow scope, and its
 * own internal errors are already swallowed by `healthkitWriteback.ts` (never rethrown there).
 * `startedAt` is back-computed as `finishedAt - durationS` since endurance sessions are
 * complete-on-save and carry no separate begin timestamp (RESEARCH D-13).
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
import { getSyncState } from './healthkitSyncState';
import { writeBackRun } from './healthkitWriteback';
import { dateToLocalDateStr, todayLocalDate } from './localDate';
import { recomputeLoadDaily } from './recomputeLoadDaily';
import { recomputeNutritionTarget } from './recomputeNutritionTarget';
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
 *
 * HK-04/D-12: once the save + recompute above have fully succeeded, gates a fire-and-forget
 * HealthKit write-back on `healthkitConnected` (go-forward only, D-15). The write-back tail
 * itself never throws (`healthkitWriteback.ts` swallows its own errors) and any failure in the
 * follow-up `healthkitUuid` UPDATE is caught locally - neither can fail this function or its
 * already-returned `workoutId`.
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
    // Endurance sessions are complete on save - no open-session lifecycle (RESEARCH D-13).
    const finishedAt = new Date();
    await database.insert(workout).values({
      id: workoutId,
      localDate: input.localDate,
      type: 'endurance',
      note: input.note ?? null,
      finishedAt,
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
    // WR-03: best-effort tail — the workout/segment rows are already persisted above, so a
    // thrown nutrition recompute would fail the whole save and the user's natural retry would
    // insert a DUPLICATE session. Core logging must never depend on the nutrition feature
    // ("if everything else fails, this must work"); the nutrition TODAY screen's lazy-compute
    // fallback self-heals a missed recompute on next focus.
    try {
      await recomputeNutritionTarget(database, todayLocalDate());
    } catch (err: unknown) {
      console.error('[Apsis] nutrition target recompute failed (non-fatal):', err);
    }

    // HK-04/D-12: fire-and-forget write-back tail - never awaited in a way that can fail the
    // save; `getSyncState`/`writeBackRun` both already swallow their own errors internally.
    const syncState = await getSyncState(database);
    if (syncState?.healthkitConnected) {
      // Endurance sessions carry no separate begin timestamp (complete-on-save, D-13), so the
      // HK sample's start is back-computed from the save moment minus the logged duration.
      // WR-08: for a BACK-DATED entry (D-13 date picker), the save moment is the wrong day —
      // anchor the sample to noon local on the logged `localDate` instead, so the workout
      // lands on the correct calendar day in the user's Health record (consistent with the
      // Apsis row it mirrors).
      let startedAt: Date;
      if (input.localDate === dateToLocalDateStr(finishedAt)) {
        startedAt = new Date(finishedAt.getTime() - input.durationS * 1000);
      } else {
        const [year, month, day] = input.localDate.split('-').map((part) => Number.parseInt(part, 10));
        startedAt = new Date(year ?? 1970, (month ?? 1) - 1, day ?? 1, 12, 0, 0);
      }
      writeBackRun(input.distanceM, input.durationS, hss, startedAt)
        .then(async (hkUuid) => {
          if (hkUuid != null) {
            await database.update(workout).set({ healthkitUuid: hkUuid }).where(eq(workout.id, workoutId));
          }
        })
        .catch((err: unknown) => {
          console.error('[Apsis] saveRun HealthKit write-back tail failed:', err); // D-25 — never blocks the save
        });
    }

    return workoutId;
  } catch (err: unknown) {
    console.error('[Apsis] saveRun failed:', err);
    throw err;
  }
}
