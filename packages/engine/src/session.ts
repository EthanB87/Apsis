/**
 * @apsis/engine — Per-session HSS: composes strength + endurance stress; version-stamped
 * breakdown (D-05/D-06). Zero runtime dependencies. Pure functions only — no I/O, no
 * wall-clock reads, no side effects.
 *
 * A session may include strength sets, endurance segments, carry sets, or any combination
 * (a hybrid session). Session HSS = SS + ES + CS (BUILD.md §4.2, extended by D-20). The
 * detailed variant stamps the engine version and the resolved config alongside the raw
 * ss/es/cs components and per-set breakdown, so a persisted score remains traceable and
 * re-computable after future constant re-fits (D-06). Never throws — all clamp/skip
 * robustness is inherited from strengthStressDetailed, enduranceStressDetailed, and
 * carryStressDetailed (D-15).
 */

import type { EngineConfig, SessionHSSResult, SessionInput } from '@apsis/shared';
import { mergeConfig } from './config';
import { strengthStressDetailed } from './strength';
import { enduranceStressDetailed } from './endurance';
import { carryStressDetailed } from './carry';
import { ENGINE_VERSION } from './version';

/**
 * Detailed session score (D-05/D-06): composes `strengthStressDetailed` over
 * `input.strengthSets`, sums `enduranceStressDetailed` over each of
 * `input.enduranceSegments`, and sums `carryStressDetailed` over each of
 * `input.carrySets` (D-20), concatenating all warnings. `hss = ss + es + cs`. Stamped with
 * `engineVersion` and the resolved `config` so a stored score is always attributable to a
 * specific formula version and re-computable after future constant re-fits. Never throws.
 */
export function sessionHSSDetailed(
  input: SessionInput,
  cfg?: Partial<EngineConfig>
): SessionHSSResult {
  const config = mergeConfig(cfg);

  const strengthDetail = strengthStressDetailed(input.strengthSets ?? [], config);

  let es = 0;
  const warnings: string[] = [...strengthDetail.warnings];
  for (const segment of input.enduranceSegments ?? []) {
    const segmentDetail = enduranceStressDetailed(segment, config);
    es += segmentDetail.es;
    warnings.push(...segmentDetail.warnings);
  }

  let cs = 0;
  for (const carrySet of input.carrySets ?? []) {
    const carryDetail = carryStressDetailed(carrySet, config);
    cs += carryDetail.cs;
    warnings.push(...carryDetail.warnings);
  }

  const ss = strengthDetail.ss;
  const hss = ss + es + cs;

  return {
    hss,
    ss,
    es,
    cs,
    perSetStress: strengthDetail.perSetStress,
    warnings,
    engineVersion: ENGINE_VERSION,
    config,
  };
}

/**
 * Bare-number facade over `sessionHSSDetailed` (D-05) — returns just the session HSS
 * (`hss`). Never throws.
 */
export function sessionHSS(input: SessionInput, cfg?: Partial<EngineConfig>): number {
  return sessionHSSDetailed(input, cfg).hss;
}
