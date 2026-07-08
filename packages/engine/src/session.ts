/**
 * @apsis/engine — Per-session HSS: composes strength + endurance stress; version-stamped
 * breakdown (D-05/D-06). Zero runtime dependencies. Pure functions only — no I/O, no
 * wall-clock reads, no side effects.
 *
 * A session may include strength sets, endurance segments, or both (a hybrid session).
 * Session HSS = SS + ES (BUILD.md §4.2). The detailed variant stamps the engine version
 * and the resolved config alongside the raw ss/es components and per-set breakdown, so a
 * persisted score remains traceable and re-computable after future constant re-fits (D-06).
 * Never throws — all clamp/skip robustness is inherited from strengthStressDetailed and
 * enduranceStressDetailed (D-15).
 */

import type { EngineConfig, SessionHSSResult, SessionInput } from '@apsis/shared';
import { mergeConfig } from './config';
import { strengthStressDetailed } from './strength';
import { enduranceStressDetailed } from './endurance';
import { ENGINE_VERSION } from './version';

/**
 * Detailed session score (D-05/D-06): composes `strengthStressDetailed` over
 * `input.strengthSets` and sums `enduranceStressDetailed` over each of
 * `input.enduranceSegments`, concatenating all warnings. `hss = ss + es`. Stamped with
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

  const ss = strengthDetail.ss;
  const hss = ss + es;

  return {
    hss,
    ss,
    es,
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
