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
 * Non-finite input (NaN, Infinity, -Infinity) is treated as out-of-range and coerced to a
 * finite clamped value — NaN is treated as below-min. Never throws.
 */
export function clampRange(value: number, min: number, max: number, label: string): ClampResult {
  if (Number.isNaN(value)) {
    return { value: min, warning: `${label} ${value} below min ${min}, clamped` };
  }
  if (value < min) {
    return { value: min, warning: `${label} ${value} below min ${min}, clamped` };
  }
  if (value > max) {
    return { value: max, warning: `${label} ${value} above max ${max}, clamped` };
  }
  return { value };
}
