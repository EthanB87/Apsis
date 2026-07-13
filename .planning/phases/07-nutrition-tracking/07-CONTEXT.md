# Phase 07: Nutrition Tracking - Context

**Gathered:** 2026-07-13
**Status:** Ready for planning
**Source:** PRD Express Path (NUTRITION.md, repo root)

<domain>
## Phase Boundary

Nutrition tracking for hybrid athletes, promoted from v2 into v1 scope (owner decision
2026-07-13). Delivers: manual food logging (search/recents/favorites/custom foods/quick-add),
barcode scanning with a staged lookup chain, nutrition-label OCR into custom foods, custom
recipes/meals, and day-type adaptive daily kcal/macro targets driven by the day's logged
training. RE-SEQUENCED (owner decision 2026-07-13): nutrition ships IN the initial July 28
submission build. Phase 7 executes BEFORE Phase 6's remaining waves — 06-06 (production
build) and 06-07 (submission) wait for Phase 7 code to land on master. Under deadline
pressure, cut from the tail of NUTRITION.md §7 build order (recipes → OCR → barcode);
manual logging + adaptive targets ship regardless.

**Supersedes:** BUILD.md §5's "No nutrition tables in v1.0" line — that constraint reflected
the pre-promotion scope and is overridden by NUTRITION.md.

</domain>

<decisions>
## Implementation Decisions

### Product scope (locked — NUTRITION.md §1)
- Manual food logging: search, recents, favorites, custom foods, full manual macro entry.
  Speed bar: match MacroFactor/MFP entry speed or better; repeat food ≤3 taps.
- Barcode scanning: camera scan → product lookup → confirm serving → log.
- Nutrition label scanning: photo of printed nutrition-facts label → on-device OCR →
  pre-filled custom food the user confirms (kcal/P/C/F, serving size).
- Custom recipes/meals: combine ingredients into a saved meal with per-serving macros.
- Day-type adaptive targets: daily kcal/P/C/F computed from bodyweight, goal mode, AND the
  day's logged training day-type (heavy_lift / long_run / double / rest / mixed).
- Track kcal + macros + sodium/fiber only at launch (no micronutrient depth).

### Explicitly out of scope (locked)
- NO photo-based food recognition / AI plate estimation.
- NO meal plans / recipe content library.
- NO restaurant chain-menu database.
- Micronutrients beyond sodium/fiber deferred.

### Database strategy (locked — NUTRITION.md §3, staged)
- Local-first food cache: every logged food cached on device; repeat logging never hits a
  third-party API (same offline-first principle as training).
- Open Food Facts as free barcode/product base layer (ODbL attribution required in settings).
- USDA FoodData Central for generic/whole foods.
- User-created foods + label-scan entries feed an Apsis-owned dataset (compounding asset);
  label-scan contribution to shared DB requires user consent.
- YMove (~$19/mo) only as an optional bolt-on fallback if OFF's NA barcode miss-rate hurts
  in beta — call it second, cache the result. Not required at launch.
- Barcode lookup chain order: local cache → Apsis DB → OFF → (optional) commercial fallback.
- FatSecret Premier deferred to ~5–10K MAU.

### Label scanning (locked — NUTRITION.md §4)
- On-device OCR via Apple Vision framework (VNRecognizeTextRequest) — free, private, offline.
  No paid OCR API.
- Regex-parse kcal/protein/carbs/fat/serving from recognized text; confirm/edit sheet before
  saving. Every confirmed scan saves as a custom food.

### Data model (locked — NUTRITION.md §5, extends existing drizzle schema)
- `food`: id, name, brand?, barcode?, source('user'|'off'|'usda'|'apsis'|'commercial'),
  per-100g kcal/protein_g/carb_g/fat_g/fiber_g?/sodium_mg?, servingName?, servingGrams?,
  verified(bool), createdByUserId?
- `food_log`: id, userId, localDate, meal('breakfast'|'lunch'|'dinner'|'snack'), foodId?,
  qtyGrams, denormalized kcal/p/c/f for fast day totals, quickAdd(bool).
- `recipe` + `recipe_ingredient` (recipeId, foodId, qtyGrams; recipe has servings).
- `nutrition_target`: userId, localDate, dayType, kcal/protein_g/carb_g/fat_g,
  source('auto'|'override') — generated daily.
- Engine addition in `packages/engine`: `dailyMacroTarget(profile, dayType, sessionKcal) ->
  {kcal,p,c,f}` — pure function, no I/O, no Date.now(), golden-file test treatment like HSS.

### Build order (locked — NUTRITION.md §7)
1. food/food_log schema + manual logging + quick-add
2. day-type target engine function
3. barcode chain with OFF
4. label OCR
5. recipes
Ship 1–2 before 3–5 under timeline pressure — manual logging + adaptive targets is already
a sellable increment.

### Claude's Discretion
- The exact adaptive-target math: NUTRITION.md defers to "the PRD nutrition model (§6)"
  which does NOT exist in this repo. Research/derive a defensible model (protein anchored
  to bodyweight, kcal modulated by day-type and logged training load/HSS, goal-mode
  adjustment); it must be a pure engine function with golden-file tests, and the model
  constants should be tunable via EngineConfig like kStrength/kEndurance were.
- Day-type derivation from logged training (how heavy_lift vs long_run vs double vs mixed
  is classified from the day's workouts).
- UI composition: where nutrition lives in the tab structure, logging flow screens, targets
  display. Follow DESIGN-SYSTEM.md and existing app conventions (volt/void palette,
  one-volt-per-screen, tap-to-type ledger entry patterns from the lifting logger).
- OFF/USDA API client details, caching/TTL, offline behavior for search of uncached foods.
- Barcode scanning module choice (expo-camera vs VisionCamera) — verify SDK 56 compatibility.
- Whether "Apsis DB" (shared user-contributed food dataset) requires any server component:
  v1 has NO backend; if a server is unavoidable for the shared dataset, defer the shared
  contribution to a later phase and keep scans device-local only.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Nutrition scope and strategy
- `NUTRITION.md` — the phase PRD: scope, DB strategy, label scanning, data model, build order

### Project foundation
- `BUILD.md` — v1 architecture/stack decisions (§5 data model this phase extends; note its
  "no nutrition tables in v1.0" line is superseded by NUTRITION.md)
- `DESIGN-SYSTEM.md` — visual language for all new UI
- `.planning/PROJECT.md` — core value, requirements, evolution rules
- `packages/db/src/schema.ts` — existing drizzle schema to extend
- `packages/engine/` — engine purity conventions (pure TS, time passed in, EngineConfig)

</canonical_refs>

<specifics>
## Specific Ideas

- Quality bar (NUTRITION.md §1): search usable result <1s; repeat food ≤3 taps; label scan
  fills a custom food in one shot; barcode hit-rate credible in Canada/US.
- food_log denormalizes kcal/p/c/f so day totals never require joins — mirrors the
  load_daily read-everything-fold-in-memory discipline.
- Engine function gets the same golden-file calibration treatment as HSS (kStrength
  calibration precedent from Phase 02).

</specifics>

<deferred>
## Deferred Ideas

- Micronutrient depth beyond sodium/fiber (NUTRITION.md §1)
- Meal plans / recipes content library
- Restaurant chain-menu database
- FatSecret Premier evaluation (~5–10K MAU)
- YMove commercial fallback (only if OFF NA miss-rate hurts in beta)
- Pricing/SKU mechanics (NUTRITION.md §6) — business decision, not engineering scope;
  premium tier includes nutrition, no add-on SKU

</deferred>

---

*Phase: 07-nutrition-tracking*
*Context gathered: 2026-07-13 via PRD Express Path (NUTRITION.md)*
