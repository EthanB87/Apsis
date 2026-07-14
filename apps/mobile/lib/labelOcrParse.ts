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
 * FRAGMENTED ROWS: Apple's on-device text recognizer (Vision, via expo-text-extractor) commonly
 * returns a single visual label row as *separate* OCR text lines — a nutrient name on one line
 * and its gram/percent value on the next (e.g. "Total Fat" / "8g" / "10%"), and a right-aligned
 * serving value on its own line (e.g. "Serving size" / "2/3 cup (55g)"). Every extractor below
 * (kcal/protein/carb/fat/serving) uses the same anchor + bounded-forward-scan strategy: find the
 * nutrient's anchor line, try an inline capture on that line first, and if that fails scan the
 * next 1-2 lines for a standalone value — ABORTING the moment a scanned line matches a *different*
 * nutrient's anchor keyword. That boundary guard is what stops the carb scan from stealing
 * "Dietary Fiber"'s value, and "Total Fat" from stealing "Saturated Fat"/"Trans Fat"'s.
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

/** Keyword set used as the scan-stop boundary: a scanned forward line matching any of these is
 * treated as the START of a DIFFERENT nutrient's row, not a continuation of the current one. This
 * is what stops the carb scan from stealing "Dietary Fiber"'s value, and "Total Fat" from
 * stealing "Saturated Fat"/"Trans Fat"'s. */
const NUTRIENT_ANCHOR_KEYWORDS = ['calories', 'protein', 'fat', 'carb', 'fiber', 'sugar', 'sodium', 'cholesterol', 'serving'];

function isNutrientAnchorLine(line: string): boolean {
  const lower = line.toLowerCase();
  return NUTRIENT_ANCHOR_KEYWORDS.some((k) => lower.includes(k));
}

function isPercentOrBlankLine(line: string): boolean {
  return /^\s*$/.test(line) || /^\s*-?\d+(?:\.\d+)?\s*%\s*$/.test(line);
}

/** Normalizes a leading "Og"/"O g" OCR misread to "0g" so a genuine 0g label value reads as a
 * real `0`, not an un-extractable `undefined`. Confined to the whole-token "Og" shape. */
function normalizeOgMisread(line: string): string {
  return line.replace(/\bO\s?g\b/gi, '0g');
}

/**
 * Anchor + bounded-forward-scan (shared by kcal/protein/carb/fat): `lines[anchorIndex]` is a
 * line already known to be this nutrient's anchor. Tries `inlinePattern` against the anchor line
 * itself first (the previously-working merged/single-line path), then scans up to the next 2
 * lines — skipping blank/%-only lines — for `valueLinePattern`, ABORTING (returns `undefined`)
 * the instant a scanned line matches a *different* nutrient's anchor keyword.
 */
function scanAnchoredValue(
  lines: string[],
  anchorIndex: number,
  inlinePattern: RegExp,
  valueLinePattern: RegExp,
): number | undefined {
  const anchorLine = normalizeOgMisread(lines[anchorIndex]);
  const inline = inlinePattern.exec(anchorLine);
  if (inline != null) return parseNumber(inline[1]);

  for (let i = anchorIndex + 1; i <= anchorIndex + 2 && i < lines.length; i++) {
    const line = normalizeOgMisread(lines[i]);
    if (isPercentOrBlankLine(line)) continue;
    if (isNutrientAnchorLine(line)) return undefined; // boundary guard — stop, don't steal
    const m = valueLinePattern.exec(line);
    return m != null ? parseNumber(m[1]) : undefined;
  }
  return undefined;
}

const CALORIES_INLINE_RE = /calories\s*:?\s*(-?\d+(?:\.\d+)?)/i;
const CALORIES_VALUE_LINE_RE = /^\s*(-?\d+(?:\.\d+)?)\s*$/;

function extractKcal(lines: string[]): number | undefined {
  for (let i = 0; i < lines.length; i++) {
    if (/calories/i.test(lines[i])) {
      return scanAnchoredValue(lines, i, CALORIES_INLINE_RE, CALORIES_VALUE_LINE_RE);
    }
  }
  return undefined;
}

const PROTEIN_INLINE_RE = /protein\s*:?\s*(-?\d+(?:\.\d+)?)\s*g/i;
const GRAM_VALUE_LINE_RE = /^\s*(-?\d+(?:\.\d+)?)\s*g\b/i;

function extractProteinG(lines: string[]): number | undefined {
  for (let i = 0; i < lines.length; i++) {
    if (/\bprotein\b/i.test(lines[i])) {
      return scanAnchoredValue(lines, i, PROTEIN_INLINE_RE, GRAM_VALUE_LINE_RE);
    }
  }
  return undefined;
}

// "Total Carb." is a common label abbreviation for "Total Carbohydrate" — accept an optional
// trailing "." in place of "ohydrate[s]".
const TOTAL_CARB_ANCHOR_RE = /total\s+carb(?:ohydrate)?s?\.?/i;
const TOTAL_CARB_INLINE_RE = /total\s+carb(?:ohydrate)?s?\.?\s*:?\s*(-?\d+(?:\.\d+)?)\s*g/i;
const BARE_CARB_ANCHOR_RE = /carb(?:ohydrate)?s?\.?/i;
const BARE_CARB_INLINE_RE = /carb(?:ohydrate)?s?\.?\s*:?\s*(-?\d+(?:\.\d+)?)\s*g/i;

function extractCarbG(lines: string[]): number | undefined {
  for (let i = 0; i < lines.length; i++) {
    if (TOTAL_CARB_ANCHOR_RE.test(lines[i])) {
      // Total-Carbohydrate precedence: once the headline row is found, its own scan result
      // (even if undefined — e.g. the boundary guard hit "Dietary Fiber") wins outright; never
      // fall through to a bare "Carbohydrate" line elsewhere on the label.
      return scanAnchoredValue(lines, i, TOTAL_CARB_INLINE_RE, GRAM_VALUE_LINE_RE);
    }
  }
  for (let i = 0; i < lines.length; i++) {
    if (BARE_CARB_ANCHOR_RE.test(lines[i])) {
      return scanAnchoredValue(lines, i, BARE_CARB_INLINE_RE, GRAM_VALUE_LINE_RE);
    }
  }
  return undefined;
}

const TOTAL_FAT_ANCHOR_RE = /total\s+fat/i;
const TOTAL_FAT_INLINE_RE = /total\s+fat\s*:?\s*(-?\d+(?:\.\d+)?)\s*g/i;
const BARE_FAT_INLINE_RE = /\bfat\s*:?\s*(-?\d+(?:\.\d+)?)\s*g/i;

function extractFatG(lines: string[]): number | undefined {
  for (let i = 0; i < lines.length; i++) {
    if (TOTAL_FAT_ANCHOR_RE.test(lines[i])) {
      return scanAnchoredValue(lines, i, TOTAL_FAT_INLINE_RE, GRAM_VALUE_LINE_RE);
    }
  }
  // Fallback generic "Fat" line — explicitly skip "Saturated Fat"/"Trans Fat" sub-lines so they
  // never get mistaken for the label's headline total-fat figure.
  for (let i = 0; i < lines.length; i++) {
    if (/saturated|trans/i.test(lines[i])) continue;
    if (/\bfat\b/i.test(lines[i])) {
      return scanAnchoredValue(lines, i, BARE_FAT_INLINE_RE, GRAM_VALUE_LINE_RE);
    }
  }
  return undefined;
}

interface RawServing {
  servingName?: string;
  servingGrams?: number;
}

const SERVING_INLINE_RE = /serving\s*size\s*:?\s*(.+?)??\(?(-?\d+(?:\.\d+)?)\s*g\)?/i;
const SERVING_VALUE_LINE_RE = /^\s*(.+?)??\(?(-?\d+(?:\.\d+)?)\s*g\)?\s*$/i;

function rawServingFromMatch(m: RegExpExecArray): RawServing {
  const rawName = m[1]?.trim().replace(/[,(]+$/, '').trim();
  return {
    servingName: rawName != null && rawName.length > 0 ? rawName : undefined,
    servingGrams: parseNumber(m[2]),
  };
}

function extractServing(lines: string[]): RawServing {
  for (let i = 0; i < lines.length; i++) {
    if (!/serving\s*size/i.test(lines[i])) continue;

    const anchorLine = normalizeOgMisread(lines[i]);
    const inline = SERVING_INLINE_RE.exec(anchorLine);
    if (inline != null && inline[2] != null) return rawServingFromMatch(inline);

    // Fragmented: the "Serving size" anchor line carries no gram value (common on new-format
    // FDA labels, which right-align the serving value) — scan the next 1-2 lines, stopping at
    // any other nutrient anchor, for the value line (e.g. "2/3 cup (55g)" or a bare "30g").
    for (let j = i + 1; j <= i + 2 && j < lines.length; j++) {
      const line = normalizeOgMisread(lines[j]);
      if (isPercentOrBlankLine(line)) continue;
      if (isNutrientAnchorLine(line)) return {};
      const m = SERVING_VALUE_LINE_RE.exec(line);
      return m != null && m[2] != null ? rawServingFromMatch(m) : {};
    }
    return {};
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
