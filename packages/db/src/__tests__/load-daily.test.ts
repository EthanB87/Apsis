/**
 * load-daily.test.ts — pure recompute-row builder tests (RESEARCH Pattern 1, Pitfalls 2 & 3).
 * No DB access — `computeLoadDailyUpsertRows` is a pure function over `{ localDate, hss }[]`.
 */

import { computeLoadTrendSeries } from '@apsis/engine';
import { computeLoadDailyUpsertRows } from '../loadDaily';

describe('computeLoadDailyUpsertRows', () => {
  it('returns [] for empty input', () => {
    expect(computeLoadDailyUpsertRows([], '2026-07-04')).toEqual([]);
  });

  it('gap-fills a 3-day gap between two sessions with explicit 0 dayHss rows (Pitfall 3)', () => {
    const rows = computeLoadDailyUpsertRows(
      [
        { localDate: '2026-07-01', hss: 100 },
        { localDate: '2026-07-04', hss: 100 },
      ],
      '2026-07-04',
    );

    expect(rows).toHaveLength(4);
    expect(rows.map((r) => r.localDate)).toEqual([
      '2026-07-01',
      '2026-07-02',
      '2026-07-03',
      '2026-07-04',
    ]);
    expect(rows.map((r) => r.dayHss)).toEqual([100, 0, 0, 100]);
  });

  it('applies the double-session penalty when a day has >1 session', () => {
    const rows = computeLoadDailyUpsertRows(
      [
        { localDate: '2026-07-01', hss: 50 },
        { localDate: '2026-07-01', hss: 50 },
      ],
      '2026-07-01',
    );

    expect(rows).toHaveLength(1);
    expect(rows[0]!.dayHss).toBeGreaterThan(100); // strictly > arithmetic sum of 50 + 50
  });

  it('anchors the first date to the lexicographically smallest session localDate', () => {
    const rows = computeLoadDailyUpsertRows(
      [
        { localDate: '2026-07-03', hss: 10 },
        { localDate: '2026-07-01', hss: 20 },
      ],
      '2026-07-03',
    );

    expect(rows[0]!.localDate).toBe('2026-07-01');
    expect(rows).toHaveLength(3);
  });

  it("the last row's atl/ctl/tsb equal computeLoadTrendSeries run over the same contiguous array's final point", () => {
    const sessions = [
      { localDate: '2026-06-01', hss: 80 },
      { localDate: '2026-06-03', hss: 120 },
      { localDate: '2026-06-05', hss: 60 },
    ];
    const today = '2026-06-06';
    const rows = computeLoadDailyUpsertRows(sessions, today);

    const dailyArray = rows.map((r) => r.dayHss);
    const expectedSeries = computeLoadTrendSeries(dailyArray);
    const expectedLast = expectedSeries[expectedSeries.length - 1]!;
    const actualLast = rows[rows.length - 1]!;

    expect(actualLast.atl).toBeCloseTo(expectedLast.atl, 9);
    expect(actualLast.ctl).toBeCloseTo(expectedLast.ctl, 9);
    expect(actualLast.tsb).toBeCloseTo(expectedLast.tsb, 9);
    expect(actualLast.readinessBand).toBe(expectedLast.band);
  });
});
