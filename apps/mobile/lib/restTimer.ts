/**
 * apps/mobile/lib/restTimer.ts
 *
 * Timestamp-based rest-timer helpers (D-25/D-26): the countdown is derived from a wall-clock
 * `endsAt` timestamp, not a JS `setTimeout`, so it survives backgrounding for free (RESEARCH
 * Pitfall 2 — a naive `setTimeout` dies when the app is suspended). `Date.now()` is called
 * here at the app layer only — `packages/engine` stays pure and never touches the clock
 * directly (CLAUDE.md engine-purity constraint).
 */

/** Starts a rest timer of `durationSec` seconds from now; returns the endsAt timestamp (ms epoch). */
export function startRest(durationSec: number): number {
  return Date.now() + durationSec * 1000;
}

/** Remaining whole seconds until `endsAt`, floored at 0 — never negative, never NaN for a finite `endsAt`. */
export function remainingSec(endsAt: number, now: number): number {
  return Math.max(0, Math.ceil((endsAt - now) / 1000));
}

/**
 * Per-exercise override (D-25) wins over the profile global default when set.
 * `exerciseRestSec` is `null` when the exercise has no override (`exercise.restTimerSec`
 * schema column) — the profile's global default (`user_profile.restTimerDefaultSec`) is used.
 */
export function resolveRestDuration(exerciseRestSec: number | null, profileDefaultSec: number): number {
  return exerciseRestSec != null ? exerciseRestSec : profileDefaultSec;
}
