/**
 * apps/mobile/lib/__tests__/healthkitMapping.test.ts
 *
 * RED/GREEN coverage for the pure HealthKit decision logic (D-04 type map, D-05 strength
 * exclusion, D-06 dedupe tolerance, D-13 metadata key, D-17 bodyweight recency, V5/T-05-02
 * clamp-and-warn). Mirrors runEntryLogic.test.ts's plain-vitest style — no @apsis/db, no
 * native-module import anywhere in this file or the module under test.
 */

import { describe, expect, it } from 'vitest';
import {
  DUPE_TOLERANCE,
  HK_ACTIVITY_TYPE,
  HSS_METADATA_KEY,
  bodyweightSampleIsNewer,
  buildHSSMetadata,
  isDuplicateOfExisting,
  mapHKActivityType,
  sanitizeHKNumeric,
} from '../healthkitMapping';

describe('mapHKActivityType (D-04)', () => {
  it('maps running to run', () => {
    expect(mapHKActivityType(HK_ACTIVITY_TYPE.running)).toBe('run');
  });

  it('maps rowing to erg', () => {
    expect(mapHKActivityType(HK_ACTIVITY_TYPE.rowing)).toBe('erg');
  });

  it('maps every conditioning-allowlist type to conditioning', () => {
    const conditioningTypes: number[] = [
      HK_ACTIVITY_TYPE.cycling,
      HK_ACTIVITY_TYPE.highIntensityIntervalTraining,
      HK_ACTIVITY_TYPE.hiking,
      HK_ACTIVITY_TYPE.swimming,
      HK_ACTIVITY_TYPE.elliptical,
      HK_ACTIVITY_TYPE.walking,
      HK_ACTIVITY_TYPE.mixedCardio,
      HK_ACTIVITY_TYPE.mixedMetabolicCardioTraining,
      HK_ACTIVITY_TYPE.crossTraining,
      HK_ACTIVITY_TYPE.stairClimbing,
      HK_ACTIVITY_TYPE.jumpRope,
    ];
    for (const t of conditioningTypes) {
      expect(mapHKActivityType(t)).toBe('conditioning');
    }
  });

  it('maps strength training types to null (D-05 — never imported)', () => {
    expect(mapHKActivityType(HK_ACTIVITY_TYPE.traditionalStrengthTraining)).toBeNull();
    expect(mapHKActivityType(HK_ACTIVITY_TYPE.functionalStrengthTraining)).toBeNull();
  });

  it('maps any unknown/unlisted activity type to null', () => {
    expect(mapHKActivityType(9999)).toBeNull();
  });
});

describe('isDuplicateOfExisting (D-06)', () => {
  it('flags a duration exactly at the +15% boundary as a duplicate', () => {
    // existing 1000s, candidate 1150s -> delta 150 === 1000*0.15 (inclusive boundary)
    expect(isDuplicateOfExisting(1150, 1000)).toBe(true);
  });

  it('flags a duration exactly at the -15% boundary as a duplicate', () => {
    expect(isDuplicateOfExisting(850, 1000)).toBe(true);
  });

  it('does not flag a duration just outside the +15% boundary', () => {
    expect(isDuplicateOfExisting(1151, 1000)).toBe(false);
  });

  it('does not flag a duration just outside the -15% boundary', () => {
    expect(isDuplicateOfExisting(849, 1000)).toBe(false);
  });

  it('exposes DUPE_TOLERANCE as 0.15', () => {
    expect(DUPE_TOLERANCE).toBe(0.15);
  });
});

describe('bodyweightSampleIsNewer (D-17)', () => {
  it('is true when the profile has never had bodyweight set (null)', () => {
    expect(bodyweightSampleIsNewer(new Date('2026-01-01T00:00:00Z'), null)).toBe(true);
  });

  it('is true when the sample is strictly newer than the profile value', () => {
    const sample = new Date('2026-02-01T00:00:00Z');
    const profileSetAt = new Date('2026-01-01T00:00:00Z');
    expect(bodyweightSampleIsNewer(sample, profileSetAt)).toBe(true);
  });

  it('is false when the sample is older than the profile value', () => {
    const sample = new Date('2026-01-01T00:00:00Z');
    const profileSetAt = new Date('2026-02-01T00:00:00Z');
    expect(bodyweightSampleIsNewer(sample, profileSetAt)).toBe(false);
  });

  it('is false when the sample is exactly the same timestamp (not strictly newer)', () => {
    const t = new Date('2026-01-01T00:00:00Z');
    expect(bodyweightSampleIsNewer(t, t)).toBe(false);
  });
});

describe('buildHSSMetadata (D-13)', () => {
  it('returns an object keyed by HSS_METADATA_KEY with the hss value, no calorie fields', () => {
    const metadata = buildHSSMetadata(87.5);
    expect(metadata).toEqual({ [HSS_METADATA_KEY]: 87.5 });
    expect(Object.keys(metadata)).toEqual([HSS_METADATA_KEY]);
    expect(metadata).not.toHaveProperty('calories');
    expect(metadata).not.toHaveProperty('energy');
  });
});

describe('sanitizeHKNumeric (V5/T-05-02)', () => {
  const bounds = { min: 0, max: 200000 };

  it('clamps a negative distance to the minimum and records a warning', () => {
    const result = sanitizeHKNumeric(-50, bounds, 'distanceM');
    expect(result.value).toBe(0);
    expect(result.warnings.length).toBeGreaterThan(0);
  });

  it('discards a NaN duration to null and records a warning', () => {
    const result = sanitizeHKNumeric(NaN, { min: 0, max: 86400 }, 'durationS');
    expect(result.value).toBeNull();
    expect(result.warnings.length).toBeGreaterThan(0);
  });

  it('discards Infinity to null and records a warning', () => {
    const result = sanitizeHKNumeric(Infinity, bounds, 'distanceM');
    expect(result.value).toBeNull();
    expect(result.warnings.length).toBeGreaterThan(0);
  });

  it('discards null/undefined to null with no crash', () => {
    expect(sanitizeHKNumeric(null, bounds, 'distanceM').value).toBeNull();
    expect(sanitizeHKNumeric(undefined, bounds, 'distanceM').value).toBeNull();
  });

  it('clamps an above-maximum value to the maximum and records a warning', () => {
    const result = sanitizeHKNumeric(999999, bounds, 'distanceM');
    expect(result.value).toBe(200000);
    expect(result.warnings.length).toBeGreaterThan(0);
  });

  it('passes an in-range value through unchanged with no warning', () => {
    const result = sanitizeHKNumeric(5000, bounds, 'distanceM');
    expect(result.value).toBe(5000);
    expect(result.warnings).toEqual([]);
  });
});
