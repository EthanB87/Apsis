/**
 * Behavioral + golden tests for packages/engine/src/daily.ts — dailyHSS sum + the
 * double-session penalty (ENG-03) per 02-CONTEXT.md D-16 test style.
 */
import { dailyHSS } from '../daily';

describe('dailyHSS — sum + double-session penalty (ENG-03)', () => {
  it('returns 0 for an empty day', () => {
    expect(dailyHSS([])).toBe(0);
  });

  it('a single session has no penalty applied', () => {
    expect(dailyHSS([50])).toBe(50);
  });

  it('two sessions apply the double-session penalty: (50+30)*1.1 = 88', () => {
    expect(dailyHSS([50, 30])).toBeCloseTo(88, 5);
  });

  it('three sessions still apply the penalty: (40+30+20)*1.1 = 99', () => {
    expect(dailyHSS([40, 30, 20])).toBeCloseTo(99, 5);
  });

  it('two sessions logged always exceed the same total logged as one session', () => {
    expect(dailyHSS([80])).toBeLessThan(dailyHSS([40, 40]));
  });

  it('never throws on any input', () => {
    expect(() => dailyHSS([])).not.toThrow();
    expect(() => dailyHSS([NaN])).not.toThrow();
  });

  it('treats a non-finite session score as 0 rather than returning NaN (WR-02)', () => {
    expect(Number.isFinite(dailyHSS([NaN]))).toBe(true);
    expect(dailyHSS([NaN])).toBe(0);
    expect(dailyHSS([50, NaN])).toBeCloseTo(50 * 1.1, 5);
    expect(Number.isFinite(dailyHSS([50, Infinity]))).toBe(true);
  });
});
