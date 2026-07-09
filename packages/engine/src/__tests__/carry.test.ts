/**
 * Behavioral + golden tests for packages/engine/src/carry.ts (D-20).
 * Covers clamp-and-warn robustness (D-15) and the required calibration golden test: a
 * 4x40m heavy farmer's carry must land WELL under the ~100 HSS threshold-run anchor, in a
 * hard-accessory band (D-20/A5 — the golden test is authoritative over the suggested
 * formula shape if they conflict).
 */
import { carryStress, carryStressDetailed } from '../carry';

describe('carryStressDetailed — clamp/skip robustness (D-15)', () => {
  it('clamps a negative durationS to 0, records a warning, never throws', () => {
    expect(() =>
      carryStressDetailed({ loadKg: 100, bodyweightKg: 80, durationS: -5, rpe: 8, isWarmup: false })
    ).not.toThrow();
    const detail = carryStressDetailed({
      loadKg: 100,
      bodyweightKg: 80,
      durationS: -5,
      rpe: 8,
      isWarmup: false,
    });
    expect(detail.warnings.length).toBeGreaterThan(0);
    expect(Number.isFinite(detail.cs)).toBe(true);
  });

  it('clamps an out-of-range rpe (12) into [1,10] and records a warning', () => {
    const detail = carryStressDetailed({
      loadKg: 100,
      bodyweightKg: 80,
      durationS: 20,
      rpe: 12,
      isWarmup: false,
    });
    expect(detail.warnings.some((w) => w.includes('rpe'))).toBe(true);
    expect(Number.isFinite(detail.cs)).toBe(true);
  });

  it('clamps a negative loadKg to 0 and records a warning, never returns NaN', () => {
    const detail = carryStressDetailed({
      loadKg: -20,
      bodyweightKg: 80,
      durationS: 20,
      rpe: 8,
      isWarmup: false,
    });
    expect(detail.warnings.length).toBeGreaterThan(0);
    expect(Number.isFinite(detail.cs)).toBe(true);
    expect(Number.isNaN(detail.cs)).toBe(false);
  });

  it('a zero/negative bodyweightKg guards to a neutral 1x load-ratio rather than dividing by zero', () => {
    expect(() =>
      carryStressDetailed({ loadKg: 100, bodyweightKg: 0, durationS: 20, rpe: 8, isWarmup: false })
    ).not.toThrow();
    const detail = carryStressDetailed({
      loadKg: 100,
      bodyweightKg: 0,
      durationS: 20,
      rpe: 8,
      isWarmup: false,
    });
    expect(Number.isFinite(detail.cs)).toBe(true);
  });
});

describe('carryStressDetailed — golden: 4x40m heavy farmer\'s carry (D-20)', () => {
  it('sums to a hard-accessory total WELL under the ~100 HSS threshold-run anchor (>8 and <60)', () => {
    // Each ~40m set modeled as ~20s; heavy load = 1.5x bodyweight; RPE 8.
    const bodyweightKg = 80;
    const set = { loadKg: bodyweightKg * 1.5, bodyweightKg, durationS: 20, rpe: 8, isWarmup: false };
    const totalCs = [set, set, set, set].reduce((sum, s) => sum + carryStressDetailed(s).cs, 0);
    expect(totalCs).toBeGreaterThan(8);
    expect(totalCs).toBeLessThan(60);
  });
});

describe('carryStress — bare facade', () => {
  it('returns the same value as carryStressDetailed(...).cs', () => {
    const set = { loadKg: 100, bodyweightKg: 80, durationS: 20, rpe: 8, isWarmup: false };
    expect(carryStress(set)).toBeCloseTo(carryStressDetailed(set).cs, 10);
  });
});
