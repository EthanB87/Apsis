---
status: complete
phase: 07-nutrition-tracking
source: [07-VERIFICATION.md]
started: 2026-07-13T23:55:00Z
updated: 2026-07-13T23:55:00Z
---

## Current Test

number: complete
name: All tests processed
expected: |
  4 passed, 1 issue (label OCR macro parsing) — gap diagnosis in progress.
awaiting: gap closure

## Tests

### 1. Barcode scan on a physical device
expected: Scan a real EAN-13/UPC-A product barcode in the new dev build — local cache miss → OFF lookup → product resolves → FoodConfirmSheet opens with correct serving/macros → confirm logs a food_log row. (Requires the fresh EAS dev build — expo-camera/expo-text-extractor are not in the current dev client.)
result: pass

### 2. Label OCR with real printed labels
expected: Photograph a real printed US "Nutrition Facts" label and a real EU per-100g label — Apple Vision OCR extracts text; per-serving figures normalize to per-100g when a serving size is found; confirm sheet pre-fills sane values matching the physical label.
result: descoped
reason: "Apple Vision fragmented real labels too unreliably to extract macros/serving (only kcal parsed); after a fix attempt (07-11) still failed on-device. Owner decision 2026-07-20: remove label OCR entirely, ship manual logging + barcode scanning. Feature deleted (NUTR-11/12 descoped), not a code gap."

### 3. First on-device migration run
expected: Install the new build over an existing install (and on a fresh install) — useMigrations() applies 0000–0004 cleanly; the 5 nutrition tables + 3 profile columns exist; PRAGMA foreign_keys=ON does not trip on existing data; app boots normally.
result: pass

### 4. Repeat-food logging speed bar (≤3 taps)
expected: Log a favorite/recent food twice via the search tab — second log takes ≤3 taps total (tap food row → confirm sheet preselected → tap Log food) and feels MacroFactor/MFP fast.
result: pass

### 5. Set EXPO_PUBLIC_USDA_FDC_API_KEY as an EAS secret
expected: Ops action (not a code test): register a free USDA FDC API key and set it as an EAS secret BEFORE the Phase 6 production build, so usdaSearch stops falling back to DEMO_KEY (30 req/hr). Code degrades gracefully without it.
result: pass
source: automated
note: Set 2026-07-14 via eas env:create (development/preview/production, sensitive visibility) on @apsistraining/apsis; dev build 560e0521 built with it and remote lookups verified on-device in tests 1-2.

## Summary

total: 5
passed: 4
issues: 0
pending: 0
descoped: 1
skipped: 0
blocked: 0

## Gaps

- truth: "Label OCR pre-fills kcal AND protein/carbs/fat/serving accurately from a real printed Nutrition Facts label"
  status: descoped
  reason: "Two on-device attempts (07-09 original, 07-11 fragmented-line rewrite) both failed to extract macros/serving reliably from real labels. Owner decided 2026-07-20 to remove label OCR rather than ship a feature that mis-parses food data. label-scan.tsx, labelOcrParse.ts + tests deleted; expo-text-extractor removed; NUTR-11/NUTR-12 descoped. Manual logging + barcode scanning remain as the food-entry paths."
  severity: descoped
  test: 2
