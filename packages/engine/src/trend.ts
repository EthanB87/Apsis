/**
 * @apsis/engine — Rolling load trend: EWMA ATL/CTL/TSB + readiness banding
 * Zero runtime dependencies. Pure functions only — no I/O, no Date.now(), no side effects.
 *
 * ATL (acute training load, ~7-day time constant) and CTL (chronic training load, ~28-day
 * time constant) are exponentially-weighted moving averages of daily HSS. TSB (training
 * stress balance) = CTL - ATL: positive when recent load has eased off relative to the
 * chronic baseline (fresher), negative when acute load is spiking above baseline (more
 * fatigued). This is the standard impulse-response EWMA form used across endurance training
 * literature (BUILD.md §4.2), adapted here to a single unified HSS input series.
 *
 * The readiness band turns TSB/CTL into a green/amber/red signal, but gates on a fourth
 * 'calibrating' state (D-01) whenever there isn't enough history or chronic load yet to
 * trust the ratio (D-02) — this is what guarantees a cold-start user is never shown a
 * misleading band (ENG-06).
 */

import type { EngineConfig, LoadTrendPoint, ReadinessBand } from '@apsis/shared';
import { mergeConfig } from './config';

/**
 * Fold a chronological array of daily HSS values into a single EWMA, starting from 0
 * (D-08). For a time constant `days`, the smoothing factor is the standard
 * `lambda = 1 - exp(-1/days)` impulse-response derivation: each day's value moves toward
 * that day's HSS by a fraction `lambda` of the remaining gap. Larger `days` (e.g. CTL's 28)
 * yields a smaller lambda and slower response; smaller `days` (e.g. ATL's 7) yields a
 * larger lambda and faster response.
 */
function ewmaFold(dailyHSSByDay: number[], days: number): number {
  const lambda = 1 - Math.exp(-1 / days);
  let value = 0;
  for (const todayHSS of dailyHSSByDay) {
    value = value + lambda * (todayHSS - value);
  }
  return value;
}

/**
 * Compute the final rolling ATL/CTL/TSB from a chronological array of daily HSS values
 * (BUILD.md §4.1). `tsb = ctl - atl` always. Empty input returns all zeros (D-08).
 */
export function computeLoadTrend(
  dailyHSSByDay: number[],
  cfg?: Partial<EngineConfig>
): { atl: number; ctl: number; tsb: number } {
  const config = mergeConfig(cfg);
  const atl = ewmaFold(dailyHSSByDay, config.atlDays);
  const ctl = ewmaFold(dailyHSSByDay, config.ctlDays);
  const tsb = ctl - atl;
  return { atl, ctl, tsb };
}

/**
 * Compute a readiness band from TSB/CTL (D-03 signature: standalone, opts-based). The
 * calibrating gate (history < calibratingMinHistoryDays OR ctl < calibratingCtlFloor) is
 * checked before any red/amber/green branch, so it always wins over the ratio — this is
 * what makes a cold-start single session incapable of ever reaching 'red' (ENG-06), and
 * also protects the ratio computation from a near-zero ctl denominator (T-02-05-Div).
 * Pure; never throws.
 */
export function readinessBand(
  tsb: number,
  ctl: number,
  opts: { historyDays: number },
  cfg?: Partial<EngineConfig>
): ReadinessBand {
  const config = mergeConfig(cfg);

  if (opts.historyDays < config.calibratingMinHistoryDays || ctl < config.calibratingCtlFloor) {
    return 'calibrating';
  }

  const ratio = tsb / ctl;
  if (ratio < config.bandRedRatio) {
    return 'red';
  }
  if (ratio < config.bandAmberRatio) {
    return 'amber';
  }
  return 'green';
}

/**
 * Per-day trend series (D-07): folds the EWMAs day-by-day and emits one LoadTrendPoint per
 * input day (atl, ctl, tsb, band), so Phase 4's chart renders pure engine output with no
 * trend math duplicated in the UI layer. `historyDays` passed to `readinessBand` for day i
 * is `i + 1` (1-indexed day count). The final point's {atl, ctl, tsb} matches
 * `computeLoadTrend` run on the full array.
 */
export function computeLoadTrendSeries(
  dailyHSSByDay: number[],
  cfg?: Partial<EngineConfig>
): LoadTrendPoint[] {
  const config = mergeConfig(cfg);
  const atlLambda = 1 - Math.exp(-1 / config.atlDays);
  const ctlLambda = 1 - Math.exp(-1 / config.ctlDays);

  const points: LoadTrendPoint[] = [];
  let atl = 0;
  let ctl = 0;

  for (let i = 0; i < dailyHSSByDay.length; i++) {
    const todayHSS = dailyHSSByDay[i] ?? 0;
    atl = atl + atlLambda * (todayHSS - atl);
    ctl = ctl + ctlLambda * (todayHSS - ctl);
    const tsb = ctl - atl;
    const band = readinessBand(tsb, ctl, { historyDays: i + 1 }, config);
    points.push({ atl, ctl, tsb, band });
  }

  return points;
}
