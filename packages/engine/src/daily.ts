/**
 * @apsis/engine — Per-day HSS rollup: sum sessions + same-day double-session penalty
 * (ENG-03). Zero runtime dependencies. Pure functions only — no I/O, no Date.now(), no
 * side effects.
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
 */
export function dailyHSS(sessionScores: number[], cfg?: Partial<EngineConfig>): number {
  const config = mergeConfig(cfg);
  const total = sessionScores.reduce((sum, s) => sum + s, 0);
  if (sessionScores.length > 1) {
    return total * config.doublePenalty;
  }
  return total;
}
