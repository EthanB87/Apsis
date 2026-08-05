---
phase: 09-beta-feedback-round-1
plan: 02
subsystem: food-quantity-units
tags: [units, conversion, food-logging, tdd]
dependency-graph:
  requires: []
  provides:
    - packages/shared/src/units.ts::ozToGramsExact
    - packages/shared/src/units.ts::gramsToDisplayOz
    - packages/shared/src/units.ts::lbToGramsExact
    - packages/shared/src/units.ts::gramsToDisplayLb
    - apps/mobile/lib/foodUnits.ts::availableUnitsFor
    - apps/mobile/lib/foodUnits.ts::qtyToGrams
    - apps/mobile/lib/foodUnits.ts::gramsToDisplayQty
  affects:
    - "09-07 (food-quantity chip row UI plan) — thin wiring layer over this plan's tested math"
tech-stack:
  added: []
  patterns:
    - "Fixed-factor exact-round-trip conversion (extends existing kg/lb discipline in units.ts)"
    - "Conditional unit availability gated entirely on food.servingGrams presence (no fabricated density table)"
key-files:
  created:
    - apps/mobile/lib/foodUnits.ts
    - apps/mobile/lib/__tests__/foodUnits.test.ts
  modified:
    - packages/shared/src/units.ts
    - packages/shared/src/__tests__/units.test.ts
decisions:
  - "G_PER_OZ = 28.349523125 (exact avoirdupois ounce); G_PER_LB = G_PER_OZ * 16 — new food-specific constants, distinct from the existing kg-based LB_PER_KG (lifting loads vs food quantities are different unit domains)"
  - "gramsToDisplayOz rounds to whole oz; gramsToDisplayLb rounds to 0.1 lb (D-08 Claude's discretion, matches kgToDisplayLbFractional's existing 0.1 lb precedent)"
  - "tsp/tbsp availability uses the SAME conditional gate as 'serving' (D-07: 'same conditional-availability mechanism as tsp/tbsp') — food.servingGrams finite > 0, not a separate volumetric-basis check"
  - "tsp/tbsp gram conversion anchors to the food's OWN servingGrams (tbsp = 1x servingGrams, tsp = servingGrams/3, per the 1 tbsp = 3 tsp volume-to-volume fact) rather than any universal density constant — satisfies D-06's 'no fabricated water-standard density' rule because two different foods with different servingGrams never share a tsp/tbsp gram value"
metrics:
  duration: ~4min
  completed: 2026-08-04
status: complete
actuals:
  tokens: 4185
  tasks: 2
  commits: 4
---

# Phase 9 Plan 02: Food Quantity Unit Conversion Helpers Summary

Fixed-factor oz/lb-food conversion helpers extending `packages/shared/src/units.ts`'s existing exact-round-trip discipline, plus a new `apps/mobile/lib/foodUnits.ts` module that gates tsp/tbsp/serving unit availability entirely on `food.servingGrams` presence — zero fabricated densities, storage stays grams.

## What Was Built

**Task 1 — `packages/shared/src/units.ts`:** Added `G_PER_OZ` (28.349523125, exact avoirdupois ounce) and `G_PER_LB` constants, plus `ozToGramsExact`/`gramsToDisplayOz` (whole-oz round-trip) and `lbToGramsExact`/`gramsToDisplayLb` (0.1 lb round-trip) — distinct from the existing kg-based lb helpers, which serve lifting loads not food quantities. Followed RED (failing tests) then GREEN (implementation) exactly.

**Task 2 — `apps/mobile/lib/foodUnits.ts` (new):** `availableUnitsFor(food)` always returns `g`/`kg`/`oz`/`lb`; adds `serving`/`tsp`/`tbsp` only when `food.servingGrams` is a finite positive value (D-06/D-07). `qtyToGrams(qty, unit, food)` composes Task 1's shared helpers for fixed-factor units and the food's own `servingGrams` for conditional ones; `gramsToDisplayQty` is the inverse for chip-switch reinterpretation (D-08). Every input clamps to finite non-negative before arithmetic (V5, mirrors `logFood.ts`'s `clampNonNegative`).

## Deviations from Plan

None — plan executed exactly as written. The tsp/tbsp derivation formula (servingGrams-anchored, tbsp=1x/tsp=servingGrams/3) was Claude's discretion per D-08/RESEARCH.md Pattern 3's `qty * (food.servingGrams / servingQtyImplied)` guidance, not a deviation from a specified formula.

## TDD Gate Compliance

Both tasks followed strict RED→GREEN:
- `fdff1f8` test(09-02): failing tests for units.ts oz/lb helpers (confirmed 8 failing before GREEN)
- `6211677` feat(09-02): units.ts implementation (29/29 passing after)
- `c78376c` test(09-02): failing tests for foodUnits.ts (confirmed module-not-found before GREEN)
- `ac9be9c` feat(09-02): foodUnits.ts implementation (21/21 passing after)

## Verification

- `pnpm --filter @apsis/shared test` — 29/29 passing (2 test files)
- `pnpm --filter @apsis/mobile test foodUnits` — 21/21 passing
- `pnpm --filter @apsis/mobile test` (full suite) — 101/101 passing
- `pnpm typecheck` (root `tsc --build`) — clean, no errors

## Known Stubs

None. Both modules are fully implemented pure functions with no placeholder logic.

## Self-Check: PASSED

- FOUND: apps/mobile/lib/foodUnits.ts
- FOUND: apps/mobile/lib/__tests__/foodUnits.test.ts
- FOUND: packages/shared/src/units.ts (modified)
- FOUND: packages/shared/src/__tests__/units.test.ts (modified)
- FOUND commit fdff1f8, 6211677, c78376c, ac9be9c in `git log --oneline`
