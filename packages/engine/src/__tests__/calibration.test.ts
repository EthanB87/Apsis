/**
 * Calibration golden (D-13/D-14) — packages/engine/src/__tests__/calibration.test.ts.
 * This is the first-class deliverable that makes the "one honest combined number" thesis
 * honest: a 60-minute threshold run and a hard 5x5 squat session must land within ±25%
 * (ratio 0.8..1.25) of each other on the HSS scale. `kStrength` in config.ts was tuned
 * specifically to pass this test — do not change the expected ratio bounds without
 * revisiting D-13.
 */
import { sessionHSS } from '../index';

describe('calibration — threshold run vs. hard 5x5 squat (D-13/D-14)', () => {
  const runSession = {
    enduranceSegments: [{ durationS: 3600, intensityFactor: 1.0 }],
  };

  const squatSession = {
    strengthSets: Array.from({ length: 5 }, () => ({
      loadKg: 140,
      e1rmKg: 180,
      reps: 5,
      rpe: 9,
      isLowerBody: true,
      isWarmup: false,
    })),
  };

  it('a 60-min threshold run (IF 1.0) lands at HSS ≈ 100 (D-14 anchor)', () => {
    const runHSS = sessionHSS(runSession);
    expect(runHSS).toBeCloseTo(100, 0);
  });

  it('the hard 5x5 squat lands within ±25% of the threshold-run HSS (D-13)', () => {
    const runHSS = sessionHSS(runSession);
    const liftHSS = sessionHSS(squatSession);
    const ratio = liftHSS / runHSS;
    expect(ratio).toBeGreaterThanOrEqual(0.8);
    expect(ratio).toBeLessThanOrEqual(1.25);
  });

  it('the hard 5x5 squat HSS falls within BUILD.md’s ~30–120 readable range for a hard session', () => {
    const liftHSS = sessionHSS(squatSession);
    expect(liftHSS).toBeGreaterThanOrEqual(30);
    expect(liftHSS).toBeLessThanOrEqual(120);
  });
});
