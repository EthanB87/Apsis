/**
 * Behavioral tests for packages/shared/src/units.ts (ONB-04, D-12).
 * Storage stays metric; display-only conversions must round-trip exactly for whole
 * imperial display values — no `224.9` drift artifacts.
 */
import {
  KM_PER_MI,
  LB_PER_KG,
  kgToDisplayLb,
  kmToDisplayMi,
  lbToKgExact,
  miToKmExact,
  paceSecPerKmToSecPerMi,
  paceSecPerMiToSecPerKm,
} from '../units';

describe('lb <-> kg exact round-trip (D-12)', () => {
  it('225 lb round-trips to exactly 225 (no 224.9 drift)', () => {
    const kg = lbToKgExact(225);
    expect(kgToDisplayLb(kg)).toBe(225);
  });

  it('315 lb round-trips to exactly 315', () => {
    const kg = lbToKgExact(315);
    expect(kgToDisplayLb(kg)).toBe(315);
  });

  it('kgToDisplayLb is Math.round of kg * LB_PER_KG', () => {
    const kg = 102.058;
    expect(kgToDisplayLb(kg)).toBe(Math.round(kg * LB_PER_KG));
    expect(kgToDisplayLb(kg)).toBe(225);
  });
});

describe('km <-> mi round-trip', () => {
  it('round-trips a whole-number mile value back to itself after display rounding', () => {
    const mi = 5;
    const km = miToKmExact(mi);
    const displayMi = kmToDisplayMi(km);
    expect(Math.round(displayMi)).toBe(mi);
  });
});

describe('pace sec/km <-> sec/mi round-trip', () => {
  it('converts a 300 s/km pace to sec/mi and back within 1s tolerance', () => {
    const secPerKm = 300;
    const secPerMi = paceSecPerKmToSecPerMi(secPerKm);
    const roundTripped = paceSecPerMiToSecPerKm(secPerMi);
    expect(Math.abs(roundTripped - secPerKm)).toBeLessThanOrEqual(1);
  });
});

describe('constants', () => {
  it('KM_PER_MI is the standard conversion factor', () => {
    expect(KM_PER_MI).toBeCloseTo(1.609344, 6);
  });

  it('LB_PER_KG is the standard conversion factor', () => {
    expect(LB_PER_KG).toBeCloseTo(2.2046226218, 9);
  });
});
