/**
 * apps/mobile/lib/shareCard.ts
 *
 * Pure share-card formatting logic, factored out so it is unit-testable under vitest without
 * importing `@apsis/db` (whose barrel eagerly opens the native op-sqlite JSI connection at
 * module load) or any Expo native module. Zero I/O, zero wall-clock reads -- mirrors
 * `lib/runEntryLogic.ts`'s vitest-testability boundary and `@apsis/engine`'s purity
 * convention (08-RESEARCH.md Pattern 3 analog).
 *
 * D-03 stat-trio formatters (08-03): reuse the EXACT volume/duration/distance/pace math
 * `finish.tsx`/`detail.tsx` already use (`formatVolume`, `formatSessionDuration`,
 * `formatEnduranceSummary`/`formatEnduranceMeta`) so the card's numbers never drift from what
 * the athlete already saw on those screens.
 */

import { formatPaceMinSec, kgToDisplayLb, kmToDisplayMi, paceSecPerKmToSecPerMi, type Units } from '@apsis/shared';

export type ShareSessionType = 'strength' | 'endurance';

/** A single labeled value in the D-03 fixed stat trio, e.g. { label: 'VOLUME', value: '4820 KG' }. */
export interface ShareStatPair {
  label: string;
  value: string;
}

export interface ShareCardStrengthStats {
  totalVolumeKg: number;
  setCount: number;
  durationS: number;
}

export interface ShareCardEnduranceStats {
  distanceM: number | null;
  paceSecPerKm: number | null;
  durationS: number;
}

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

// Compact h:mm:ss / m:ss duration -- mirrors finish.tsx's formatSessionDuration convention
// (duplicated here per the codebase's established small-presentation-helper convention; see
// detail.tsx's formatEnduranceMeta comment for the same duplication).
function formatShareDuration(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = Math.floor(totalSeconds % 60);
  return hours > 0
    ? `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
    : `${minutes}:${String(seconds).padStart(2, '0')}`;
}

/**
 * D-03 fixed core stat trio for a strength (or hybrid) session: total non-warmup volume, set
 * count, session duration. Always returns exactly 3 pairs.
 */
export function buildStrengthStatTrio(stats: ShareCardStrengthStats, units: Units): ShareStatPair[] {
  const volumeValue =
    units === 'imperial' ? `${kgToDisplayLb(stats.totalVolumeKg)} LB` : `${Math.round(stats.totalVolumeKg)} KG`;
  const setsValue = `${stats.setCount} SET${stats.setCount === 1 ? '' : 'S'}`;

  return [
    { label: 'VOLUME', value: volumeValue },
    { label: 'SETS', value: setsValue },
    { label: 'DURATION', value: formatShareDuration(stats.durationS) },
  ];
}

/**
 * D-03 fixed core stat trio for an endurance session: distance, pace, duration. A null
 * distance/pace (e.g. a conditioning-style segment with no distance) degrades gracefully to a
 * dash rather than being omitted, since this builder always returns exactly 3 pairs.
 */
export function buildEnduranceStatTrio(stats: ShareCardEnduranceStats, units: Units): ShareStatPair[] {
  const distanceValue =
    stats.distanceM != null
      ? units === 'imperial'
        ? `${kmToDisplayMi(stats.distanceM / 1000).toFixed(1)} MI`
        : `${(stats.distanceM / 1000).toFixed(1)} KM`
      : '—';
  const paceValue =
    stats.paceSecPerKm != null
      ? `${formatPaceMinSec(units === 'imperial' ? paceSecPerKmToSecPerMi(stats.paceSecPerKm) : stats.paceSecPerKm)} /${units === 'imperial' ? 'MI' : 'KM'}`
      : '—';

  return [
    { label: 'DISTANCE', value: distanceValue },
    { label: 'PACE', value: paceValue },
    { label: 'DURATION', value: formatShareDuration(stats.durationS) },
  ];
}
