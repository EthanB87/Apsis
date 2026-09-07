/**
 * apps/mobile/lib/healthkitWriteback.ts
 *
 * Writes Apsis-authored sessions back to Apple Health (HK-04) and deletes our own
 * previously-written samples on discard. Implements D-12 (fire-and-forget, immediate on
 * save/finish), D-13 (basics + ApsisHSS metadata, explicitly NO calorie/energy fields),
 * D-14 (delete our authored sample on soft-delete), and D-15 (go-forward only — no
 * backfill of pre-existing sessions is performed here or anywhere else).
 *
 * Security/never-block (D-25): every native call in this file is wrapped in a try/catch
 * that logs the caught `Error` object only (never raw HSS/distance/duration values,
 * T-05-01) and returns `undefined`/does nothing on failure — this file NEVER rethrows.
 * This is the one place in the codebase where a caught error is deliberately swallowed
 * rather than re-thrown, in direct contrast to `saveRun`/`recomputeLoadDaily`'s
 * log-then-rethrow convention — callers must not `await` these calls in a way that could
 * fail the local save/finish/discard.
 */

import {
  deleteObjects,
  saveWorkoutSample,
  WorkoutActivityType,
  WorkoutTypeIdentifier,
} from '@kingstinct/react-native-healthkit';
import { buildHSSMetadata } from './healthkitMapping';

/**
 * D-12/D-13: writes a finished run/erg/conditioning session to Health as a running
 * workout with distance+duration totals (raw meters — Pitfall 4, NEVER pass a
 * km/mi-display-converted value here) and the ApsisHSS metadata key. No calorie/energy
 * field is ever included (D-13). Returns the created sample's uuid, or `undefined` if
 * the write failed (caller should skip storing a uuid in that case).
 */
export async function writeBackRun(
  distanceM: number | undefined,
  durationS: number,
  hss: number,
  startedAt: Date,
): Promise<string | undefined> {
  try {
    const endDate = new Date(startedAt.getTime() + durationS * 1000);
    const sample = await saveWorkoutSample(
      WorkoutActivityType.running,
      [], // D-13: no associated quantity samples — totals covers distance
      startedAt,
      endDate,
      distanceM != null ? { distance: distanceM } : undefined, // RAW METERS (Pitfall 4) — no km/mi conversion
      buildHSSMetadata(hss),
    );
    return sample.uuid;
  } catch (err: unknown) {
    console.error('[Apsis] HealthKit writeBackRun failed:', err); // D-12/D-25 — never rethrow, never block save
    return undefined;
  }
}

/**
 * D-12/D-13: writes a finished lifting session to Health as a traditional strength
 * training workout with duration only (lifting has no distance) and the ApsisHSS
 * metadata key. No calorie/energy field is ever included (D-13). Returns the created
 * sample's uuid, or `undefined` if the write failed.
 */
export async function writeBackLift(
  durationS: number,
  hss: number,
  startedAt: Date,
): Promise<string | undefined> {
  try {
    const endDate = new Date(startedAt.getTime() + durationS * 1000);
    const sample = await saveWorkoutSample(
      WorkoutActivityType.traditionalStrengthTraining,
      [], // D-13: no associated quantity samples
      startedAt,
      endDate,
      undefined, // lifting has no distance total
      buildHSSMetadata(hss),
    );
    return sample.uuid;
  } catch (err: unknown) {
    console.error('[Apsis] HealthKit writeBackLift failed:', err); // D-12/D-25 — never rethrow, never block finish
    return undefined;
  }
}

/**
 * D-14: deletes the Apsis-authored HK sample identified by `uuid` from Health. Callers
 * must only invoke this for `workout.source === 'manual'` rows Apsis itself wrote —
 * never for an imported (`source === 'healthkit'`) row's `healthkitUuid`, which refers
 * to a sample Apsis does not own. Never throws (D-25) — a failed delete is logged and
 * silently dropped; it never blocks the local discard.
 */
export async function deleteHealthKitSample(uuid: string): Promise<void> {
  try {
    await deleteObjects(WorkoutTypeIdentifier, { uuid });
  } catch (err: unknown) {
    console.error('[Apsis] HealthKit deleteHealthKitSample failed:', err); // D-14/D-25 — silent, never blocks discard
  }
}
