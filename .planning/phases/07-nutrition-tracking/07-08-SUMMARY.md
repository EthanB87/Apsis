---
phase: 07-nutrition-tracking
plan: 08
subsystem: nutrition
tags: [expo-camera, open-food-facts, usda-fdc, fetch, abortcontroller, barcode]

# Dependency graph
requires:
  - phase: 07-nutrition-tracking (07-06/07-07)
    provides: shared FoodConfirmSheet component, food/food_log schema, logFood builders,
      nutritionCameraAuth camera-permission gate, expo-camera + expo-text-extractor installed
provides:
  - "apps/mobile/lib/offClient.ts + usdaClient.ts — the app's first outbound network clients
    (Open Food Facts + USDA FoodData Central), each internally timeout-guarded and
    defensive-parsed against crowdsourced/dual-shape third-party data"
  - "apps/mobile/lib/nutritionSearch.ts — local-first search-with-remote-fallback service
    (built, tested indirectly via its remote clients; not yet wired into a search UI)"
  - "apps/mobile/app/(tabs)/nutrition/scan.tsx — barcode scan screen: local cache -> OFF ->
    confirm -> log, with a graceful manual-entry fallback on miss (NUTR-10)"
  - "Open Food Facts ODbL/CC-BY-SA attribution block in Settings (NUTR-21 legal requirement)"
  - "findFoodByBarcode query builder (packages/db) — the local-cache step of the barcode chain"
affects: [07-09-label-ocr, future-remote-search-ui-wiring]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Self-contained network client: each remote fetch client (offClient.ts/usdaClient.ts)
      owns its own AbortController + setTimeout, catches every failure internally, and never
      throws to its caller — the app's first network-client pattern, no prior analog existed"
    - "Defensive third-party parsing: every non-critical nutriment/nutrient field is optional
      (undefined on missing data); a resolved food used for direct logging (offLookupBarcode)
      is only returned once all four core macros are confirmed present, never a zero-macro
      food (Pitfall 7)"
    - "Dual-shape nutrient parsing: usdaClient.ts's findNutrientValue checks both the flat
      (nutrientId/nutrientName/value) and nested (nutrient.{id,name}+amount) USDA response
      shapes by ID first, name-substring fallback second (Pitfall 8)"

key-files:
  created:
    - apps/mobile/lib/offClient.ts
    - apps/mobile/lib/usdaClient.ts
    - apps/mobile/lib/nutritionSearch.ts
    - apps/mobile/lib/__tests__/offClient.test.ts
    - apps/mobile/app/(tabs)/nutrition/scan.tsx
  modified:
    - apps/mobile/app/(tabs)/nutrition/search.tsx
    - apps/mobile/app/(tabs)/settings/index.tsx
    - packages/db/src/nutritionQueries.ts
    - packages/db/src/index.ts
    - packages/db/src/__tests__/nutrition-queries.test.ts

key-decisions:
  - "offLookupBarcode returns null (not a partially-filled candidate) whenever any of the four
    core macros is missing/non-finite — keeps scan.tsx's hit/miss branch a simple null check
    and guarantees a resolved food is always immediately loggable, never a stub"
  - "CameraView's barcodeScannerSettings restricted to ean13/ean8/upc_a/upc_e only (dropped
    'qr' from the RESEARCH.md sketch) — QR isn't a product barcode symbology OFF indexes
    against; scanning one would produce a confusing OFF miss for no benefit"
  - "Barcode miss/error path navigates to the existing nutrition/log.tsx manual-entry screen
    rather than attempting to pre-fill FoodConfirmSheet with partial data — FoodConfirmSheet
    has no macro-editing UI, so a food with unresolved macros cannot be represented there"

requirements-completed: [NUTR-08, NUTR-09, NUTR-10, NUTR-03, NUTR-21, NUTR-22]

coverage:
  - id: D1
    description: "offLookupBarcode resolves a status:1 OFF product with complete macros to
      normalized fields; status:0 and incomplete-macro products resolve to null, never a
      zero-macro food (Pitfall 7)"
    requirement: NUTR-08
    verification:
      - kind: unit
        ref: "apps/mobile/lib/__tests__/offClient.test.ts#offLookupBarcode"
        status: pass
    human_judgment: false
  - id: D2
    description: "Every OFF/USDA fetch is guarded by an internal AbortController timeout and
      never throws on timeout/abort/network failure/non-OK status — degrades to null/[]"
    requirement: NUTR-03
    verification:
      - kind: unit
        ref: "apps/mobile/lib/__tests__/offClient.test.ts (abort/timeout/network-failure cases across offLookupBarcode, offSearch, usdaSearch)"
        status: pass
    human_judgment: false
  - id: D3
    description: "usdaSearch parses both the flat (nutrientId/nutrientName/value) and nested
      (nutrient.{id,name}+amount) USDA foodNutrients shapes identically (Pitfall 8)"
    requirement: NUTR-03
    verification:
      - kind: unit
        ref: "apps/mobile/lib/__tests__/offClient.test.ts#usdaSearch — Pitfall 8 dual-shape parsing"
        status: pass
    human_judgment: false
  - id: D4
    description: "findFoodByBarcode (packages/db) resolves an exact local barcode match
      offline, parameterized (T-1-01)"
    verification:
      - kind: unit
        ref: "packages/db/src/__tests__/nutrition-queries.test.ts#findFoodByBarcode"
        status: pass
    human_judgment: false
  - id: D5
    description: "scan.tsx: camera-permission-gated barcode scan resolves local cache -> OFF ->
      confirm -> log, with a manual-entry fallback on miss (NUTR-10) and no barcode/macro
      value ever reaching a Sentry call (NUTR-22)"
    requirement: NUTR-08
    verification: []
    human_judgment: true
    rationale: "The scan.tsx screen (CameraView, real barcode capture, on-device network
      round-trip to OFF) has no in-repo component test harness — apps/mobile is lib/**-only
      under vitest (documented STATE.md gap). Native-module changes also require a fresh EAS
      dev build before on-device testing (Pitfall 1) which has not occurred this session;
      camera/OFF round-trip flow verification is deferred to phase UAT."
  - id: D6
    description: "Open Food Facts ODbL/CC-BY-SA attribution block ships in Settings (NUTR-21
      legal requirement)"
    requirement: NUTR-21
    verification:
      - kind: other
        ref: 'grep -ci "open food facts\|ODbL" apps/mobile/app/(tabs)/settings/index.tsx => 5'
        status: pass
    human_judgment: false
  - id: D7
    description: "nutritionSearch.ts (local-first cache-through with sparse+online OFF/USDA
      fallback) exists as tested-by-composition infrastructure; NOT yet wired into a search UI"
    requirement: NUTR-03
    verification: []
    human_judgment: true
    rationale: "nutritionSearch.ts imports @apsis/db (searchLocalFoods) so it cannot run under
      the lib/**-only vitest harness (excludes native op-sqlite JSI imports); its own remote
      dependencies (offSearch/usdaSearch) ARE unit-tested via offClient.test.ts. Wiring it into
      search.tsx's UI was out of this plan's declared files_modified/artifacts scope (see Known
      Gaps) — a human/future-plan decision on whether/when to surface remote search in the UI."

duration: 26min
completed: 2026-07-13
status: complete
---

# Phase 07 Plan 08: Barcode Chain + OFF/USDA Clients Summary

**First outbound network layer (OFF + USDA fetch clients, both internally timeout-guarded and defensively parsed) plus a camera-driven barcode scan chain (local cache -> OFF -> confirm -> log) with a graceful manual-entry fallback and OFF license attribution in Settings.**

## Performance

- **Duration:** 26 min
- **Started:** 2026-07-13T22:09:00Z (approx.)
- **Completed:** 2026-07-13T22:35:11Z
- **Tasks:** 2
- **Files modified:** 10 (5 created, 5 modified)

## Accomplishments

- `offClient.ts`/`usdaClient.ts`: the app's first-ever network clients — every fetch wrapped in
  an internal `AbortController` + timeout, never throw, defensively parse crowdsourced OFF data
  (every non-critical field optional) and USDA's two independently-observed `foodNutrients`
  shapes (flat vs. nested)
- `offLookupBarcode` only resolves a product when all four core macros (kcal/protein/carb/fat)
  are present — a `status:0` miss OR an incomplete-macro hit both yield `null`, guaranteeing the
  local `food` cache never receives a silently-zero-macro row
- `nutritionSearch.ts`: local-first search-with-remote-fallback service, built and its remote
  dependencies fully unit-tested; ready for future UI wiring (see Known Gaps)
- `scan.tsx`: camera-permission-gated barcode scan resolving local cache (instant, offline) ->
  OFF network lookup (timeout-guarded) -> confirm serving via the shared `FoodConfirmSheet` ->
  log, with every miss/error path falling through to the existing manual/custom-food entry
  screen (NUTR-10 — never a dead end)
- Open Food Facts ODbL/CC-BY-SA attribution shipped in Settings (NUTR-21)
- `findFoodByBarcode` (packages/db) added as the missing local-cache-lookup step of the barcode
  chain, with a "Scan barcode" entry point wired into `search.tsx` so `scan.tsx` is reachable

## Task Commits

Each task was committed atomically:

1. **Task 1: OFF + USDA fetch clients + local-first nutritionSearch + tests** - `64d6541` (feat)
2. **Task 2: Barcode scan screen (cache->OFF->confirm->log, graceful miss) + OFF attribution** - `fac9eff` (feat)

_Task 1's commit also includes the Rule 2 `findFoodByBarcode` query-builder addition (packages/db) that Task 2's local-cache step depends on._

## Files Created/Modified

- `apps/mobile/lib/offClient.ts` - Open Food Facts fetch client: `offLookupBarcode`, `offSearch`
- `apps/mobile/lib/usdaClient.ts` - USDA FoodData Central fetch client: `usdaSearch`
- `apps/mobile/lib/nutritionSearch.ts` - local-first cache-through with sparse+online remote fallback
- `apps/mobile/lib/__tests__/offClient.test.ts` - mocked-fetch coverage for both remote clients
- `apps/mobile/app/(tabs)/nutrition/scan.tsx` - barcode scan screen (new)
- `apps/mobile/app/(tabs)/nutrition/search.tsx` - added "Scan barcode" entry point (Rule 2)
- `apps/mobile/app/(tabs)/settings/index.tsx` - added OFF attribution block (NUTR-21)
- `packages/db/src/nutritionQueries.ts` - added `findFoodByBarcode` (Rule 2)
- `packages/db/src/index.ts` - exported `findFoodByBarcode`
- `packages/db/src/__tests__/nutrition-queries.test.ts` - added `findFoodByBarcode` coverage

## Decisions Made

- `offLookupBarcode` refuses to resolve a product with any missing core macro, returning `null`
  rather than a candidate flagged for later completion — keeps `scan.tsx`'s branch logic a
  simple null check and guarantees anything resolved is immediately loggable (Pitfall 7)
- Dropped `qr` from `CameraView`'s `barcodeScannerSettings` (RESEARCH.md's sketch included it) —
  QR isn't a product-barcode symbology OFF indexes against; scanning one would only produce a
  confusing miss
- A barcode miss/error navigates to the existing `nutrition/log.tsx` manual-entry screen rather
  than attempting a partial pre-fill of `FoodConfirmSheet` — that shared sheet has no
  macro-editing UI, so a food with unresolved macros can't be represented there

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Added `findFoodByBarcode` to `packages/db/src/nutritionQueries.ts`**
- **Found during:** Task 2 (read_first explicitly flagged: "add a barcode builder if absent")
- **Issue:** The barcode chain's first step — "local `food` WHERE barcode=?" (instant, offline)
  — had no query builder anywhere in the codebase. Without it, `scan.tsx` could not implement
  the local-cache-first step the plan's own must_haves require.
- **Fix:** Added a parameterized `findFoodByBarcode(db, barcode)` builder (mirrors
  `searchLocalFoods`'s shape) and exported it from `packages/db/src/index.ts`.
- **Files modified:** `packages/db/src/nutritionQueries.ts`, `packages/db/src/index.ts`,
  `packages/db/src/__tests__/nutrition-queries.test.ts`
- **Verification:** `pnpm --filter @apsis/db test -- nutrition-queries` — 3 new tests pass
  (exact match, cache-miss empty result, quote-character parameterization proof)
- **Committed in:** `64d6541` (Task 1 commit)

**2. [Rule 2 - Missing Critical] Added a "Scan barcode" entry point to `search.tsx`**
- **Found during:** Task 2, after building `scan.tsx`
- **Issue:** `scan.tsx` auto-registers as an expo-router route but has no navigation entry point
  anywhere in the app — without one it would be unreachable dead code, mirroring the exact
  pattern already documented as a Rule 2 deviation in 07-06's/07-10's own SUMMARYs (the "Log
  food"/"Recipes" buttons on `nutrition/index.tsx`).
- **Fix:** Added a "Scan barcode" `Pressable` to `search.tsx`, next to the existing "Custom food
  / quick add" button.
- **Files modified:** `apps/mobile/app/(tabs)/nutrition/search.tsx`
- **Verification:** `apps/mobile` typechecks clean; manual code review against the existing
  button's exact style/accessibility pattern.
- **Committed in:** `fac9eff` (Task 2 commit)

**3. [Rule 3 - Blocking] `offClient.test.ts` used `globalThis.fetch` instead of `global.fetch`**
- **Found during:** Task 2's plan-level verification (`pnpm run typecheck`, i.e. `tsc --build`)
- **Issue:** `global` is a Node-only identifier; this React Native project's tsconfig has no
  `@types/node`, so `tsc --build` failed with `Cannot find name 'global'` across the test file
  even though `vitest run` (which uses its own runtime, not tsc) passed fine.
- **Fix:** Replaced every `global.fetch` reference with `globalThis.fetch` (a standard ES global
  requiring no additional types).
- **Files modified:** `apps/mobile/lib/__tests__/offClient.test.ts`
- **Verification:** `pnpm run typecheck` clean; `pnpm --filter @apsis/mobile test -- offClient`
  still 13/13 passing after the change.
- **Committed in:** `fac9eff` (Task 2 commit)

---

**Total deviations:** 3 auto-fixed (2 missing-critical, 1 blocking)
**Impact on plan:** All three were necessary for the barcode chain to actually function/compile
and to be reachable in the UI. No scope creep beyond what the plan's own must_haves require.

## Authentication Gates

None — OFF and USDA are unauthenticated (USDA uses a free API key, not an auth flow); no CLI
login was required for this plan's work.

## Known Gaps

- **`nutritionSearch.ts` is not yet wired into a search UI.** The function exists, is correctly
  local-first with a debounced/time-bounded remote fallback, and its remote dependencies are
  fully unit-tested — but `search.tsx` (built in 07-06) still performs local-only search per its
  own doc comment ("No network/fetch call appears in this file"). This plan's `files_modified`/
  `artifacts_produced` scoped remote-search-UI wiring OUT (only `nutritionSearch.ts` itself was
  listed, not a `search.tsx` rewrite) — consistent with NUTRITION.md's "ship 1-2 before 3-5"
  deadline-pressure cutline, which prioritized the barcode chain as this plan's primary UI
  deliverable. A future plan (or a scope decision from the user) should wire `nutritionSearch`
  into `search.tsx` to make NUTR-03's remote-fallback UX actually reachable by a user.
- **Camera/network round-trip is unverified on-device.** Per RESEARCH.md Pitfall 1 and the
  Phase context, on-device camera testing requires a fresh EAS dev build (not yet run this
  session) — `scan.tsx`'s actual CameraView/barcode-detection/OFF-round-trip behavior is
  deferred to phase UAT, consistent with how 07-07 already deferred camera verification.

## Issues Encountered

None beyond the deviations documented above.

## User Setup Required

None new — `EXPO_PUBLIC_USDA_FDC_API_KEY` remains unset (falls back to the public `DEMO_KEY`,
30 req/hr) per the existing 07-USER-SETUP.md-style gap already noted in 07-RESEARCH.md; no new
user action required by this plan specifically.

## Next Phase Readiness

- Barcode chain (NUTR-08/09/10) and OFF attribution (NUTR-21) are code-complete and unit-tested
  where testable; on-device verification awaits an EAS dev build + phase UAT.
- 07-09 (label OCR) can proceed independently — it shares `nutritionCameraAuth.ts` and
  `FoodConfirmSheet` but not this plan's OFF/USDA clients.
- Before phase close: decide whether/when to wire `nutritionSearch.ts` into `search.tsx` (Known
  Gaps above) — currently a legitimate, deliberately-scoped-out gap, not a broken promise, but
  worth an explicit call before Phase 07 is declared complete.

---

*Phase: 07-nutrition-tracking*
*Completed: 2026-07-13*

## Self-Check: PASSED

All created/modified files verified present on disk:
- FOUND: apps/mobile/lib/offClient.ts
- FOUND: apps/mobile/lib/usdaClient.ts
- FOUND: apps/mobile/lib/nutritionSearch.ts
- FOUND: apps/mobile/lib/__tests__/offClient.test.ts
- FOUND: apps/mobile/app/(tabs)/nutrition/scan.tsx
- FOUND: apps/mobile/app/(tabs)/settings/index.tsx
- FOUND: apps/mobile/app/(tabs)/nutrition/search.tsx
- FOUND: packages/db/src/nutritionQueries.ts
- FOUND: packages/db/src/index.ts
- FOUND: packages/db/src/__tests__/nutrition-queries.test.ts

Both task commits verified present in git log:
- FOUND: 64d6541 (Task 1)
- FOUND: fac9eff (Task 2)

Plan-level verification re-run and passing:
- `pnpm --filter @apsis/mobile test -- offClient` — 13/13 passing
- `pnpm -r test` — all 4 workspaces green (183 tests total: shared 21, engine 94, db 62, mobile 66)
- `pnpm run typecheck` (`tsc --build`, the authoritative cross-package check) — clean
- `grep -c "AbortController" apps/mobile/lib/offClient.ts apps/mobile/lib/usdaClient.ts` — 3, 2
- `grep -ci "open food facts\|ODbL" apps/mobile/app/(tabs)/settings/index.tsx` — 5
