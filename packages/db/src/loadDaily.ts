/**
 * @apsis/db — pure load_daily recompute-row builder (RESEARCH Pattern 1, Pitfalls 2 & 3).
 *
 * `computeLoadDailyUpsertRows` is the testable, I/O-free core of the full-history
 * `load_daily` recompute: it groups finished-session HSS values by localDate, gap-fills a
 * calendar-contiguous date range from the athlete's first-ever session through a
 * caller-supplied `today`, and composes `@apsis/engine`'s `dailyHSS` + `computeLoadTrendSeries`
 * over that array — never a hand-rolled EWMA (Anti-Patterns, RESEARCH).
 *
 * The op-sqlite read + upsert wrapper around this pure function lives in apps/mobile
 * (Plan 04-03); this module performs no DB access and never reads the wall clock — `today`
 * is always passed in by the caller (mirrors the engine's own purity rule).
 */

import { dailyHSS, computeLoadTrendSeries } from '@apsis/engine';
import type { ReadinessBand } from '@apsis/shared';

export interface LoadDailyUpsertRow {
  localDate: string;
  dayHss: number;
  atl: number;
  ctl: number;
  tsb: number;
  readinessBand: ReadinessBand;
}

/**
 * Parses a `YYYY-MM-DD` string and returns the next calendar day as the same format.
 * Pure and timezone-stable: constructs the `Date` from explicit y/m/d components (never via
 * a locale-sensitive string constructor) and re-serializes from `getFullYear`/`getMonth`/
 * `getDate` so DST transitions in the host timezone can never skip or repeat a day.
 */
function nextLocalDateString(dateStr: string): string {
  const [year, month, day] = dateStr.split('-').map((part) => Number.parseInt(part, 10));
  const d = new Date(year, month - 1, day);
  d.setDate(d.getDate() + 1);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

/**
 * Pure recompute-row builder (RESEARCH Pattern 1). `sessions` is every finished, non-deleted
 * workout's `{ localDate, hss }` (already filtered by the caller's query — see
 * `sessionCountsByDate`/history query builders for the soft-delete convention this composes
 * with). Returns `[]` when there are no sessions yet (nothing to roll up).
 */
export function computeLoadDailyUpsertRows(
  sessions: { localDate: string; hss: number }[],
  today: string,
): LoadDailyUpsertRow[] {
  if (sessions.length === 0) {
    return [];
  }

  const byDate = new Map<string, number[]>();
  for (const session of sessions) {
    const list = byDate.get(session.localDate) ?? [];
    list.push(session.hss);
    byDate.set(session.localDate, list);
  }

  const firstDate = [...byDate.keys()].sort()[0]!;

  // Calendar-contiguous date range — rest days must appear as explicit 0s (Pitfall 3).
  const dates: string[] = [];
  for (let d = firstDate; d <= today; d = nextLocalDateString(d)) {
    dates.push(d);
  }

  const dailyArray = dates.map((d) => dailyHSS(byDate.get(d) ?? []));
  const series = computeLoadTrendSeries(dailyArray);

  return dates.map((localDate, i) => ({
    localDate,
    dayHss: dailyArray[i]!,
    atl: series[i]!.atl,
    ctl: series[i]!.ctl,
    tsb: series[i]!.tsb,
    readinessBand: series[i]!.band,
  }));
}
