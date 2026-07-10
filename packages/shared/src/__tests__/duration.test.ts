/**
 * Behavioral tests for packages/shared/src/duration.ts (RUN-02, D-11).
 * Digits fill right-to-left into an hh:mm:ss buffer; totalSeconds is always a flat
 * arithmetic sum, never clamped mid-entry (RESEARCH Pattern 2).
 */
import { parseDurationDigits } from '../duration';

describe('parseDurationDigits', () => {
  it("'4530' yields 45:30 / 2730s", () => {
    expect(parseDurationDigits('4530')).toEqual({ totalSeconds: 2730, display: '45:30' });
  });

  it("'13000' yields 1:30:00 / 5400s", () => {
    expect(parseDurationDigits('13000')).toEqual({ totalSeconds: 5400, display: '1:30:00' });
  });

  it('empty input returns 0:00 / 0s', () => {
    expect(parseDurationDigits('')).toEqual({ totalSeconds: 0, display: '0:00' });
  });

  it("'5' returns 0:05 / 5s", () => {
    expect(parseDurationDigits('5')).toEqual({ totalSeconds: 5, display: '0:05' });
  });

  it('a 7+ digit input keeps only the last 6 digits', () => {
    const sevenDigit = parseDurationDigits('1234567');
    const lastSix = parseDurationDigits('234567');
    expect(sevenDigit).toEqual(lastSix);
  });

  it('strips non-digit characters before parsing', () => {
    expect(parseDurationDigits('4:5:30')).toEqual(parseDurationDigits('4530'));
  });
});
