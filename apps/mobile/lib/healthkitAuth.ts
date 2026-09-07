/**
 * apps/mobile/lib/healthkitAuth.ts
 *
 * Centralizes the HealthKit authorization identifier sets (D-18, Pitfall 5) and a thin
 * `requestAuthorization` wrapper. Every query/write call site in this phase
 * (`healthkitImport.ts`, `healthkitWriteback.ts`) must reuse `HK_READ_TYPES`/`HK_WRITE_TYPES`
 * rather than declaring an ad-hoc identifier — Pitfall 5: querying/writing a type that wasn't
 * included in the original `requestAuthorization` call can crash at query time, which is the
 * one HealthKit failure mode NOT covered by D-25's "silent failure, retry next foreground
 * sync" policy.
 *
 * D-19 (Don't Hand-Roll): "connected" is tracked as the simple boolean this function returns
 * once the iOS permission sheet completes — no authorization-status poller is built here.
 * iOS deliberately hides granular per-type read-grant status from apps, so polling
 * `authorizationStatusFor` per type would only produce false signals.
 *
 * D-18: the read set covers workouts + heart rate + body mass; the write set is
 * workout-only — Apsis never requests bodyweight write access (Settings bodyweight edits are
 * import-only, one-way).
 *
 * Security (T-05-01, Information Disclosure — mitigate): only `Error` objects and booleans are
 * ever logged from this module — never a raw bodyweight or heart-rate value.
 */

import { requestAuthorization, WorkoutTypeIdentifier } from '@kingstinct/react-native-healthkit';

/** D-18: read set is workouts + heart rate + body mass. */
export const HK_READ_TYPES = [
  WorkoutTypeIdentifier,
  'HKQuantityTypeIdentifierHeartRate',
  'HKQuantityTypeIdentifierBodyMass',
] as const;

/** D-18: write set is workout-only — Apsis never writes bodyweight back to Health. */
export const HK_WRITE_TYPES = [WorkoutTypeIdentifier] as const;

/**
 * Requests the complete `HK_READ_TYPES`/`HK_WRITE_TYPES` sets exactly once (Pattern 4 /
 * Pitfall 5 — the full set must be declared up front, never grown incrementally per
 * call site). Resolves to whether the permission sheet completed; per D-19 this boolean IS
 * the entire "connected" state model — it does not (and per iOS's own privacy design,
 * cannot) indicate which individual types the user actually granted. Never throws: a
 * rejected request is logged (Error object only, T-05-01) and reported as `false` so the
 * caller can apply D-25's silent-failure UX instead of crashing.
 */
export async function requestHealthKitAuthorization(): Promise<boolean> {
  try {
    return await requestAuthorization({
      toRead: [...HK_READ_TYPES],
      toShare: [...HK_WRITE_TYPES],
    });
  } catch (err: unknown) {
    console.error('[Apsis] HealthKit requestAuthorization failed:', err);
    return false;
  }
}
