/**
 * @apsis/engine — Per-day HSS rollup: sum sessions + same-day double-session penalty
 * (ENG-03). Zero runtime dependencies. Pure functions only — no I/O, no wall-clock reads,
 * no side effects.
 *
 * Daily HSS = sum of session HSS scores; when more than one session lands on the same
 * day, the day total is multiplied by `doublePenalty` (BUILD.md §4.2) — reflecting the
 * added systemic cost of training twice in a day.
 */

import type { EngineConfig } from '@apsis/shared';
import { mergeConfig } from './config';

/**
 * Roll a day's session HSS scores into a single day total (ENG-03). Sums `sessionScores`;
 * if more than one session was logged that day, multiplies the total by
 * `config.doublePenalty`. Empty input returns 0. Pure; never throws.
 *
 * `sessionScores` is a public parameter, not an internal detail guaranteed to already be
 * clamped — per D-15, every public engine function defends its own inputs rather than
 * trusting callers. Non-finite entries (NaN/Infinity, e.g. from an unrelated upstream bug)
 * are treated as 0 so a single bad session score can't silently corrupt the whole day total
 * (WR-02).
 */
export function dailyHSS(sessionScores: number[], cfg?: Partial<EngineConfig>): number {
  const config = mergeConfig(cfg);
  const safeScores = sessionScores.map((s) => (Number.isFinite(s) ? s : 0));
  const total = safeScores.reduce((sum, s) => sum + s, 0);
  if (sessionScores.length > 1) {
    return total * config.doublePenalty;
  }
  return total;
}
