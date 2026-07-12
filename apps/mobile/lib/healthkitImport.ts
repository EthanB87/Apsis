/**
 * apps/mobile/lib/healthkitImport.ts
 *
 * The HealthKit import engine (HK-01/HK-02/HK-03): an anchored batch sync that pulls Apple
 * Health workouts + the most-recent bodyweight sample into Apsis, mirroring `runEntry.ts`'s
 * insert -> HSS -> recompute shape but at BATCH scope (Pitfall 10) — every non-duplicate
 * sample is inserted first, `recomputeLoadDaily` runs exactly ONCE after the loop, not per row.
 *
 * Flow per `runHealthKitSync(db, { initial })`:
 *   1. Read the stored anchor/bodyweight-set-at via `healthkitSyncState.getSyncState` (D-02/D-17).
 *   2. Query workouts via `queryWorkoutSamplesWithAnchor` — a `NOT: [{ sources: [...] }]` filter
 *      excludes Apsis's own write-backs (D-11 primary echo defense, Pitfall 8) and, whenever no
 *      anchor exists yet (initial connect OR a retry after a failed initial import, CR-03), a
 *      90-day `date.startDate` window (D-01) bounds the query.
 *   3. For each sample: map its activity type (D-04/D-05, `healthkitMapping.mapHKActivityType`,
 *      skip null), sanitize duration/distance/HR (V5/T-05-02, `sanitizeHKNumeric`), then consult
 *      `candidatesForDedupe` for BOTH: (a) a healthkitUuid tombstone match against ANY existing
 *      row for that day+type — including soft-deleted ones (D-11 second layer, Pitfall 8/9,
 *      deleted-imports-stay-deleted) — and (b) a duration-tolerance match against only the
 *      *manual* candidates (D-06/D-07 manual wins; restricting the tolerance check to
 *      `source === 'manual'` rows avoids two same-day, similar-duration real HK sessions
 *      false-positive-skipping each other — classified by provenance, never by
 *      `healthkitUuid` nullability, since manual rows carry Apsis's write-back uuid).
 *   4. Non-duplicates are inserted as `workout(source: 'healthkit', healthkitUuid: <uuid>)` +
 *      `endurance_segment`, IF resolved via the existing `resolveRunSegment` (pace gated to
 *      `activityType === 'run'` only, Pitfall 6/T-04-10 — same rule `runEntry.ts` already
 *      follows), HSS written via `sessionHSSDetailed` — WITHOUT a recompute call per row.
 *   5. `recomputeLoadDaily(db)` runs exactly once after the loop (Pitfall 10 — the function
 *      re-reads/folds the *entire* `workout` table every call; calling it per-row would turn
 *      the 90-day initial import into an O(n^2) full-table-scan operation).
 *   6. The most-recent HK bodyweight sample is pulled (D-16) and, if newer than the profile's
 *      `bodyweightSetAt` (D-17, `bodyweightSampleIsNewer` — sample time, NOT import time),
 *      `user_profile.bodyweightKg`/`bodyweightSetAt` are updated.
 *   7. `newAnchor` + `healthkitLastSyncAt` are persisted via `setSyncState` ONLY on this
 *      function's success path (D-25) — a thrown error at any earlier step means this call is
 *      skipped, so the anchor is left unadvanced and the next foreground sync retries the same
 *      window naturally. No error banners; failures are silent per D-25.
 *
 * Security (T-05-01, Information Disclosure — mitigate): every log statement here interpolates
 * only counts, booleans, `Error` objects, or clamp-warning strings from `sanitizeHKNumeric` —
 * never a raw bodyweight/HR/distance sample value (matches the existing `runEntry.ts`/
 * `recomputeLoadDaily.ts` convention). Security (T-05-05/T-1-01): every query/insert here is a
 * parameterized drizzle builder — no raw `sql` template literal with an interpolated value.
 */

import { randomUUID } from 'expo-crypto';
import {
  currentAppSource,
  getMostRecentQuantitySample,
  queryWorkoutSamplesWithAnchor,
} from '@kingstinct/react-native-healthkit';
import { candidatesForDedupe, enduranceSegment, userProfile, workout, type DB } from '@apsis/db';
import { sessionHSSDetailed } from '@apsis/engine';
import { eq } from 'drizzle-orm';
import { dateToLocalDateStr } from './localDate';
import { recomputeLoadDaily } from './recomputeLoadDaily';
import { resolveRunSegment } from './runEntryLogic';
import {
  bodyweightSampleIsNewer,
  isDuplicateOfExisting,
  mapHKActivityType,
  sanitizeHKNumeric,
} from './healthkitMapping';
import { getSyncState, setSyncState } from './healthkitSyncState';

/** D-01: initial connect reaches back 90 days; every foreground sync after that is anchor-only. */
const INITIAL_IMPORT_WINDOW_DAYS = 90;

/**
 * V5/T-05-02 discretion bounds — generous sanity ranges for hostile/corrupted HK numerics, not
 * domain-tuned limits (the engine's own `enduranceStressDetailed`/`resolveIF` separately clamp
 * duration >= 0 and IF into [0.3, 1.3] once resolved). A workout longer than 48h, a single-
 * session distance over 500km, or an average HR outside [0, 250] bpm is not physiologically
 * real and is clamped/discarded here before it can reach dedupe, the engine, or SQLite.
 */
const MAX_DURATION_S = 48 * 60 * 60;
const MAX_DISTANCE_M = 500_000;
const MIN_HR_BPM = 0;
const MAX_HR_BPM = 250;
const MIN_BODYWEIGHT_KG = 20;
const MAX_BODYWEIGHT_KG = 400;

export interface HealthKitSyncSummary {
  /** Count of newly inserted (non-duplicate) sessions this batch — feeds 05-09's TODAY notice. */
  importedCount: number;
  bodyweightUpdated: boolean;
}

export interface RunHealthKitSyncOptions {
  /** true = first connection (90-day date window, anchor undefined); false = foreground delta sync. */
  initial: boolean;
}

/**
 * The mandatory user_profile row's endurance thresholds — mirrors `runEntry.ts`'s private
 * `fetchThresholds` helper exactly (that function is not exported there, so it is duplicated
 * here rather than introducing a cross-cutting refactor outside this plan's declared files).
 */
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
 * Anchored batch sync: imports new/qualifying HK workouts and the most-recent bodyweight
 * sample, deduped and echo-excluded, recomputing `load_daily` exactly once. Never throws away
 * errors — logs (Error object only, T-05-01) then re-throws (mirrors `saveRun`/
 * `recomputeLoadDaily`'s convention) so the caller (`useForegroundHealthKitSync`) can apply
 * D-25's silent-failure UX without this function itself swallowing the failure.
 */
export async function runHealthKitSync(
  database: DB,
  options: RunHealthKitSyncOptions
): Promise<HealthKitSyncSummary> {
  try {
    const syncState = await getSyncState(database);
    const anchor = options.initial ? undefined : (syncState?.healthkitAnchor ?? undefined);

    // CR-03/D-01: the 90-day window applies whenever there is NO anchor — not only when
    // `options.initial` is true. A failed initial import never persists its anchor (D-25
    // success-path-only setSyncState below), so the natural foreground-sync retry arrives
    // here with `initial: false` AND `anchor: undefined`; without this guard that query
    // would be fully unbounded and import the user's entire HealthKit history.
    let dateStart: Date | undefined;
    if (anchor == null) {
      dateStart = new Date();
      dateStart.setDate(dateStart.getDate() - INITIAL_IMPORT_WINDOW_DAYS);
    }

    const { workouts, newAnchor } = await queryWorkoutSamplesWithAnchor({
      limit: 0, // 0 = fetch all matching (verified .d.ts comment)
      anchor,
      filter: {
        // D-11 primary echo defense — never re-import Apsis's own write-backs.
        NOT: [{ sources: [currentAppSource()] }],
        ...(dateStart != null ? { date: { startDate: dateStart } } : {}),
      },
    });

    const thresholds = await fetchThresholds(database);

    let importedCount = 0;
    for (const sample of workouts) {
      const activityType = mapHKActivityType(sample.workoutActivityType);
      if (activityType == null) continue; // D-05 strength / unknown type — never imported

      const localDate = dateToLocalDateStr(sample.startDate);

      const durationResult = sanitizeHKNumeric(
        sample.duration?.quantity,
        { min: 0, max: MAX_DURATION_S },
        'workout duration'
      );
      if (durationResult.warnings.length > 0) {
        console.warn('[Apsis] healthkitImport duration sanitize:', durationResult.warnings);
      }
      if (durationResult.value == null) {
        console.warn('[Apsis] healthkitImport skipped sample with invalid duration');
        continue;
      }
      const durationS = durationResult.value;

      const distanceResult = sanitizeHKNumeric(
        sample.totalDistance?.quantity,
        { min: 0, max: MAX_DISTANCE_M },
        'workout distance'
      );
      if (distanceResult.warnings.length > 0) {
        console.warn('[Apsis] healthkitImport distance sanitize:', distanceResult.warnings);
      }
      const distanceM = distanceResult.value ?? undefined;

      let avgHr: number | undefined;
      try {
        const stat = await sample.getStatistic('HKQuantityTypeIdentifierHeartRate', 'count/min');
        const hrResult = sanitizeHKNumeric(
          stat?.averageQuantity?.quantity,
          { min: MIN_HR_BPM, max: MAX_HR_BPM },
          'workout avg HR'
        );
        if (hrResult.warnings.length > 0) {
          console.warn('[Apsis] healthkitImport avg HR sanitize:', hrResult.warnings);
        }
        avgHr = hrResult.value ?? undefined;
      } catch (err: unknown) {
        console.warn('[Apsis] healthkitImport getStatistic(HeartRate) failed:', err);
      }

      // D-06/D-07/Pitfall 8/9: one query covers both the manual-duplicate tolerance check and
      // the healthkitUuid tombstone check (deliberately NOT filtered by deletedAt — see
      // `candidatesForDedupe`'s own doc comment).
      const candidates = await candidatesForDedupe(database, localDate, activityType);
      const isTombstoned = candidates.some((c) => c.healthkitUuid === sample.uuid);
      // CR-01: classify manual rows by provenance (`source === 'manual'`), NEVER by
      // `healthkitUuid == null` — a manual run gains Apsis's own write-back uuid the moment
      // HealthKit is connected (schema.ts `healthkitUuid` doc), so a uuid-null check would
      // exclude every written-back manual run from the D-06/D-07 tolerance check and let the
      // matching watch sample import as a duplicate session (double-counting day HSS).
      const isManualDuplicate = candidates
        .filter((c) => c.source === 'manual')
        .some((c) => isDuplicateOfExisting(durationS, c.durationS));
      if (isTombstoned || isManualDuplicate) {
        console.warn('[Apsis] healthkitImport skipped duplicate sample:', {
          tombstoned: isTombstoned,
          manualDuplicate: isManualDuplicate,
        });
        continue;
      }

      const { intensityFactor, es, warnings } = resolveRunSegment({
        activityType,
        durationS,
        distanceM,
        avgHr,
        thresholdHr: thresholds.thresholdHr,
        thresholdPaceSecPerKm: thresholds.thresholdPaceSecPerKm,
      });
      if (warnings.length > 0) {
        console.warn('[Apsis] healthkitImport resolveIF/enduranceStress warnings:', warnings);
      }

      const workoutId = randomUUID();
      const { hss } = sessionHSSDetailed({
        enduranceSegments: [{ durationS, intensityFactor }],
      });

      // WR-01: the three per-sample writes commit atomically — a mid-sequence failure must
      // never leave a segment-less `workout` row behind. Such an orphan is invisible to
      // `candidatesForDedupe` (inner join on endurance_segment), so its uuid would not
      // tombstone and the next sync (anchor unadvanced on failure) would re-import the same
      // sample as a duplicate.
      await database.transaction(async (tx) => {
        await tx.insert(workout).values({
          id: workoutId,
          localDate,
          type: 'endurance',
          // D-14: imported sessions are already complete — finishedAt is the sample's own end time.
          finishedAt: sample.endDate,
          source: 'healthkit',
          healthkitUuid: sample.uuid,
        });

        await tx.insert(enduranceSegment).values({
          id: randomUUID(),
          workoutId,
          activityType,
          distanceM: distanceM ?? null,
          durationS,
          avgHr: avgHr ?? null,
          intensityFactor,
          stressScore: es,
        });

        await tx.update(workout).set({ hss }).where(eq(workout.id, workoutId));
      });

      importedCount++;
    }

    // Pitfall 10: recompute exactly once for the whole batch, after every insert above.
    await recomputeLoadDaily(database);

    // D-16/D-17: pull the most-recent HK bodyweight sample and update the profile only if it's
    // newer than the last recorded bodyweightSetAt (sample's own startDate, not import time).
    let bodyweightUpdated = false;
    if (syncState != null) {
      const bwSample = await getMostRecentQuantitySample('HKQuantityTypeIdentifierBodyMass', 'kg');
      if (bwSample != null && bodyweightSampleIsNewer(bwSample.startDate, syncState.bodyweightSetAt)) {
        const bwResult = sanitizeHKNumeric(
          bwSample.quantity,
          { min: MIN_BODYWEIGHT_KG, max: MAX_BODYWEIGHT_KG },
          'bodyweight'
        );
        if (bwResult.warnings.length > 0) {
          console.warn('[Apsis] healthkitImport bodyweight sanitize:', bwResult.warnings);
        }
        if (bwResult.value != null) {
          await database
            .update(userProfile)
            .set({ bodyweightKg: bwResult.value, bodyweightSetAt: bwSample.startDate })
            .where(eq(userProfile.id, syncState.id));
          bodyweightUpdated = true;
        }
      }
    }

    // D-25: persist the new anchor/last-sync-at ONLY now that the entire batch has succeeded —
    // any earlier throw skips this call, leaving the anchor unadvanced so the next foreground
    // sync retries the same window.
    await setSyncState(database, { healthkitAnchor: newAnchor, healthkitLastSyncAt: new Date() });

    return { importedCount, bodyweightUpdated };
  } catch (err: unknown) {
    console.error('[Apsis] healthkitImport runHealthKitSync failed:', err);
    throw err;
  }
}
