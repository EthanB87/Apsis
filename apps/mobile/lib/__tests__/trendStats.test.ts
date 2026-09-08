/**
 * apps/mobile/lib/__tests__/trendStats.test.ts
 *
 * RED/GREEN coverage for `trendStats.ts` (quick task 260907-qe6 Task 2): pure presentation-
 * layer aggregates (max/mean/count/subtraction) over already-persisted `load_daily` rows. Zero
 * `@apsis/db` / `react-native` imports (mirrors the Settings demo-data planner module's own
 * vitest-testability discipline) -- these tests run under plain Node.
 */

import { describe, expect, it } from 'vitest';
import {
  computeTrendStats,
  formatScrubTooltip,
  formatSignedDelta,
  formatTrendDateLabel,
  sliceRange,
  type TrendStatRow,
} from '../trendStats';

function row(localDate: string, dayHss: number, atl = 0, ctl = 0, tsb = 0): TrendStatRow {
  return { localDate, dayHss, atl, ctl, tsb, readinessBand: 'calibrating' };
}

// 10 chronological (oldest-first) rows, enough to exercise the 8-rows-back delta window.
const TEN_ROWS: TrendStatRow[] = [
  row('2026-07-01', 40, 10, 5, 5),
  row('2026-07-02', 0, 12, 6, 6),
  row('2026-07-03', 50, 14, 7, 7),
  row('2026-07-04', 30, 16, 8, 8),
  row('2026-07-05', 0, 18, 9, 9),
  row('2026-07-06', 60, 20, 10, 10),
  row('2026-07-07', 20, 22, 11, 11),
  row('2026-07-08', 90, 24, 12, 12),
  row('2026-07-09', 10, 26, 13, 13),
  row('2026-07-10', 0, 28, 14, 14),
];

describe('computeTrendStats', () => {
  it('returns null for empty input', () => {
    expect(computeTrendStats([])).toBeNull();
  });

  it("current atl/ctl/tsb equal the LAST row's values, not the first", () => {
    const stats = computeTrendStats(TEN_ROWS)!;
    expect(stats.atl).toBe(28);
    expect(stats.ctl).toBe(14);
    expect(stats.tsb).toBe(14);
  });

  it('computes 7-day deltas as last minus the row 8 slots back', () => {
    const stats = computeTrendStats(TEN_ROWS)!;
    // last row index 9, 8 back is index 2 (row('2026-07-03', ..., 14, 7, 7))
    expect(stats.atlDelta7).toBe(28 - 14);
    expect(stats.ctlDelta7).toBe(14 - 7);
    expect(stats.tsbDelta7).toBe(14 - 7);
  });

  it('returns null deltas (never a fabricated 0) when fewer than 8 rows exist', () => {
    const stats = computeTrendStats(TEN_ROWS.slice(0, 7))!;
    expect(stats.atlDelta7).toBeNull();
    expect(stats.ctlDelta7).toBeNull();
    expect(stats.tsbDelta7).toBeNull();
  });

  it('peakHss is the max dayHss and peakDate is the FIRST occurrence on a tie', () => {
    const tied: TrendStatRow[] = [row('2026-08-01', 50), row('2026-08-02', 90), row('2026-08-03', 90)];
    const stats = computeTrendStats(tied)!;
    expect(stats.peakHss).toBe(90);
    expect(stats.peakDate).toBe('2026-08-02');
  });

  it('restDays counts rows whose dayHss is exactly 0 (real calendar-contiguous rows, not gaps)', () => {
    const stats = computeTrendStats(TEN_ROWS)!;
    expect(stats.restDays).toBe(3); // 07-02, 07-05, 07-10
  });

  it('avgHss is the mean dayHss across ALL rows including rest days, and days equals rows.length', () => {
    const stats = computeTrendStats(TEN_ROWS)!;
    const sum = 40 + 0 + 50 + 30 + 0 + 60 + 20 + 90 + 10 + 0;
    expect(stats.avgHss).toBeCloseTo(sum / 10);
    expect(stats.days).toBe(10);
  });
});

describe('sliceRange', () => {
  it('returns the LAST n rows in chronological order', () => {
    const sliced = sliceRange(TEN_ROWS, 3);
    expect(sliced.map((r) => r.localDate)).toEqual(['2026-07-08', '2026-07-09', '2026-07-10']);
  });

  it('returns every row unchanged when rows.length <= n (never pads)', () => {
    expect(sliceRange(TEN_ROWS, 10)).toEqual(TEN_ROWS);
    expect(sliceRange(TEN_ROWS, 90)).toEqual(TEN_ROWS);
  });
});

describe('formatSignedDelta', () => {
  it('renders +4, the U+2212 minus sign for negatives, +0 for zero, and — for null', () => {
    expect(formatSignedDelta(4)).toBe('+4');
    expect(formatSignedDelta(-3)).toBe('−3');
    expect(formatSignedDelta(0)).toBe('+0');
    expect(formatSignedDelta(null)).toBe('—');
  });
});

describe('formatTrendDateLabel', () => {
  it('renders "MON D" with withDay, and just "MON" without it', () => {
    expect(formatTrendDateLabel('2026-07-08', { withDay: true })).toBe('JUL 8');
    expect(formatTrendDateLabel('2026-07-08')).toBe('JUL');
  });
});

describe('formatScrubTooltip', () => {
  it('renders the full D-20 line for a typical day', () => {
    const r = row('2026-07-08', 65, 42, 38, 4);
    expect(formatScrubTooltip(r)).toBe('JUL 8 · HSS 65 · ATL 42 · CTL 38 · TSB +4');
  });

  it('still renders ATL/CTL/TSB on a rest day (dayHss: 0) -- EWMA always has values', () => {
    const r = row('2026-07-09', 0, 43, 39, -1);
    expect(formatScrubTooltip(r)).toBe('JUL 9 · HSS 0 · ATL 43 · CTL 39 · TSB −1');
  });

  it('renders negative TSB with the U+2212 minus sign, never an ASCII hyphen', () => {
    const r = row('2026-07-10', 50, 44, 40, -6);
    const line = formatScrubTooltip(r);
    expect(line).toContain('TSB −6');
    expect(line).not.toMatch(/-\d/);
  });

  it("renders zero TSB using formatSignedDelta(0)'s signed-zero form", () => {
    const r = row('2026-07-11', 20, 45, 41, 0);
    expect(formatScrubTooltip(r)).toBe(`JUL 11 · HSS 20 · ATL 45 · CTL 41 · TSB ${formatSignedDelta(0)}`);
  });

  it('rounds fractional dayHss/atl/ctl to integers', () => {
    const r = row('2026-07-12', 42.6, 30.4, 28.5, 2);
    expect(formatScrubTooltip(r)).toBe('JUL 12 · HSS 43 · ATL 30 · CTL 29 · TSB +2');
  });

  it('starts with formatTrendDateLabel(localDate, { withDay: true }) -- the shared date formatter, not a second copy', () => {
    const r = row('2026-07-13', 10, 5, 5, 1);
    expect(formatScrubTooltip(r).startsWith(formatTrendDateLabel(r.localDate, { withDay: true }))).toBe(true);
  });
});
