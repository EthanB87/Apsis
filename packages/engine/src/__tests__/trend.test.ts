/**
 * Behavioral tests for computeLoadTrend / computeLoadTrendSeries (ENG-04/05).
 * Property-driven per D-16: EWMA responsiveness, tsb = ctl - atl invariant, series/final
 * agreement — not exact golden numbers (constants stay tunable without rewriting tests).
 */
import { computeLoadTrend, computeLoadTrendSeries } from '../trend';

describe('computeLoadTrend', () => {
  it('returns all zeros for empty input (D-08: EWMA init at 0)', () => {
    expect(computeLoadTrend([])).toEqual({ atl: 0, ctl: 0, tsb: 0 });
  });

  it('converges ATL and CTL upward toward a constant daily HSS, with TSB near 0', () => {
    // 150 days is several CTL time constants (28d) deep, enough for both EWMAs to
    // fully settle on a constant input.
    const days = new Array(150).fill(100);
    const { atl, ctl, tsb } = computeLoadTrend(days);
    expect(atl).toBeGreaterThan(80);
    expect(ctl).toBeGreaterThan(80);
    expect(Math.abs(tsb)).toBeLessThanOrEqual(5);
  });

  it('decays ATL faster than CTL over a rest week following steady load (rest-week freshness)', () => {
    const steady = new Array(30).fill(100);
    const rest = new Array(7).fill(0);
    const fullSeries = [...steady, ...rest];

    const atDay30 = computeLoadTrend(fullSeries.slice(0, 30));
    const atDay37 = computeLoadTrend(fullSeries.slice(0, 37));

    const atlDrop = atDay30.atl - atDay37.atl;
    const ctlDrop = atDay30.ctl - atDay37.ctl;

    expect(atlDrop).toBeGreaterThan(ctlDrop);
    expect(atDay37.tsb).toBeGreaterThan(0);
  });

  it('always satisfies tsb === ctl - atl exactly, on a non-trivial mixed series', () => {
    const series = [80, 120, 0, 100, 60, 140, 20, 90, 110, 0];
    const { atl, ctl, tsb } = computeLoadTrend(series);
    expect(tsb).toBe(ctl - atl);
  });

  it('does not let a single non-finite day permanently poison every later day (CR-03)', () => {
    const clean = [80, 100, 90, 60, 110, 70, 100];
    const withBadDay = [80, 100, NaN, 60, 110, 70, 100];
    const cleanResult = computeLoadTrend(clean);
    const poisonedResult = computeLoadTrend(withBadDay);
    expect(Number.isFinite(poisonedResult.atl)).toBe(true);
    expect(Number.isFinite(poisonedResult.ctl)).toBe(true);
    expect(Number.isFinite(poisonedResult.tsb)).toBe(true);
    // The NaN day is treated as 0, so results differ from the all-clean series, but neither
    // is NaN and neither throws.
    expect(poisonedResult.atl).not.toBe(cleanResult.atl);
  });
});

describe('computeLoadTrendSeries', () => {
  it('returns exactly N points for an N-day input, with the final point matching computeLoadTrend on the full array', () => {
    const series = [50, 100, 0, 75, 130, 20, 90, 60, 0, 110];
    const points = computeLoadTrendSeries(series);
    expect(points).toHaveLength(series.length);

    const final = computeLoadTrend(series);
    const lastPoint = points[points.length - 1];
    expect(lastPoint.atl).toBeCloseTo(final.atl, 10);
    expect(lastPoint.ctl).toBeCloseTo(final.ctl, 10);
    expect(lastPoint.tsb).toBeCloseTo(final.tsb, 10);
  });

  it('emits a band on every point, one per input day, in chronological order', () => {
    const series = [100, 100, 100];
    const points = computeLoadTrendSeries(series);
    expect(points).toHaveLength(3);
    for (const point of points) {
      expect(typeof point.band).toBe('string');
    }
  });

  it('keeps every point finite even when a middle day is NaN, instead of poisoning all later points (CR-03)', () => {
    const series = [80, 100, NaN, 60, 110, 70, 100];
    const points = computeLoadTrendSeries(series);
    expect(points).toHaveLength(series.length);
    for (const point of points) {
      expect(Number.isFinite(point.atl)).toBe(true);
      expect(Number.isFinite(point.ctl)).toBe(true);
      expect(Number.isFinite(point.tsb)).toBe(true);
    }
  });
});
