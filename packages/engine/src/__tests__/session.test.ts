/**
 * Behavioral + golden tests for packages/engine/src/session.ts — composes strength +
 * endurance into a version-stamped session HSS (D-05/D-06) per 02-CONTEXT.md D-16 test
 * style.
 */
import { sessionHSS, sessionHSSDetailed } from '../session';
import { strengthStress } from '../strength';
import { enduranceStress } from '../endurance';
import { ENGINE_VERSION } from '../version';

describe('sessionHSS — modality composition', () => {
  it('a strength-only session equals strengthStress on the same sets', () => {
    const sets = [{ loadKg: 100, e1rmKg: 200, reps: 5, rpe: 10, isLowerBody: false, isWarmup: false }];
    expect(sessionHSS({ strengthSets: sets })).toBeCloseTo(strengthStress(sets), 5);
  });

  it('an endurance-only session ≈ 100 for a 60-min threshold segment', () => {
    const segments = [{ durationS: 3600, intensityFactor: 1.0 }];
    expect(sessionHSS({ enduranceSegments: segments })).toBeCloseTo(100, 0);
  });

  it('a hybrid session equals the sum of the strength-only and endurance-only totals', () => {
    const sets = [{ loadKg: 100, e1rmKg: 200, reps: 5, rpe: 10, isLowerBody: false, isWarmup: false }];
    const segments = [{ durationS: 3600, intensityFactor: 1.0 }];
    const hybrid = sessionHSS({ strengthSets: sets, enduranceSegments: segments });
    const expected = strengthStress(sets) + enduranceStress(segments[0]);
    expect(hybrid).toBeCloseTo(expected, 5);
  });

  it('an empty session (no modalities) is 0', () => {
    expect(sessionHSS({})).toBe(0);
  });
});

describe('sessionHSSDetailed — version stamp + breakdown (D-05/D-06)', () => {
  it('stamps engineVersion with the exported ENGINE_VERSION and hss = ss + es', () => {
    const sets = [{ loadKg: 100, e1rmKg: 200, reps: 5, rpe: 10, isLowerBody: false, isWarmup: false }];
    const segments = [{ durationS: 3600, intensityFactor: 1.0 }];
    const detail = sessionHSSDetailed({ strengthSets: sets, enduranceSegments: segments });
    expect(detail.engineVersion).toBe(ENGINE_VERSION);
    expect(typeof detail.engineVersion).toBe('string');
    expect(detail.engineVersion.length).toBeGreaterThan(0);
    expect(detail.hss).toBeCloseTo(detail.ss + detail.es, 10);
    expect(detail.config.kEndurance).toBeCloseTo(1.6667, 4);
  });

  it('concatenates strength + endurance warnings', () => {
    const sets = [{ loadKg: 100, e1rmKg: 0, reps: 5, rpe: 10, isLowerBody: false, isWarmup: false }];
    const segments = [{ durationS: -10, intensityFactor: 5 }];
    const detail = sessionHSSDetailed({ strengthSets: sets, enduranceSegments: segments });
    expect(detail.warnings.length).toBeGreaterThan(0);
  });

  it('never throws on empty input', () => {
    expect(() => sessionHSSDetailed({})).not.toThrow();
  });
});
