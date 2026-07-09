/**
 * Behavioral tests for packages/engine/src/bodyweight.ts (D-18).
 * Covers exact table-row lookup, linear interpolation between rows, the hard 30-rep floor
 * clamp, and NaN/below-range clamp-and-warn robustness (D-15), mirroring strength.test.ts.
 */
import { estimateE1RMFromRepMaxTable, estimateE1RMFromRepMaxTableDetailed } from '../bodyweight';

describe('estimateE1RMFromRepMaxTable — exact table-row lookup', () => {
  it('reps=10 uses pct 0.75: e1rm = loadKg / 0.75', () => {
    expect(estimateE1RMFromRepMaxTable(60, 10)).toBeCloseTo(60 / 0.75, 5);
  });

  it('reps=1 uses pct 1.0: e1rm = loadKg', () => {
    expect(estimateE1RMFromRepMaxTable(80, 1)).toBeCloseTo(80, 5);
  });
});

describe('estimateE1RMFromRepMaxTable — linear interpolation between rows', () => {
  it('a rep count between two table rows (e.g. reps=6, between reps=5/pct=0.87 and reps=8/pct=0.80) interpolates', () => {
    // linear interp: pct = 0.87 + (6-5)/(8-5) * (0.80-0.87) = 0.87 - 0.07/3
    const expectedPct = 0.87 + ((6 - 5) / (8 - 5)) * (0.8 - 0.87);
    expect(estimateE1RMFromRepMaxTable(70, 6)).toBeCloseTo(70 / expectedPct, 5);
  });
});

describe('estimateE1RMFromRepMaxTable — 30-rep floor clamp (D-18/D-15)', () => {
  it('reps above 30 clamp to the 30-row (pct 0.45) and push a warning, never extrapolating', () => {
    const detail = estimateE1RMFromRepMaxTableDetailed(50, 40);
    expect(detail.warnings.length).toBeGreaterThan(0);
    expect(detail.e1rm).toBeCloseTo(50 / 0.45, 5);
    expect(Number.isFinite(detail.e1rm)).toBe(true);
  });

  it('a high-rep (25-rep) bodyweight push-up set does not blow up or go undefined', () => {
    const detail = estimateE1RMFromRepMaxTableDetailed(75, 25);
    expect(Number.isFinite(detail.e1rm)).toBe(true);
    expect(detail.e1rm).toBeGreaterThan(0);
  });
});

describe('estimateE1RMFromRepMaxTable — clamp/skip robustness (D-15)', () => {
  it('reps below 1 clamp to 1 with a warning and return a finite result', () => {
    const detail = estimateE1RMFromRepMaxTableDetailed(80, 0);
    expect(detail.warnings.length).toBeGreaterThan(0);
    expect(Number.isFinite(detail.e1rm)).toBe(true);
    expect(detail.e1rm).toBeCloseTo(80, 5);
  });

  it('NaN reps clamps with a warning, never throws, never returns NaN', () => {
    expect(() => estimateE1RMFromRepMaxTableDetailed(80, NaN)).not.toThrow();
    const detail = estimateE1RMFromRepMaxTableDetailed(80, NaN);
    expect(detail.warnings.length).toBeGreaterThan(0);
    expect(Number.isFinite(detail.e1rm)).toBe(true);
    expect(Number.isNaN(detail.e1rm)).toBe(false);
  });

  it('never throws on a negative loadKg, clamps to 0, and returns a finite result', () => {
    expect(() => estimateE1RMFromRepMaxTableDetailed(-10, 10)).not.toThrow();
    const detail = estimateE1RMFromRepMaxTableDetailed(-10, 10);
    expect(detail.warnings.length).toBeGreaterThan(0);
    expect(Number.isFinite(detail.e1rm)).toBe(true);
  });
});
