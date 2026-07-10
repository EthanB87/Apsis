/**
 * apps/mobile/lib/__tests__/runEntryLogic.test.ts
 *
 * RED/GREEN coverage for the run-form's Pitfall 6 / T-04-10 mitigation: pace must only ever
 * be resolved into an intensity factor for activityType 'run'. ERG/CONDITIONING must rely on
 * HR alone (or fall back to a neutral, warned 1.0), never an erg split compared against a
 * running threshold pace.
 */

import { describe, expect, it } from 'vitest';
import { computePaceSecPerKm, resolveRunSegment } from '../runEntryLogic';

describe('computePaceSecPerKm', () => {
  it('computes seconds-per-km from distance and duration', () => {
    // 5km in 25:00 (1500s) -> 300 sec/km (5:00/km)
    expect(computePaceSecPerKm(5000, 1500)).toBe(300);
  });

  it('returns undefined when distance is absent, zero, or negative', () => {
    expect(computePaceSecPerKm(undefined, 1500)).toBeUndefined();
    expect(computePaceSecPerKm(0, 1500)).toBeUndefined();
    expect(computePaceSecPerKm(-100, 1500)).toBeUndefined();
  });

  it('returns undefined when duration is zero (avoids a divide producing Infinity)', () => {
    expect(computePaceSecPerKm(5000, 0)).toBeUndefined();
  });
});

describe('resolveRunSegment', () => {
  it('RUN: resolves IF from pace when no HR is present', () => {
    const result = resolveRunSegment({
      activityType: 'run',
      durationS: 1500,
      distanceM: 5000,
      thresholdPaceSecPerKm: 300,
    });
    expect(result.paceSecPerKm).toBe(300);
    expect(result.intensityFactor).toBeCloseTo(1.0, 5);
    expect(result.warnings).toEqual([]);
  });

  it('RUN: HR takes precedence over pace when both are present (engine D-11 precedence)', () => {
    const result = resolveRunSegment({
      activityType: 'run',
      durationS: 1500,
      distanceM: 5000,
      avgHr: 150,
      thresholdHr: 160,
      thresholdPaceSecPerKm: 300,
    });
    expect(result.intensityFactor).toBeCloseTo(150 / 160, 5);
  });

  it('ERG: never passes pace into IF resolution even though distance+duration are present (Pitfall 6)', () => {
    const withoutHr = resolveRunSegment({
      activityType: 'erg',
      durationS: 1200,
      distanceM: 4000,
      thresholdPaceSecPerKm: 300,
    });
    // A distance+duration erg split WOULD produce a pace (300 sec/km), but since no HR is
    // present and the pace must be gated out for erg, IF must fall back to neutral 1.0 with
    // a warning -- not the pace-derived value the running threshold would otherwise imply.
    expect(withoutHr.intensityFactor).toBe(1.0);
    expect(withoutHr.warnings.length).toBeGreaterThan(0);
  });

  it('ERG: resolves IF from HR when present', () => {
    const result = resolveRunSegment({
      activityType: 'erg',
      durationS: 1200,
      distanceM: 4000,
      avgHr: 170,
      thresholdHr: 170,
    });
    expect(result.intensityFactor).toBeCloseTo(1.0, 5);
  });

  it('CONDITIONING: no distance/pace concept; resolves from HR or falls back to neutral 1.0', () => {
    const withHr = resolveRunSegment({
      activityType: 'conditioning',
      durationS: 1800,
      avgHr: 165,
      thresholdHr: 165,
    });
    expect(withHr.intensityFactor).toBeCloseTo(1.0, 5);
    expect(withHr.paceSecPerKm).toBeUndefined();

    const withoutHr = resolveRunSegment({
      activityType: 'conditioning',
      durationS: 1800,
    });
    expect(withoutHr.intensityFactor).toBe(1.0);
    expect(withoutHr.warnings.length).toBeGreaterThan(0);
  });

  it('returns a valid EnduranceStressDetail-shaped es alongside the resolved IF', () => {
    const result = resolveRunSegment({
      activityType: 'run',
      durationS: 3600,
      distanceM: 12000,
      thresholdPaceSecPerKm: 300,
    });
    expect(result.es).toBeGreaterThan(0);
    expect(typeof result.es).toBe('number');
  });
});
