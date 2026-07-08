/**
 * Behavioral tests for readinessBand (ENG-06): the calibrating gate + red/amber/green
 * thresholds, including the cold-start never-red guarantee (ROADMAP Phase 02 success
 * criterion 4). Golden ratio values pinned per D-04 defaults (red < -0.30, amber -0.30..-0.10,
 * green >= -0.10); calibratingMinHistoryDays = 14, calibratingCtlFloor = 10 per config.ts.
 */
import { readinessBand, computeLoadTrendSeries } from '../trend';

describe('readinessBand', () => {
  it('returns calibrating when history is below the minimum (short history)', () => {
    expect(readinessBand(0, 5, { historyDays: 5 })).toBe('calibrating');
  });

  it('returns calibrating when ctl is below the floor, even with enough history', () => {
    expect(readinessBand(0, 5, { historyDays: 30 })).toBe('calibrating');
  });

  it('returns red when the tsb/ctl ratio is below the red threshold', () => {
    // ratio = -10 / 20 = -0.5, below bandRedRatio (-0.30)
    expect(readinessBand(-10, 20, { historyDays: 30 })).toBe('red');
  });

  it('returns amber when the tsb/ctl ratio is in the amber band', () => {
    // ratio = -4 / 20 = -0.20, in [-0.30, -0.10)
    expect(readinessBand(-4, 20, { historyDays: 30 })).toBe('amber');
  });

  it('returns green when the tsb/ctl ratio is at or above the amber threshold', () => {
    // ratio = 0 / 20 = 0, >= bandAmberRatio (-0.10)
    expect(readinessBand(0, 20, { historyDays: 30 })).toBe('green');
  });

  it('never returns red for a single cold-start session, regardless of that session HSS (ENG-06)', () => {
    const points = computeLoadTrendSeries([120]);
    expect(points[0].band).toBe('calibrating');
    expect(points[0].band).not.toBe('red');
  });
});
