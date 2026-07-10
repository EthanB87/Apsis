/**
 * @apsis/shared — pure unit-display conversions (D-05, D-12)
 * Zero runtime dependencies. Storage stays metric (kg, km, sec/km) everywhere in the app
 * and engine; these functions ONLY convert for display. Round-trips are exact for whole
 * imperial display values (e.g. `kgToDisplayLb(lbToKgExact(225)) === 225`, never `224.9`).
 */

/** Exact kilograms-per-pound conversion factor (D-12). */
export const LB_PER_KG = 2.2046226218;

/** Exact kilometers-per-mile conversion factor. */
export const KM_PER_MI = 1.609344;

/**
 * Convert a display pound value to exact storage kilograms (no rounding). Used when a user
 * enters/steps a value in lb; the app always stores metric.
 */
export function lbToKgExact(lb: number): number {
  return lb / LB_PER_KG;
}

/**
 * Convert stored kilograms to a rounded display pound value (D-12). Rounds to the nearest
 * whole lb so `kgToDisplayLb(lbToKgExact(225)) === 225` — never `224.9`.
 */
export function kgToDisplayLb(kg: number): number {
  return Math.round(kg * LB_PER_KG);
}

/**
 * Convert stored kilograms to a display pound value rounded to the nearest 0.1 lb,
 * preserving fractional plate loads: `kgToDisplayLbFractional(lbToKgExact(62.5)) === 62.5`,
 * never `63`. Use this wherever the user ENTERS or STEPS a load in lb (set logging), so a
 * typed half-pound value survives the kg round-trip; keep `kgToDisplayLb` for read-only
 * whole-lb summaries.
 */
export function kgToDisplayLbFractional(kg: number): number {
  return Math.round(kg * LB_PER_KG * 10) / 10;
}

/** Convert stored kilometers to a display mile value (no rounding applied here). */
export function kmToDisplayMi(km: number): number {
  return km / KM_PER_MI;
}

/** Convert a display mile value to exact storage kilometers (no rounding). */
export function miToKmExact(mi: number): number {
  return mi * KM_PER_MI;
}

/** Convert a pace in seconds-per-km to seconds-per-mile. */
export function paceSecPerKmToSecPerMi(secPerKm: number): number {
  return secPerKm * KM_PER_MI;
}

/** Convert a pace in seconds-per-mile to seconds-per-km. */
export function paceSecPerMiToSecPerKm(secPerMi: number): number {
  return secPerMi / KM_PER_MI;
}

/**
 * Formats a total-seconds pace value as "M:SS" (e.g. 270 -> "4:30"). Pure display
 * formatting only — no unit conversion; pass sec/km or sec/mi depending on the
 * caller's display context (onboarding threshold-pace estimate preview, the
 * ProfileReview row, and Settings all share this so pace formatting never drifts).
 */
export function formatPaceMinSec(totalSec: number): string {
  const rounded = Math.round(totalSec);
  const minutes = Math.floor(rounded / 60);
  const seconds = rounded % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}
