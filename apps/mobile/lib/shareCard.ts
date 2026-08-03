/**
 * apps/mobile/lib/shareCard.ts
 *
 * Pure share-card formatting logic, factored out so it is unit-testable under vitest without
 * importing `@apsis/db` (whose barrel eagerly opens the native op-sqlite JSI connection at
 * module load) or any Expo native module. Zero I/O, zero wall-clock reads -- mirrors
 * `lib/runEntryLogic.ts`'s vitest-testability boundary and `@apsis/engine`'s purity
 * convention (08-RESEARCH.md Pattern 3 analog).
 */

export type ShareSessionType = 'strength' | 'endurance';

const MONTH_ABBR = [
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

/**
 * D-04: mono session-type + date caption, e.g. "LIFT — AUG 3" / "RUN — AUG 3".
 * `localDate` is the persisted `YYYY-MM-DD` string (workout.localDate) -- never re-derived
 * from the wall clock (this module never reads `Date.now()`).
 */
export function buildShareCaption(sessionType: ShareSessionType, localDate: string): string {
  const [, month, day] = localDate.split('-').map((part) => Number.parseInt(part, 10));
  const label = sessionType === 'strength' ? 'LIFT' : 'RUN';
  return `${label} — ${MONTH_ABBR[(month ?? 1) - 1]} ${day}`;
}
