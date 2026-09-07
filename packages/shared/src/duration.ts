/**
 * @apsis/shared — smart h:mm:ss digit-entry parser (RUN-02, D-11, RESEARCH Pattern 2)
 * Zero runtime dependencies. A single mono numeric-keypad field fills right-to-left, so
 * typing "4530" reads as "45:30" and "13000" reads as "1:30:00" — digits are always
 * interpreted as the last-typed six characters of an hh:mm:ss buffer.
 */

/**
 * Parses raw numeric-keypad input into a duration. Non-digit characters are stripped, only
 * the last 6 typed digits are kept (older leading digits are pushed out, matching the
 * right-to-left fill), and the remaining digits are split into hh/mm/ss two-digit groups.
 * `totalSeconds` is always a flat arithmetic sum — momentary out-of-range mm/ss groups
 * (e.g. "99" mid-entry) are NOT clamped to 0-59, since they self-correct as more digits are
 * typed (RESEARCH Pattern 2). `display` renders `H:MM:SS` once h > 0, else `M:SS`.
 */
export function parseDurationDigits(raw: string): { totalSeconds: number; display: string } {
  const digits = raw.replace(/[^0-9]/g, '').slice(-6);
  const padded = digits.padStart(6, '0');
  const h = Number.parseInt(padded.slice(0, 2), 10);
  const m = Number.parseInt(padded.slice(2, 4), 10);
  const s = Number.parseInt(padded.slice(4, 6), 10);
  const totalSeconds = h * 3600 + m * 60 + s;
  const display =
    h > 0
      ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
      : `${m}:${String(s).padStart(2, '0')}`;
  return { totalSeconds, display };
}
