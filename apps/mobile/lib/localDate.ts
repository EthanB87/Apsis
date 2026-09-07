/**
 * apps/mobile/lib/localDate.ts — shared local-time (never UTC) date helpers.
 *
 * Single source of truth for the `YYYY-MM-DD` day-boundary convention every Phase 4 read/write
 * must share (RESEARCH Pitfall 4): the run form's date picker, `recomputeLoadDaily`'s "today"
 * boundary, and `log/index.tsx`'s `workout.localDate` insert all derive the same day string via
 * these two functions — never a locale/UTC-based alternative.
 */

/**
 * Local (not UTC) YYYY-MM-DD serialization of an arbitrary `Date` (04-05: the run form's date
 * sheet needs this for whatever day the user picks, not just "today" — extracted here rather
 * than duplicated inline so there is still exactly one local-date formatter, per this file's
 * Pitfall 4 single-source-of-truth rule).
 */
export function dateToLocalDateStr(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/** Local (not UTC) YYYY-MM-DD — day boundaries must reflect the athlete's own calendar day. */
export function todayLocalDate(): string {
  return dateToLocalDateStr(new Date());
}

/**
 * Parses a `YYYY-MM-DD` string, adds `n` calendar days (via the local-time `Date` constructor,
 * never a locale-sensitive string parse), and re-serializes as `YYYY-MM-DD`.
 */
export function addDaysLocal(dateStr: string, n: number): string {
  const [year, month, day] = dateStr.split('-').map((part) => Number.parseInt(part, 10));
  const d = new Date(year, month - 1, day);
  d.setDate(d.getDate() + n);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}
