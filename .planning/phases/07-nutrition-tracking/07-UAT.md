---
status: testing
phase: 07-nutrition-tracking
source: [07-VERIFICATION.md]
started: 2026-07-13T23:55:00Z
updated: 2026-07-13T23:55:00Z
---

## Current Test

number: 1
name: Barcode scan on a physical device
expected: |
  Local cache miss → OFF network lookup → product resolves → FoodConfirmSheet opens with
  correct serving/macros → confirm logs a food_log row.
awaiting: user response

## Tests

### 1. Barcode scan on a physical device
expected: Scan a real EAN-13/UPC-A product barcode in the new dev build — local cache miss → OFF lookup → product resolves → FoodConfirmSheet opens with correct serving/macros → confirm logs a food_log row. (Requires the fresh EAS dev build — expo-camera/expo-text-extractor are not in the current dev client.)
result: [pending]

### 2. Label OCR with real printed labels
expected: Photograph a real printed US "Nutrition Facts" label and a real EU per-100g label — Apple Vision OCR extracts text; per-serving figures normalize to per-100g when a serving size is found; confirm sheet pre-fills sane values matching the physical label.
result: [pending]

### 3. First on-device migration run
expected: Install the new build over an existing install (and on a fresh install) — useMigrations() applies 0000–0004 cleanly; the 5 nutrition tables + 3 profile columns exist; PRAGMA foreign_keys=ON does not trip on existing data; app boots normally.
result: [pending]

### 4. Repeat-food logging speed bar (≤3 taps)
expected: Log a favorite/recent food twice via the search tab — second log takes ≤3 taps total (tap food row → confirm sheet preselected → tap Log food) and feels MacroFactor/MFP fast.
result: [pending]

### 5. Set EXPO_PUBLIC_USDA_FDC_API_KEY as an EAS secret
expected: Ops action (not a code test): register a free USDA FDC API key and set it as an EAS secret BEFORE the Phase 6 production build, so usdaSearch stops falling back to DEMO_KEY (30 req/hr). Code degrades gracefully without it.
result: [pending]

## Summary

total: 5
passed: 0
issues: 0
pending: 5
skipped: 0
blocked: 0

## Gaps
