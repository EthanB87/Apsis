/**
 * Behavioral + golden tests for packages/engine/src/strength.ts (ENG-01).
 * Covers warmup exclusion, lower-body amplification, RPE scaling, the Epley e1RM
 * estimator, and clamp/skip robustness (D-15) per 02-CONTEXT.md D-16 test style.
 */
import { estimateE1RM, strengthStress, strengthStressDetailed } from '../strength';

describe('estimateE1RM', () => {
  it('computes the Epley estimate load*(1+reps/30)', () => {
    expect(estimateE1RM(100, 5)).toBeCloseTo(116.667, 3);
  });
});

describe('strengthStress — golden single-set cases', () => {
  it('computes SS for a single working set: (100/200)*5*1.0 * kStrength(4.4) = 11.0', () => {
    const sets = [
      { loadKg: 100, e1rmKg: 200, reps: 5, rpe: 10, isLowerBody: false, isWarmup: false },
    ];
    expect(strengthStress(sets)).toBeCloseTo(11.0, 5);
  });

  it('excludes warmup sets entirely from the session score', () => {
    const sets = [
      { loadKg: 100, e1rmKg: 200, reps: 5, rpe: 10, isLowerBody: false, isWarmup: true },
    ];
    expect(strengthStress(sets)).toBe(0);
  });

  it('amplifies lower-body sets by legMultiplier (default 1.3): 2.5 * 1.3 * kStrength(4.4) = 14.3', () => {
    const sets = [
      { loadKg: 100, e1rmKg: 200, reps: 5, rpe: 10, isLowerBody: true, isWarmup: false },
    ];
    expect(strengthStress(sets)).toBeCloseTo(14.3, 5);
  });

  it('returns 0 for an empty sets array with no warnings', () => {
    expect(strengthStress([])).toBe(0);
    expect(strengthStressDetailed([]).warnings).toEqual([]);
  });
});

describe('strengthStress — clamp/skip robustness (D-15)', () => {
  it('clamps an out-of-range rpe (12 -> 10) and records a warning without throwing', () => {
    const sets = [
      { loadKg: 100, e1rmKg: 200, reps: 5, rpe: 12, isLowerBody: false, isWarmup: false },
    ];
    expect(() => strengthStressDetailed(sets)).not.toThrow();
    const detail = strengthStressDetailed(sets);
    expect(detail.warnings.length).toBeGreaterThan(0);
    expect(Number.isFinite(detail.ss)).toBe(true);
  });

  it('clamps a below-range rpe (0 -> 1) and records a warning', () => {
    const sets = [
      { loadKg: 100, e1rmKg: 200, reps: 5, rpe: 0, isLowerBody: false, isWarmup: false },
    ];
    const detail = strengthStressDetailed(sets);
    expect(detail.warnings.some((w) => w.includes('rpe'))).toBe(true);
    expect(Number.isFinite(detail.ss)).toBe(true);
  });

  it('skips a set with e1rmKg<=0, records a warning, and returns a finite (non-NaN) result', () => {
    const sets = [
      { loadKg: 100, e1rmKg: 0, reps: 5, rpe: 10, isLowerBody: false, isWarmup: false },
    ];
    const detail = strengthStressDetailed(sets);
    expect(detail.warnings.length).toBeGreaterThan(0);
    expect(Number.isFinite(detail.ss)).toBe(true);
    expect(Number.isNaN(detail.ss)).toBe(false);
    expect(strengthStress(sets)).toBe(0);
  });

  it('skips a set with e1rmKg: NaN, records a warning, and returns a finite (non-NaN) result (CR-02)', () => {
    const sets = [
      { loadKg: 100, e1rmKg: NaN, reps: 5, rpe: 10, isLowerBody: false, isWarmup: false },
    ];
    const detail = strengthStressDetailed(sets);
    expect(detail.warnings.some((w) => w.includes('e1rmKg'))).toBe(true);
    expect(Number.isFinite(detail.ss)).toBe(true);
    expect(Number.isNaN(detail.ss)).toBe(false);
    expect(strengthStress(sets)).toBe(0);
  });

  it('never throws on a mixed batch of valid, warmup, clamped, and skip-worthy sets', () => {
    const sets = [
      { loadKg: 100, e1rmKg: 200, reps: 5, rpe: 10, isLowerBody: false, isWarmup: false },
      { loadKg: 60, e1rmKg: 150, reps: 8, rpe: 8, isLowerBody: false, isWarmup: true },
      { loadKg: 120, e1rmKg: 220, reps: 5, rpe: 12, isLowerBody: true, isWarmup: false },
      { loadKg: 80, e1rmKg: 0, reps: 10, rpe: 7, isLowerBody: false, isWarmup: false },
    ];
    expect(() => strengthStress(sets)).not.toThrow();
    expect(Number.isFinite(strengthStress(sets))).toBe(true);
  });
});
