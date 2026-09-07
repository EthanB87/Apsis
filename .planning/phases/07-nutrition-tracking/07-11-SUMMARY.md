---
phase: 07-nutrition-tracking
plan: 11
subsystem: nutrition (label OCR parsing)
tags: [ocr, regex, parsing, nutrition-facts, vitest, gap-closure]

# Dependency graph
requires:
  - phase: 07-nutrition-tracking (plan 09)
    provides: labelOcrParse.ts pure parser + label-scan.tsx capture→OCR→parse→confirm chain
provides:
  - Anchor + bounded-forward-scan extraction for protein/carb/fat/serving, matching extractKcal's
    existing next-line fallback strategy, so a real Apple Vision-fragmented label row (nutrient
    name and gram value on separate recognized lines) still parses correctly
  - "Total Carb." abbreviation support and "Og"->"0g" OCR-misread tolerance
  - Extended fixture suite proving the fix on real fragmented-Vision shapes without regressing the
    previously-working merged/single-line path
affects: [07-UAT.md (Test 2 gap), verify-work re-test]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Anchor + bounded-forward-scan: locate a nutrient's anchor line, try an inline capture first,
      else scan the next 1-2 lines for a standalone value, aborting the instant a scanned line
      matches a DIFFERENT nutrient's anchor keyword (shared `scanAnchoredValue` helper)"

key-files:
  created: []
  modified:
    - apps/mobile/lib/labelOcrParse.ts
    - apps/mobile/lib/__tests__/labelOcrParse.test.ts

key-decisions:
  - "Total-Carbohydrate/Total-Fat precedence over their bare fallbacks is preserved by returning
    the headline anchor's scan result outright (even undefined) rather than falling through to a
    bare-line search elsewhere on the label — this is also what makes the carb scan correctly
    return undefined instead of stealing Dietary Fiber's value"
  - "NUTRIENT_ANCHOR_KEYWORDS boundary set (calories/protein/fat/carb/fiber/sugar/sodium/
    cholesterol/serving) is a single shared list used by every extractor's forward-scan stop
    condition, per the plan's explicit single-anchor-set instruction"

requirements-completed: [NUTR-11, NUTR-12]

coverage:
  - id: D1
    description: "Fragmented-Vision label rows (nutrient name and gram value split across separate
      OCR lines) now extract protein/carbs/fat/serving via the same anchor + bounded-forward-scan
      strategy extractKcal already used, including CR-01 per-serving normalization engaging from a
      fragmented serving row, a boundary guard preventing carb from stealing Dietary Fiber's value,
      'Total Carb.' abbreviation support, and Og->0g misread tolerance -- all without regressing the
      previously-working merged/single-line path."
    requirement: NUTR-11
    verification:
      - kind: unit
        ref: "apps/mobile/lib/__tests__/labelOcrParse.test.ts#labelOcrParse — fragmented Vision output (gap closure, UAT Test 2)"
        status: pass
      - kind: unit
        ref: "apps/mobile/lib/__tests__/labelOcrParse.test.ts#labelOcrParse (11 pre-existing regression cases)"
        status: pass
    human_judgment: false
  - id: D2
    description: "On a REAL printed US Nutrition Facts label (physical device, real camera OCR —
      not a fixture), protein/carbs/fat and serving size now pre-fill in the confirm form alongside
      kcal, matching the physical label (UAT Test 2 re-test)."
    requirement: NUTR-12
    verification: []
    human_judgment: true
    rationale: "Requires photographing a real physical label with the on-device camera and Apple
      Vision text recognizer; no fixture or unit test can substitute for the actual OCR fragmentation
      behavior of a real device/label combination — this is the phase UAT re-test called out in the
      plan's <verification> section."

# Metrics
duration: 6min
completed: 2026-07-14
status: complete
---

# Phase 07 Plan 11: Label OCR Fragmented-Row Parsing (Gap Closure) Summary

**Rewrote labelOcrParse's four macro/serving extractors to the anchor + bounded-forward-scan strategy already proven by extractKcal, closing the UAT Test 2 gap where only calories parsed reliably on real fragmented Vision output.**

## Performance

- **Duration:** 6 min
- **Started:** 2026-07-14T02:05:30Z
- **Completed:** 2026-07-14T02:11:37Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- `extractProteinG`, `extractCarbG`, `extractFatG`, `extractServing` rewritten onto a shared
  `scanAnchoredValue` helper (generalized from `extractKcal`'s existing next-line fallback) that
  tries an inline capture first, then scans up to 2 following lines for a standalone value —
  aborting the instant it hits a *different* nutrient's anchor keyword.
- The boundary guard is what prevents the carb scan from stealing Dietary Fiber's gram value, and
  Total Fat from stealing Saturated/Trans Fat's — proven by dedicated fixtures.
- `extractServing`'s fragmented path (anchor line + next-line value scan) means a real right-aligned
  new-format FDA serving row now yields `servingGrams`, which is what makes CR-01
  per-serving→per-100g normalization actually engage instead of silently passing a raw per-serving
  kcal figure through as if it were per-100g.
- Added "Total Carb." abbreviation matching and "Og"→"0g" OCR-misread normalization (a genuine 0g
  reading now returns `0`, not `undefined`).
- Extended the fixture suite with `FRAGMENTED_LABEL_LINES` (every visual row split into separate
  array elements, matching real Apple Vision output) plus a merged-%DV regression guard, a
  fiber-boundary case, a fiber-non-confusion companion case, Total Carb. abbreviation cases, Og→0g
  cases, and a split nameless-serving case.

## Task Commits

Each task was committed atomically:

1. **Task 1: Add failing fragmented-Vision fixtures (RED)** - `863a0be` (test)
2. **Task 2: Rewrite the four extractors to anchor + bounded forward-scan (GREEN)** - `8b147a5` (feat)

**Plan metadata:** commit created below (docs)

_No REFACTOR commit — the GREEN implementation was already clean; no post-hoc cleanup was needed._

## Files Created/Modified
- `apps/mobile/lib/labelOcrParse.ts` - Four extractors rewritten to anchor + bounded-forward-scan
  via a shared `scanAnchoredValue` helper; added `Total Carb.` abbreviation support and `Og`→`0g`
  normalization; pure/native-import-free boundary, `boundedNonNegative`, CR-01 normalization, 1-dp
  rounding, and never-throw try/catch all preserved unchanged.
- `apps/mobile/lib/__tests__/labelOcrParse.test.ts` - Extended with `FRAGMENTED_LABEL_LINES` and 7
  new `it(...)` cases covering the fragmented-row primary fix, the merged-%DV regression guard, the
  fiber boundary (both directions), the Total Carb. abbreviation, the Og→0g misread, and a split
  nameless serving.

## Decisions Made
- Total-Carbohydrate/Total-Fat headline-row precedence is enforced by returning that anchor's own
  scan result outright (even when `undefined`), never falling through to a bare-keyword line found
  elsewhere on the label — this single rule is what both preserves the existing precedence
  ordering AND produces the correct `undefined` (not a stolen `4`) for the fiber-boundary case.
- A single shared `NUTRIENT_ANCHOR_KEYWORDS` list (calories/protein/fat/carb/fiber/sugar/sodium/
  cholesterol/serving) backs every extractor's forward-scan stop condition, per the plan's explicit
  instruction to define one reusable anchor set rather than per-extractor boundary logic.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `label-scan.tsx` required no changes — the capture→OCR→parse→confirm chain and its editable
  review form were already correct per the diagnosis; only the pure parser needed the fix.
- Ready for the phase UAT re-test (D2 above): photograph a real printed US Nutrition Facts label
  on a physical dev-build device and confirm protein/carbs/fat/serving now pre-fill alongside kcal,
  matching the physical label.
- Full mobile test suite (87 tests, 7 files) and root `tsc --build` both green — no regressions
  introduced by this gap-closure plan.

---
*Phase: 07-nutrition-tracking*
*Completed: 2026-07-14*

## Self-Check: PASSED

- FOUND: apps/mobile/lib/labelOcrParse.ts
- FOUND: apps/mobile/lib/__tests__/labelOcrParse.test.ts
- FOUND: .planning/phases/07-nutrition-tracking/07-11-SUMMARY.md
- FOUND commit 863a0be (test(07-11): RED)
- FOUND commit 8b147a5 (feat(07-11): GREEN)
- TDD gate sequence verified: test(07-11) commit precedes feat(07-11) commit
- `pnpm --filter @apsis/mobile test -- labelOcrParse`: 18/18 passed
- `pnpm --filter @apsis/mobile test`: 87/87 passed (7 files, no regressions)
- `pnpm run typecheck` (root): clean
