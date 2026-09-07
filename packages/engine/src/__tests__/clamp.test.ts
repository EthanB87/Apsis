/**
 * Behavioral tests for the clamp-and-warn primitive (D-15). Every case here must never
 * throw, even for non-finite input — this is a hard invariant for the mid-workout logging
 * loop.
 */
import { clampRange } from '../clamp';

describe('clampRange', () => {
  it('returns the value unchanged with no warning when in range', () => {
    const result = clampRange(8, 1, 10, 'rpe');
    expect(result.value).toBe(8);
    expect(result.warning).toBeUndefined();
  });

  it('clamps a value above max and warns, mentioning the label and the original value', () => {
    const result = clampRange(12, 1, 10, 'rpe');
    expect(result.value).toBe(10);
    expect(result.warning).toBeDefined();
    expect(result.warning).toContain('rpe');
    expect(result.warning).toContain('12');
  });

  it('clamps a value below min and warns, mentioning the label', () => {
    const result = clampRange(0, 1, 10, 'rpe');
    expect(result.value).toBe(1);
    expect(result.warning).toBeDefined();
    expect(result.warning).toContain('rpe');
  });

  it('coerces NaN to a finite clamped value with a warning, never NaN', () => {
    const result = clampRange(NaN, 1, 10, 'rpe');
    expect(Number.isFinite(result.value)).toBe(true);
    expect(result.value).toBe(1);
    expect(result.warning).toBeDefined();
  });

  it('never throws for Infinity or -Infinity and clamps to the range bounds', () => {
    expect(() => clampRange(Infinity, 1, 10, 'rpe')).not.toThrow();
    expect(() => clampRange(-Infinity, 1, 10, 'rpe')).not.toThrow();

    const high = clampRange(Infinity, 1, 10, 'rpe');
    expect(high.value).toBe(10);
    expect(high.warning).toBeDefined();

    const low = clampRange(-Infinity, 1, 10, 'rpe');
    expect(low.value).toBe(1);
    expect(low.warning).toBeDefined();
  });

  it('coerces undefined (a non-number sneaking past compile-time types) to a finite clamped value with a warning', () => {
    const result = clampRange(undefined as unknown as number, 1, 10, 'rpe');
    expect(Number.isFinite(result.value)).toBe(true);
    expect(result.value).toBe(1);
    expect(result.warning).toBeDefined();
  });

  it('coerces a non-numeric string to a finite clamped value with a warning', () => {
    const result = clampRange('not-a-number' as unknown as number, 1, 10, 'rpe');
    expect(Number.isFinite(result.value)).toBe(true);
    expect(result.value).toBe(1);
    expect(result.warning).toBeDefined();
  });
});
