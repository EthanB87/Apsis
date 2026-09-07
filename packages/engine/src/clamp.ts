/**
 * @apsis/engine — clamp-and-warn primitive (D-15)
 * Guarantees the engine never throws on bad input: out-of-range and non-finite numeric
 * values are clamped into a valid range and reported via a warning string. Every compute
 * module imports `clampRange` to collect warnings into its detailed result's `warnings[]`.
 */

/** Result of a clamp operation: the (possibly clamped) value plus an optional warning. */
export interface ClampResult {
  value: number;
  warning?: string;
}

/**
 * Clamp `value` into `[min, max]`, returning a warning string when clamping occurred.
 * `NaN` and non-numeric input (`undefined`, a string that sneaks past TypeScript's
 * compile-time-only types — e.g. from the op-sqlite row boundary or a JSON.parse result)
 * are treated as invalid and coerced to `min` with a warning: neither has a meaningful
 * sign, and `undefined < min` / `undefined > max` both silently evaluate to `false`, which
 * previously let `undefined` flow through unclamped and unwarned. `Infinity`/`-Infinity`
 * are numeric and directional, so they fall through to the ordinary `< min` / `> max`
 * comparisons below and clamp to `max`/`min` respectively as before. Never throws.
 */
export function clampRange(value: number, min: number, max: number, label: string): ClampResult {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return { value: min, warning: `${label} ${value} is not a finite number, clamped to ${min}` };
  }
  if (value < min) {
    return { value: min, warning: `${label} ${value} below min ${min}, clamped` };
  }
  if (value > max) {
    return { value: max, warning: `${label} ${value} above max ${max}, clamped` };
  }
  return { value };
}
