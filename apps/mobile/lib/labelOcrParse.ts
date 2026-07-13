/**
 * apps/mobile/lib/labelOcrParse.ts
 *
 * Pure nutrition-label text parser (NUTR-11, 07-RESEARCH.md Pitfall 9), factored the same way
 * as `runEntryLogic.ts`: it receives an already-extracted `string[]` of recognized text lines
 * as a plain parameter and never imports the native OCR module itself, so it stays
 * unit-testable under plain vitest with zero database-package / Expo native imports.
 *
 * OCR output is UNTRUSTED input (T-07-20, mitigate): every regex-extracted numeric is
 * bounds-checked before being returned — negative values are dropped, absurd values (e.g. a
 * >50,000 kcal reading, or a macro above a sane per-serving ceiling) are dropped, and any
 * field the parser cannot confidently extract is left `undefined` (never coerced to `0`) so
 * the caller's confirm/edit form shows a blank the user must fill in, not a silently-wrong
 * number. This module never throws — every code path degrades to `undefined` fields on
 * malformed/garbage input, mirroring `computePaceSecPerKm`'s never-divide-by-zero discipline.
 *
 * `Calories` on many printed labels is a large standalone number rendered as its own visual
 * block — Apple's on-device text recognizer commonly returns that number as a *separate* line
 * from the "Calories" label itself. `labelOcrParse` accounts for this by also checking the line
 * immediately following a bare "Calories" line for a standalone numeric value.
 *
 * PER-SERVING → PER-100G NORMALIZATION (CR-01): US "Nutrition Facts" labels state kcal/macros
 * PER SERVING, not per 100g, while this parser's result fields (and the `food` row they
 * pre-fill) are per-100g. When a serving size in grams is extracted from the same label, every
 * macro value is normalized by `100 / servingGrams` before being returned — e.g. "Calories 230"
 * on a "Serving size 1 cup (240g)" label yields `kcalPer100g ≈ 95.8`, so logging one 240 g
 * serving computes back to the label's 230 kcal. Without this, per-serving values stored as
 * per-100g double-scale at log time (a 2.4× kcal overstatement in that example). When no
 * serving grams are found, values pass through unchanged (per-100g-style labels, e.g. the EU
 * format, carry no serving-size line) — the user-review form remains the final gate.
 */

const MAX_KCAL = 50_000;
const MAX_MACRO_G = 2_000;
const MAX_SERVING_G = 5_000;

/** Partial, bounds-checked pre-fill extracted from a nutrition label's recognized text lines.
 * Every field is `undefined` when the parser could not confidently/safely extract it. */
export interface LabelOcrResult {
  kcalPer100g?: number;
  proteinGPer100g?: number;
  carbGPer100g?: number;
  fatGPer100g?: number;
  servingName?: string;
  servingGrams?: number;
}

function parseNumber(text: string | undefined): number | undefined {
  if (text == null) return undefined;
  const n = Number.parseFloat(text);
  return Number.isFinite(n) ? n : undefined;
}

/** Drops non-finite, negative, and above-ceiling values — never returns `0` for a rejected
 * value, since `0` would silently read as a real (and very wrong) macro/kcal amount. */
function boundedNonNegative(value: number | undefined, max: number): number | undefined {
  if (value == null || !Number.isFinite(value) || value < 0 || value > max) return undefined;
  return value;
}

function extractKcal(lines: string[]): number | undefined {
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!/calories/i.test(line)) continue;
    const inline = /calories\s*:?\s*(-?\d+(?:\.\d+)?)/i.exec(line);
    if (inline != null) return parseNumber(inline[1]);
    // "Calories" label with the number rendered as its own OCR text block — check the next
    // recognized line for a standalone number before giving up on this "Calories" line.
    const next = lines[i + 1];
    if (next != null) {
      const standalone = /^\s*(-?\d+(?:\.\d+)?)\s*$/.exec(next);
      if (standalone != null) return parseNumber(standalone[1]);
    }
  }
  return undefined;
}

function extractProteinG(lines: string[]): number | undefined {
  for (const line of lines) {
    const m = /protein\s*:?\s*(-?\d+(?:\.\d+)?)\s*g/i.exec(line);
    if (m != null) return parseNumber(m[1]);
  }
  return undefined;
}

function extractCarbG(lines: string[]): number | undefined {
  for (const line of lines) {
    const m = /total\s+carbohydrate[s]?\s*:?\s*(-?\d+(?:\.\d+)?)\s*g/i.exec(line);
    if (m != null) return parseNumber(m[1]);
  }
  for (const line of lines) {
    const m = /carbohydrate[s]?\s*:?\s*(-?\d+(?:\.\d+)?)\s*g/i.exec(line);
    if (m != null) return parseNumber(m[1]);
  }
  return undefined;
}

function extractFatG(lines: string[]): number | undefined {
  for (const line of lines) {
    const m = /total\s+fat\s*:?\s*(-?\d+(?:\.\d+)?)\s*g/i.exec(line);
    if (m != null) return parseNumber(m[1]);
  }
  // Fallback generic "Fat" line — explicitly skip "Saturated Fat"/"Trans Fat" sub-lines so they
  // never get mistaken for the label's headline total-fat figure.
  for (const line of lines) {
    if (/saturated|trans/i.test(line)) continue;
    const m = /\bfat\s*:?\s*(-?\d+(?:\.\d+)?)\s*g/i.exec(line);
    if (m != null) return parseNumber(m[1]);
  }
  return undefined;
}

interface RawServing {
  servingName?: string;
  servingGrams?: number;
}

function extractServing(lines: string[]): RawServing {
  for (const line of lines) {
    const m = /serving\s*size\s*:?\s*(.+?)??\(?(-?\d+(?:\.\d+)?)\s*g\)?/i.exec(line);
    if (m != null) {
      const rawName = m[1]?.trim().replace(/[,(]+$/, '').trim();
      return {
        servingName: rawName != null && rawName.length > 0 ? rawName : undefined,
        servingGrams: parseNumber(m[2]),
      };
    }
  }
  return {};
}

/**
 * Regex-extracts kcal/protein/carb/fat/serving from a nutrition label's recognized text lines.
 * Bounds-checks every numeric value (Pitfall 9): negative values are dropped, absurd values
 * are dropped, un-extractable fields are left `undefined`. When a serving size in grams was
 * extracted, kcal/macro values are normalized from the label's per-serving figures to per-100g
 * (CR-01 — see module doc comment); rounded to 1 decimal so the review form pre-fills a sane
 * number. Never throws, regardless of input — malformed, empty, or garbage `lines` all resolve
 * to an all-`undefined` result.
 */
export function labelOcrParse(lines: string[]): LabelOcrResult {
  try {
    const safeLines = Array.isArray(lines) ? lines.filter((l): l is string => typeof l === 'string') : [];

    const serving = extractServing(safeLines);
    const servingGrams = boundedNonNegative(serving.servingGrams, MAX_SERVING_G);

    // CR-01: US labels state values per serving — normalize to per-100g when the serving size
    // (grams) was extracted in the same pass. No serving size → pass through unchanged.
    const scale = servingGrams != null && servingGrams > 0 ? 100 / servingGrams : 1;
    const norm = (v: number | undefined): number | undefined =>
      v != null ? Math.round(v * scale * 10) / 10 : undefined;

    return {
      kcalPer100g: norm(boundedNonNegative(extractKcal(safeLines), MAX_KCAL)),
      proteinGPer100g: norm(boundedNonNegative(extractProteinG(safeLines), MAX_MACRO_G)),
      carbGPer100g: norm(boundedNonNegative(extractCarbG(safeLines), MAX_MACRO_G)),
      fatGPer100g: norm(boundedNonNegative(extractFatG(safeLines), MAX_MACRO_G)),
      servingName: serving.servingName,
      servingGrams,
    };
  } catch (err: unknown) {
    console.error('[Apsis] labelOcrParse failed on malformed input:', err);
    return {};
  }
}
