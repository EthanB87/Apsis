/**
 * apps/mobile/lib/trendStats.ts
 *
 * Pure presentation-layer aggregates over already-persisted `load_daily` rows (quick task
 * 260907-qe6 Task 2): max, mean, count, and a subtraction of two already-stored numbers. No
 * new training-science math, no EWMA -- `packages/engine` stays untouched. This module imports
 * nothing from `@apsis/db` or `react-native`, so it lands inside `apps/mobile/vitest.config.mts`'s
 * `lib/**` include, mirroring `runEntryLogic.ts`'s pure-vs-native split (the same discipline
 * the Settings demo-data planner module already established).
 *
 * `TREND_RANGES` is the single source of numbers the /trends range switcher (Task 3) and the
 * one-time `recentTrend(db, 365)` read both derive from -- 365 is this table's largest `days`
 * value, never a separately hand-typed magic number.
 */

export interface TrendStatRow {
  localDate: string;
  dayHss: number;
  atl: number;
  ctl: number;
  tsb: number;
  readinessBand: 'green' | 'amber' | 'red' | 'calibrating';
}

export interface TrendStats {
  atl: number;
  ctl: number;
  tsb: number;
  /** Last value minus the value 8 rows back (a 7-day-apart comparison); null with <8 rows --
   * never a fabricated 0. */
  atlDelta7: number | null;
  ctlDelta7: number | null;
  tsbDelta7: number | null;
  peakHss: number;
  /** localDate of peakHss's FIRST occurrence on a tie. */
  peakDate: string;
  /** Count of rows whose dayHss is exactly 0 -- load_daily is calendar-contiguous, so these
   * are real explicit rest-day rows, never gaps. */
  restDays: number;
  /** Mean dayHss across every row in the window, including rest days. */
  avgHss: number;
  days: number;
}

export const MONTH_ABBR = [
  'JAN',
  'FEB',
  'MAR',
  'APR',
  'MAY',
  'JUN',
  'JUL',
  'AUG',
  'SEP',
  'OCT',
  'NOV',
  'DEC',
];

export const TREND_RANGES = [
  { key: '28D', days: 28 },
  { key: '90D', days: 90 },
  { key: '1Y', days: 365 },
] as const;

/**
 * Computes the stats block's aggregate values over a chronological (oldest-first) window of
 * `load_daily` rows. Returns `null` for an empty window -- the screen branches on that rather
 * than rendering a grid of fabricated zeros.
 */
export function computeTrendStats(rows: TrendStatRow[]): TrendStats | null {
  if (rows.length === 0) return null;

  const last = rows[rows.length - 1]!;
  const eightBack = rows.length >= 8 ? rows[rows.length - 8]! : undefined;

  let peakHss = rows[0]!.dayHss;
  let peakDate = rows[0]!.localDate;
  let restDays = 0;
  let sumHss = 0;

  for (const row of rows) {
    if (row.dayHss > peakHss) {
      peakHss = row.dayHss;
      peakDate = row.localDate;
    }
    if (row.dayHss === 0) restDays += 1;
    sumHss += row.dayHss;
  }

  return {
    atl: last.atl,
    ctl: last.ctl,
    tsb: last.tsb,
    atlDelta7: eightBack ? last.atl - eightBack.atl : null,
    ctlDelta7: eightBack ? last.ctl - eightBack.ctl : null,
    tsbDelta7: eightBack ? last.tsb - eightBack.tsb : null,
    peakHss,
    peakDate,
    restDays,
    avgHss: sumHss / rows.length,
    days: rows.length,
  };
}

/**
 * Returns the LAST `days` entries of `rows` in their original (chronological) order. Returns
 * every row unchanged when `rows.length <= days` -- it NEVER pads to reach a target length
 * (D-01/D-22 discipline). Generic so both the raw 365-row `TrendStatRow[]` window and any
 * derived chart-point array can share this one slicing rule.
 */
export function sliceRange<T>(rows: T[], days: number): T[] {
  if (rows.length <= days) return rows;
  return rows.slice(rows.length - days);
}

/**
 * Signed delta formatter matching TrendChart.tsx's `formatSignedTsb` convention exactly: a
 * leading `+` for positive/zero, the U+2212 minus sign (not a hyphen) for negative, and an
 * em dash for `null` (never a fabricated 0).
 */
export function formatSignedDelta(value: number | null): string {
  if (value === null) return '—';
  const rounded = Math.round(value);
  return rounded > 0 ? `+${rounded}` : rounded < 0 ? `−${Math.abs(rounded)}` : '+0';
}

/**
 * Formats a `YYYY-MM-DD` local-date string as `"MON D"` (`withDay: true`) or just `"MON"`
 * (month abbreviation only, for denser axis labels at wider ranges).
 */
export function formatTrendDateLabel(localDate: string, opts?: { withDay?: boolean }): string {
  const [, month, day] = localDate.split('-').map((part) => Number.parseInt(part, 10));
  const monthLabel = MONTH_ABBR[(month ?? 1) - 1];
  return opts?.withDay ? `${monthLabel} ${day}` : `${monthLabel}`;
}

/**
 * Single source of the D-19/D-20 scrub tooltip line (04-UI-SPEC.md section 5) -- COMPOSES the
 * existing `formatTrendDateLabel` and `formatSignedDelta` rather than re-implementing date or
 * sign formatting, so the home chart (TrendChart.tsx's `tooltipText`, the format of record
 * until the two can be unified after quick task 260907-qe6b lands) and this detail screen's
 * tooltip can never drift apart on copy.
 */
export function formatScrubTooltip(row: TrendStatRow): string {
  const dateLabel = formatTrendDateLabel(row.localDate, { withDay: true });
  const hss = Math.round(row.dayHss);
  const atl = Math.round(row.atl);
  const ctl = Math.round(row.ctl);
  const tsb = formatSignedDelta(row.tsb);
  return `${dateLabel} · HSS ${hss} · ATL ${atl} · CTL ${ctl} · TSB ${tsb}`;
}
