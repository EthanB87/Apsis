/**
 * Behavioral + golden tests for packages/engine/src/endurance.ts (ENG-02).
 * Covers the calibration-anchor golden (60min @ IF 1.0 ~= 100 HSS), IF-squared scaling,
 * IF-derivation helpers (ifFromHR/ifFromPace), HR-over-pace precedence in resolveIF (D-11),
 * and clamp/no-throw robustness (D-15) per 02-CONTEXT.md D-16 test style.
 */
import { enduranceStress, enduranceStressDetailed, ifFromHR, ifFromPace, resolveIF } from '../endurance';

describe('enduranceStress — calibration anchor (D-14)', () => {
  it('scores ~100 for a 60-min segment at intensityFactor 1.0 (durationMin*IF^2*kEndurance)', () => {
    expect(enduranceStress({ durationS: 3600, intensityFactor: 1.0 })).toBeCloseTo(100, 0);
  });

  it('returns 0 ES for a durationS of 0', () => {
    expect(enduranceStress({ durationS: 0, intensityFactor: 1.0 })).toBe(0);
  });
});

describe('enduranceStress — IF-squared scaling', () => {
  it('scales with the square of IF: IF 0.5 vs IF 1.0 at equal duration differ by factor 4 (0.5^2 vs 1.0^2)', () => {
    const half = enduranceStress({ durationS: 3600, intensityFactor: 0.5 });
    const full = enduranceStress({ durationS: 3600, intensityFactor: 1.0 });
    expect(full / half).toBeCloseTo(4, 1);
  });
});

describe('ifFromHR / ifFromPace', () => {
  it('ifFromHR(160,160) = 1.0', () => {
    expect(ifFromHR(160, 160)).toBe(1.0);
  });

  it('ifFromHR(140,160) ~= 0.875', () => {
    expect(ifFromHR(140, 160)).toBeCloseTo(0.875, 3);
  });

  it('ifFromPace(300,300) = 1.0', () => {
    expect(ifFromPace(300, 300)).toBe(1.0);
  });

  it('ifFromPace(240,300) ~= 1.25 (faster pace than threshold -> higher IF)', () => {
    expect(ifFromPace(240, 300)).toBeCloseTo(1.25, 3);
  });
});

describe('resolveIF — precedence (D-11) and fallback', () => {
  it('prefers HR over pace when both are supplied', () => {
    const result = resolveIF({
      avgHR: 150,
      thresholdHR: 160,
      paceSecPerKm: 240,
      thresholdPaceSecPerKm: 300,
    });
    expect(result.intensityFactor).toBeCloseTo(ifFromHR(150, 160), 5);
  });

  it('falls back to pace when only pace is supplied', () => {
    const result = resolveIF({ paceSecPerKm: 240, thresholdPaceSecPerKm: 300 });
    expect(result.intensityFactor).toBeCloseTo(1.25, 3);
  });

  it('falls back to a neutral 1.0 with a warning when neither HR nor pace is supplied', () => {
    const result = resolveIF({});
    expect(result.intensityFactor).toBe(1.0);
    expect(result.warnings.length).toBeGreaterThanOrEqual(1);
  });
});

describe('enduranceStress — clamp/no-throw robustness (D-15)', () => {
  it('clamps an out-of-range intensityFactor (2.0 -> ~1.3) and records a warning, never throwing', () => {
    expect(() => enduranceStressDetailed({ durationS: 3600, intensityFactor: 2.0 })).not.toThrow();
    const detail = enduranceStressDetailed({ durationS: 3600, intensityFactor: 2.0 });
    expect(detail.warnings.length).toBeGreaterThanOrEqual(1);
    expect(Number.isFinite(detail.es)).toBe(true);
  });
});
