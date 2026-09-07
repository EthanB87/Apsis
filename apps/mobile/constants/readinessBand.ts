/**
 * apps/mobile/constants/readinessBand.ts
 *
 * The single band→color source of truth (quick task 260907-qe6, D-01/D-02) consumed by BOTH
 * `ReadinessLight` (the home status dot) and the `/trends` readiness-band history strip -- the
 * two can never drift apart, mirroring the shared `calibratingCaption` precedent already
 * established in `components/home/TrendChart.tsx`.
 */

import type { ReadinessBand } from '@apsis/shared';

import Colors from './Colors';

export const BAND_COLOR: Record<'green' | 'amber' | 'red', string> = {
  green: Colors.dark.accent,
  amber: Colors.dark.warning,
  red: Colors.dark.destructive,
};

/** Maps any `ReadinessBand` (including `'calibrating'`) to its display color. */
export function bandColor(band: ReadinessBand): string {
  if (band === 'calibrating') return Colors.dark.steel;
  return BAND_COLOR[band];
}
