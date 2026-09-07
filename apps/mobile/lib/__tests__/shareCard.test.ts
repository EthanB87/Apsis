/**
 * apps/mobile/lib/__tests__/shareCard.test.ts
 *
 * RED/GREEN coverage for `buildShareCaption` (D-04): mono "LIFT/RUN — MON D" caption for
 * both session types across several dates, including a single-digit day (no zero-padding)
 * and a December month-index boundary.
 *
 * Also covers `buildStrengthStatTrio`/`buildEnduranceStatTrio` (D-03): fixed 3-pair stat
 * trios for both session types across both unit systems, singular/plural set counts, and a
 * null-distance conditioning-style endurance case.
 */

import { describe, expect, it } from 'vitest';
import { buildEnduranceStatTrio, buildShareCaption, buildStrengthStatTrio } from '../shareCard';

describe('buildShareCaption', () => {
  it('strength session -> "LIFT — AUG 3"', () => {
    expect(buildShareCaption('strength', '2026-08-03')).toBe('LIFT — AUG 3');
  });

  it('endurance session -> "RUN — AUG 3"', () => {
    expect(buildShareCaption('endurance', '2026-08-03')).toBe('RUN — AUG 3');
  });

  it('does not zero-pad single-digit days', () => {
    expect(buildShareCaption('strength', '2026-01-05')).toBe('LIFT — JAN 5');
  });

  it('resolves the December month-index boundary correctly', () => {
    expect(buildShareCaption('endurance', '2026-12-25')).toBe('RUN — DEC 25');
  });

  it('handles a two-digit day', () => {
    expect(buildShareCaption('strength', '2026-11-30')).toBe('LIFT — NOV 30');
  });
});

describe('buildStrengthStatTrio', () => {
  it('returns exactly 3 pairs, metric units, plural sets', () => {
    const trio = buildStrengthStatTrio({ totalVolumeKg: 4820.4, setCount: 12, durationS: 3725 }, 'metric');
    expect(trio).toHaveLength(3);
    expect(trio).toEqual([
      { label: 'VOLUME', value: '4820 KG' },
      { label: 'SETS', value: '12 SETS' },
      { label: 'DURATION', value: '1:02:05' },
    ]);
  });

  it('converts to imperial volume and uses singular "SET" for a set count of 1', () => {
    const trio = buildStrengthStatTrio({ totalVolumeKg: 100, setCount: 1, durationS: 65 }, 'imperial');
    expect(trio).toEqual([
      { label: 'VOLUME', value: '220 LB' },
      { label: 'SETS', value: '1 SET' },
      { label: 'DURATION', value: '1:05' },
    ]);
  });

  it('formats zero/near-zero duration as "0:00"', () => {
    const trio = buildStrengthStatTrio({ totalVolumeKg: 50, setCount: 2, durationS: 0 }, 'metric');
    expect(trio[2]).toEqual({ label: 'DURATION', value: '0:00' });
  });
});

describe('buildEnduranceStatTrio', () => {
  it('returns exactly 3 pairs, metric distance/pace/duration', () => {
    const trio = buildEnduranceStatTrio({ distanceM: 10000, paceSecPerKm: 300, durationS: 3000 }, 'metric');
    expect(trio).toHaveLength(3);
    expect(trio).toEqual([
      { label: 'DISTANCE', value: '10.0 KM' },
      { label: 'PACE', value: '5:00 /KM' },
      { label: 'DURATION', value: '50:00' },
    ]);
  });

  it('converts distance/pace to imperial', () => {
    const trio = buildEnduranceStatTrio({ distanceM: 8046.72, paceSecPerKm: 300, durationS: 3000 }, 'imperial');
    expect(trio).toEqual([
      { label: 'DISTANCE', value: '5.0 MI' },
      { label: 'PACE', value: '8:03 /MI' },
      { label: 'DURATION', value: '50:00' },
    ]);
  });

  it('degrades a null distance/pace to a dash rather than omitting the pair', () => {
    const trio = buildEnduranceStatTrio({ distanceM: null, paceSecPerKm: null, durationS: 1800 }, 'metric');
    expect(trio).toEqual([
      { label: 'DISTANCE', value: '—' },
      { label: 'PACE', value: '—' },
      { label: 'DURATION', value: '30:00' },
    ]);
  });
});
