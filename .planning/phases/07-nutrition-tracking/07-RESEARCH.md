# Phase 07: Nutrition Tracking - Research

**Researched:** 2026-07-13
**Domain:** Third-party food/nutrition APIs, on-device camera + OCR, sports-nutrition macro modeling, drizzle schema extension
**Confidence:** MEDIUM (stack/API mechanics MEDIUM-HIGH; adaptive-macro-model constants LOW-MEDIUM — PRD §6 does not exist, this research proposes and derives the model from scratch)

## Summary

Phase 7 adds a full nutrition-tracking vertical (manual logging, barcode scan, label OCR,
recipes, adaptive macro targets) to an app that has, until now, been 100% offline with zero
network calls and zero third-party HTTP dependencies. Two genuinely new categories of risk
show up here that the previous six phases never touched: (1) calling external HTTP APIs from
a local-first client with no backend to mediate/cache them, and (2) inventing a sports-nutrition
formula from scratch because the PRD's own §6 (which NUTRITION.md defers to) does not exist in
this repo. Everything else — schema extension, migration bundling, engine purity, EngineConfig
tunables, golden-file tests — is a direct continuation of patterns already proven in Phases
01-06 and should follow them exactly, not reinvent them.

The critical finding that changes the shape of this phase: **`user_profile` currently has no
`heightCm`, `age`/`birthYear`, or `goalMode` column** (verified directly against
`packages/db/src/schema.ts`). NUTRITION.md's adaptive-target model requires all three (a
standard BMR formula needs height+age; "goal-mode adjustment" needs a goal field), and none
exist. This is not an edge case — it blocks the differentiator feature. The plan must include a
small profile-schema migration + a minor onboarding/settings addition, gated the same way
`ONB-03` gates the readiness band today. A second architectural finding: NUTRITION.md's own
proposed schema includes `userId` columns on `food_log`/`recipe`/`nutrition_target`, but **no
table in the existing schema has a `userId` column anywhere** — this is a single-local-user app
with no auth. Carrying `userId` into the new tables would be the first schema inconsistency in
the project. Recommend dropping it.

For the external integrations: Open Food Facts (barcode/product, free, ODbL-attributed) and
USDA FoodData Central (generic/whole foods, free, API-key-gated) are both confirmed live and
reachable, with concrete endpoint shapes captured below. For camera + OCR, **one library covers
both barcode scanning and the label photo capture that feeds OCR** (`expo-camera`'s
`CameraView`), and a single purpose-built Expo module (`expo-text-extractor`) wraps Apple
Vision's on-device `VNRecognizeTextRequest` exactly as NUTRITION.md specifies — no need for
`react-native-vision-camera` or a hand-rolled native module. Both new native packages will
require a fresh EAS dev build before on-device testing, the same gate Phase 04 (Skia) and Phase
05 (HealthKit) both hit.

**Primary recommendation:** Extend `user_profile` with `heightCm`/`birthYear`/`goalMode`; build
`dailyMacroTarget` and a new `classifyDayType` as pure `packages/engine` functions per the
existing EngineConfig/golden-file-test convention; use `expo-camera` alone for both barcode scan
and OCR photo capture; use `expo-text-extractor` for on-device Apple Vision OCR; treat
Open Food Facts as the only network dependency required to hit the Phase 7 "ship 1-2" cutline
(USDA and label OCR can trail).

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Food search / logging UI | Browser/Client (RN component tree) | — | expo-router screens, local component state — identical tier to the existing lifting/run loggers |
| Local food cache | Database/Storage | — | `food` table via op-sqlite/drizzle, on-device, same JSI-synchronous pattern as `workout`/`strength_set` |
| Barcode scan capture | Browser/Client (native module) | — | `expo-camera` `CameraView`, on-device camera hardware, no network |
| Product lookup (OFF, USDA) | External third-party API | Database/Storage (cache-through) | **Apsis has no backend of its own in v1** — the client calls OFF/USDA directly over HTTPS; there is no Apsis-owned API tier mediating these calls. Do not build a proxy/server for this. |
| Label OCR (Apple Vision) | Browser/Client (native module) | — | `expo-text-extractor`, fully on-device, no network, no server round-trip |
| Adaptive macro target computation | packages/engine (pure compute) | Database/Storage (reads `load_daily.dayHss`, `user_profile`) | Mirrors the existing HSS engine exactly: pure TS bundled into the client, not a server-side computation |
| Day-type classification | packages/engine + packages/db query layer | Database/Storage (`workout` rows for the date) | Same split as `computeLoadDailyUpsertRows`: DB layer assembles the day's session data, a pure function classifies it |
| Nutrition target persistence | Database/Storage | — | `nutrition_target` table, generated daily, same shape as `load_daily` |
| Shared "Apsis DB" contribution | **Out of v1 scope** | — | Would require an API/Backend tier that does not exist and is explicitly deferred per CONTEXT.md discretion #6 — do not build in this phase |

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Product scope (locked — NUTRITION.md §1)**
- Manual food logging: search, recents, favorites, custom foods, full manual macro entry.
  Speed bar: match MacroFactor/MFP entry speed or better; repeat food ≤3 taps.
- Barcode scanning: camera scan → product lookup → confirm serving → log.
- Nutrition label scanning: photo of printed nutrition-facts label → on-device OCR →
  pre-filled custom food the user confirms (kcal/P/C/F, serving size).
- Custom recipes/meals: combine ingredients into a saved meal with per-serving macros.
- Day-type adaptive targets: daily kcal/P/C/F computed from bodyweight, goal mode, AND the
  day's logged training day-type (heavy_lift / long_run / double / rest / mixed).
- Track kcal + macros + sodium/fiber only at launch (no micronutrient depth).

**Explicitly out of scope (locked)**
- NO photo-based food recognition / AI plate estimation.
- NO meal plans / recipe content library.
- NO restaurant chain-menu database.
- Micronutrients beyond sodium/fiber deferred.

**Database strategy (locked — NUTRITION.md §3, staged)**
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

**Label scanning (locked — NUTRITION.md §4)**
- On-device OCR via Apple Vision framework (VNRecognizeTextRequest) — free, private, offline.
  No paid OCR API.
- Regex-parse kcal/protein/carbs/fat/serving from recognized text; confirm/edit sheet before
  saving. Every confirmed scan saves as a custom food.

**Data model (locked — NUTRITION.md §5, extends existing drizzle schema)**
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

**Build order (locked — NUTRITION.md §7)**
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

### Deferred Ideas (OUT OF SCOPE)
- Micronutrient depth beyond sodium/fiber (NUTRITION.md §1)
- Meal plans / recipes content library
- Restaurant chain-menu database
- FatSecret Premier evaluation (~5–10K MAU)
- YMove commercial fallback (only if OFF NA miss-rate hurts in beta)
- Pricing/SKU mechanics (NUTRITION.md §6) — business decision, not engineering scope;
  premium tier includes nutrition, no add-on SKU
</user_constraints>

<phase_requirements>
## Proposed Phase Requirements

Phase requirement IDs are **not yet in REQUIREMENTS.md** (confirmed — grep found zero
`NUTR-*` granular IDs, only a single v1.1 placeholder line `NUTR-01: Nutrition / macro
tracking`, now stale since this phase supersedes it). Per the orchestrator's instruction,
this research proposes a granular breakdown derived from NUTRITION.md §1 and CONTEXT.md
`<decisions>`, for the planner/requirements step to formally add to REQUIREMENTS.md
(replacing the single stale v1.1 placeholder).

| Proposed ID | Description | Research Support |
|----|-------------|------------------|
| NUTR-01 | `food`/`food_log`/`recipe`/`recipe_ingredient`/`nutrition_target` schema ships via committed drizzle migrations (extends DATA-03 pattern) | Architecture Patterns → Schema Extension; existing `migrations.ts`/`drizzle-kit generate` pattern read directly from `packages/db` |
| NUTR-02 | Local-first food cache: every logged food (manual, barcode, OCR) is cached on-device; repeat logging works fully offline | Architecture Patterns → Local-First Search/Cache-Through |
| NUTR-03 | User can search cached/local foods inline with a debounced remote OFF/USDA fallback; usable result in <1s | Architecture Patterns → Local-First Search; Common Pitfalls → rate-limit/debounce |
| NUTR-04 | User can log a recent or favorite food in ≤3 taps | Standard Stack; existing `recentExerciseIds` query pattern to mirror |
| NUTR-05 | User can create a custom food via full manual macro entry (kcal/P/C/F, serving) | Data model (locked) |
| NUTR-06 | User can quick-add a macro-only log entry with no associated `food` row | Data model (locked, `quickAdd` flag) |
| NUTR-07 | Food log entries are tagged to a meal (breakfast/lunch/dinner/snack) and a local date | Data model (locked); reuse `localDate`/`todayLocalDate()` helper from Phase 04 |
| NUTR-08 | User can scan a barcode via camera; app resolves it through local cache → OFF (Apsis DB / commercial fallback deferred) | Standard Stack → expo-camera; Code Examples → OFF barcode lookup |
| NUTR-09 | User confirms/edits serving size and quantity before a scanned/OCR'd product is logged | Locked (NUTRITION.md §4) |
| NUTR-10 | Barcode/search misses fall back gracefully to manual/custom food entry — never a dead end | Common Pitfalls → OFF miss handling |
| NUTR-11 | User can photograph a nutrition label; on-device OCR (Apple Vision via expo-text-extractor) extracts kcal/P/C/F/serving into a pre-filled custom food | Standard Stack → expo-text-extractor; Code Examples → OCR regex parse |
| NUTR-12 | Every confirmed label scan saves as a custom food (`source:'user'`, provenance from OCR) | Locked (NUTRITION.md §4) |
| NUTR-13 | User can combine foods into a custom recipe with a servings count; per-serving macros compute automatically | Code Examples → recipe macro aggregation |
| NUTR-14 | User can log one recipe serving as a food-log entry | Data model (locked) |
| NUTR-15 | `user_profile` gains `heightCm`, `birthYear`, `goalMode` fields required by the adaptive-target model | **Critical finding** — Summary; Common Pitfalls → profile schema gap |
| NUTR-16 | Engine computes daily kcal/P/C/F targets from profile + goal mode + day's logged training day-type — pure function, no I/O, tunable EngineConfig constants | Architecture Patterns → Adaptive Macro Target Model |
| NUTR-17 | Day-type (`heavy_lift`/`long_run`/`double`/`rest`/`mixed`) is derived automatically from the day's logged workouts | Architecture Patterns → Day-Type Classification |
| NUTR-18 | `dailyMacroTarget` and `classifyDayType` ship with golden-file tests, mirroring the HSS calibration precedent (D-13/D-14/D-20) | Validation Architecture |
| NUTR-19 | Nutrition screen shows today's targets vs. logged totals (kcal + P/C/F progress) | UI composition — Claude's Discretion |
| NUTR-20 | Existing users (onboarded in Phases 03-06, before Phase 7 shipped) are prompted for the new profile fields the first time they open nutrition, gated like ONB-03 | **Critical finding** — Common Pitfalls → existing-user profile gap |
| NUTR-21 | App displays Open Food Facts ODbL/CC-BY-SA attribution in Settings (legal requirement of API use) | Common Pitfalls → attribution |
| NUTR-22 | Nutrition values are scrubbed from crash/analytics reporting like HealthKit values (extends REL-03 pattern) | Security Domain |

</phase_requirements>

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|---------------|
| `expo-camera` | SDK-56-line (resolve via `npx expo install expo-camera`, do not hand-pin) | Barcode scanning AND still-photo capture for label OCR | Bundled/blessed Expo camera module; `CameraView` does both barcode detection (`onBarcodeScanned`) and photo capture (`takePictureAsync`) in one component — no second camera stack needed. Replaced the deprecated `expo-barcode-scanner` as of SDK 52+. [CITED: docs.expo.dev/versions/v56.0.0/sdk/camera] |
| `expo-text-extractor` | `2.0.0` (published 2026-02-28) [ASSUMED — discovered via WebSearch, not an authoritative source; run `package-legitimacy check` before install, see audit below] | On-device OCR for nutrition-label scanning | Purpose-built Expo module wrapping **Apple Vision (`VNRecognizeTextRequest`) on iOS** exactly as NUTRITION.md §4 specifies, on-device, no network. `extractTextFromImage(uri): Promise<string[]>`. Requires Expo SDK 52+ (satisfied by SDK 56). No config plugin, no extra entitlement needed. [CITED: github.com/pchalupa/expo-text-extractor] |

No other new runtime packages are required. React Native's built-in `fetch` (with `AbortController` for timeouts) is sufficient for the two read-only third-party API integrations — do not add `axios` or another HTTP client; it would be new dependency surface with no functional benefit for two simple GET-based JSON APIs.

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `drizzle-orm` / `drizzle-kit` | Already pinned `0.45.2` / `0.31.10` (unchanged) | Schema extension + migration generation | Extend `packages/db/src/schema.ts` with the 5 new tables; run `drizzle-kit generate`; bundle the emitted `.sql` exactly like the existing 4 migrations |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `expo-camera` (barcode + photo) | `react-native-vision-camera` 5.1.0 | VisionCamera is excellent for real-time frame-processor pipelines (e.g. live OCR-as-you-scan), but Phase 7's OCR flow is "take one photo, then OCR it" — a use case `expo-camera`'s `takePictureAsync` already covers. VisionCamera would add a second native camera stack (JSI + worklets/frame-processor setup) for zero net capability gain here. Skip it. |
| `expo-text-extractor` (Apple Vision wrapper) | Hand-rolled Expo Modules API Swift wrapper calling `VNRecognizeTextRequest` directly | Would give full control over `VNRecognizeTextRequestRevision`/language correction options, but is meaningfully more native-surface and build risk for a 4-week-adjacent timeline than installing a small, already-maintained, purpose-built package that does exactly this. Revisit only if `expo-text-extractor` proves unmaintained or insufficient in practice. |
| `expo-text-extractor` (Apple Vision wrapper) | `@react-native-ml-kit/text-recognition` | ML Kit-only (Google's OCR, not Apple Vision) — NUTRITION.md §4 explicitly locks "Apple Vision framework (VNRecognizeTextRequest)"; an ML-Kit-only package doesn't satisfy that on iOS (ML Kit for iOS is a different, heavier Google SDK, not a Vision wrapper). |
| Open Food Facts + USDA (free) | YMove ($19/mo) as primary | NUTRITION.md explicitly defers YMove to "if OFF's NA miss-rate hurts in beta" — not required at launch. Do not add it in this phase. |
| Static Mifflin-St Jeor + day-type formula | MacroFactor-style adaptive TDEE (reverse-calculated from weight-trend + logged intake history over weeks) | MacroFactor's approach requires a rolling regression over weeks of weight+intake history — fundamentally incompatible with `dailyMacroTarget`'s locked pure-function signature `(profile, dayType, sessionKcal) -> {kcal,p,c,f}` (no history array, no I/O). A static formula is what the locked signature actually asks for; the adaptive/history-based approach is a defensible v1.1+ enhancement, not v1 scope. |

**Installation:**
```bash
cd apps/mobile
npx expo install expo-camera
npx expo install expo-text-extractor
```

**Version verification:** `npm view expo-camera version` currently resolves to `57.0.1` (the
SDK-57 line — latest npm tag tracks the newest Expo SDK, NOT this project's SDK 56). Do **not**
install that. `npm view expo-camera versions` confirms a `16.1.x` line exists and matches SDK
56's release window; matching Phase 03/04 precedent ("All five deps resolved to SDK-56-line
versions via expo install/pnpm add, never hand-pinned to 57.x tags" — STATE.md Phase 03), the
correct move is to run `npx expo install expo-camera` from inside `apps/mobile` and accept
whatever version Expo's own SDK-56 compatibility resolver selects, not to hand-pin a version
number in `package.json` from this research. Same applies to `expo-text-extractor`, which is not
Expo-SDK-scoped-versioned (peer dep is `expo: '*'`) — install via `npx expo install
expo-text-extractor` for consistency, current npm latest `2.0.0` should apply. [VERIFIED: npm
registry — `npm view expo-camera versions`, `npm view expo-text-extractor version`]

## Package Legitimacy Audit

| Package | Registry | Age | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|--------------|---------|-------------|
| `expo-camera` | npm | Long-established (part of `github.com/expo/expo` monorepo; frequent point releases track SDK cadence) | 1.42M/week | `github.com/expo/expo` | **[SUS]** — reason: `too-new` (latest tag published this week) | Approved — **false positive**. The legitimacy heuristic flags recency of the latest publish, but this is the official first-party Expo camera module (1.4M weekly downloads, official Expo monorepo), republished frequently because it tracks Expo's own SDK release cadence, not because it's a new/unproven package. Planner should still add a `checkpoint:human-verify` before install per protocol, but treat as low-risk. |
| `expo-text-extractor` | npm | Latest published 2026-02-28 (~4.5 months old) | 5,212/week | `github.com/pchalupa/expo-text-extractor` | **[OK]** | Approved. MIT license, no postinstall script, real GitHub repo with actual source, modest but genuine download count for a niche-purpose package. |
| `react-native-vision-camera` | npm | Long-established | 525K/week | `github.com/mrousavy/react-native-vision-camera` | **[SUS]** — reason: `too-new` (same cadence false-positive as expo-camera) | **Not used** — evaluated only as an alternative (see Alternatives Considered); not being installed in this phase, so no checkpoint needed. |

**Packages removed due to [SLOP] verdict:** none.
**Packages flagged as suspicious [SUS]:** `expo-camera` — flagged by the automated heuristic due to publish recency, but this is a well-known false positive for a high-download first-party Expo package republished on the SDK release cadence; the planner should still insert a `checkpoint:human-verify` before the install task per protocol, but this is not expected to surface a real problem.

*`expo-text-extractor` was discovered via WebSearch (not an authoritative source) — tag `[ASSUMED]` on the package-name claim itself even though the registry lookup returned OK; the planner must gate its install behind a `checkpoint:human-verify` task per the package-name-provenance rule.*

## Architecture Patterns

### System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│  MANUAL LOGGING FLOW                                                 │
│                                                                        │
│  [Search box, debounced] ──> local `food` table (SQLite, instant)    │
│         │                          │                                  │
│         │ (sparse local results,   │ tap result                     │
│         │  network available,      ▼                                 │
│         │  after debounce)   food_log row inserted                   │
│         ▼                    (denormalized kcal/p/c/f frozen         │
│   OFF /api/v2/search          at log time)                           │
│   USDA /foods/search                │                                │
│         │ tap result                │                                │
│         └──────> upsert into local `food` (source='off'|'usda') ─────┘
│                   (never re-fetched for repeat logging)              │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│  BARCODE SCAN FLOW                                                    │
│                                                                        │
│  CameraView.onBarcodeScanned ──> local `food` WHERE barcode=?         │
│         │                              │ hit (instant, offline)       │
│         │ miss                         ▼                              │
│         ▼                        confirm serving → food_log           │
│  OFF GET /api/v2/product/{barcode}.json (network, ~1-2s)              │
│         │                                                              │
│    status:1 (found)              status:0 (not found)                 │
│         │                              │                               │
│         ▼                              ▼                               │
│  upsert `food` (source='off')    fall through to manual/custom-food   │
│         │                        entry — NEVER a dead end (NUTR-10)   │
│         ▼                                                              │
│  confirm serving → food_log                                           │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│  LABEL OCR FLOW  (fully on-device, no network)                        │
│                                                                        │
│  CameraView.takePictureAsync() ──> {uri}                              │
│         │                                                              │
│         ▼                                                              │
│  expo-text-extractor.extractTextFromImage(uri) ──> string[]           │
│         │  (Apple Vision, on-device)                                  │
│         ▼                                                              │
│  regex parse kcal/protein/carbs/fat/serving from recognized lines     │
│         │                                                              │
│         ▼                                                              │
│  pre-filled confirm/edit sheet (user corrects OCR errors)             │
│         │ confirm                                                      │
│         ▼                                                              │
│  insert `food` (source='user') ──> food_log                            │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│  ADAPTIVE TARGET FLOW  (triggered on workout finish OR lazy on view)  │
│                                                                        │
│  workout finished (existing) ──> recomputeLoadDaily (existing)         │
│         │                              │                               │
│         │                              ▼                               │
│         │                        load_daily.dayHss (today)             │
│         │                              │                               │
│         ▼                              ▼                               │
│  workout rows for today ──> classifyDayType() ──┐                     │
│  (packages/db query)         (pure, packages/engine)                  │
│                                                   │                    │
│                               trainingKcalFromHss(dayHss) (pure)       │
│                                                   │                    │
│                                                   ▼                    │
│                          dailyMacroTarget(profile, dayType, sessionKcal)│
│                                    (pure, packages/engine)             │
│                                                   │                    │
│                                                   ▼                    │
│                              upsert nutrition_target (today)           │
│                                                                        │
│  Rest-day gap: a pure rest day never triggers a workout-finish event, │
│  so the TODAY/nutrition screen must ALSO lazy-compute+upsert on view   │
│  if no nutrition_target row exists yet for today (see Pitfall below). │
└─────────────────────────────────────────────────────────────────────┘
```

### Recommended Project Structure

```
packages/db/src/
├── schema.ts               # extend: food, foodLog, recipe, recipeIngredient, nutritionTarget
│                            #   + userProfile.heightCm/birthYear/goalMode additions
├── nutritionQueries.ts      # new — parameterized query builders (mirrors queries.ts pattern)
├── nutritionTarget.ts       # new — recompute/upsert orchestration (mirrors loadDaily.ts pattern)
└── __tests__/
    └── nutrition-queries.test.ts

packages/engine/src/
├── nutrition.ts             # new — dailyMacroTarget, classifyDayType, trainingKcalFromHss
└── __tests__/
    └── nutrition.test.ts    # golden-file tests, mirrors calibration.test.ts / carry.test.ts

apps/mobile/
├── lib/
│   ├── offClient.ts          # new — OFF fetch wrapper (User-Agent, timeout, field selection)
│   ├── usdaClient.ts          # new — USDA fetch wrapper (API key, nutrient-shape parsing)
│   └── labelOcrParse.ts       # new — regex parse of expo-text-extractor's string[] output
└── app/(tabs)/
    └── nutrition/             # new 5th tab — search/log/scan/recipes/targets screens
        ├── _layout.tsx
        ├── index.tsx           # today's targets vs. logged totals
        ├── search.tsx
        ├── scan.tsx            # barcode
        └── label-scan.tsx      # OCR
```

### Pattern 1: Local-First Search / Cache-Through

**What:** Every food search hits the local `food` table first (instant, offline). Only after a
debounce AND only if local results are sparse does the app fire a remote OFF/USDA search. Any
result the user taps — local or remote — gets logged immediately; any *remote* result also gets
upserted into `food` so it never needs a second network round-trip.
**When to use:** All manual search, barcode lookup, and recipe-ingredient search.
**Why:** Satisfies the "logging never blocks on the network" hard constraint and NUTRITION.md's
`<1s` search quality bar, while still surfacing OFF/USDA's much larger catalogs when local cache
misses.
**Example:**
```typescript
// apps/mobile/lib/offClient.ts
const OFF_BASE = 'https://world.openfoodfacts.org';
const USER_AGENT = 'Apsis/1.0 (support@apsistraining.com)'; // required by OFF for read ops

export async function offLookupBarcode(barcode: string, signal: AbortSignal) {
  const url = `${OFF_BASE}/api/v2/product/${barcode}.json?fields=product_name,brands,nutriments,serving_size`;
  const res = await fetch(url, {
    headers: { 'User-Agent': USER_AGENT },
    signal, // caller supplies an AbortController timeout — never let this hang the UI
  });
  const json = await res.json();
  if (json.status !== 1) return null; // status:0 = not found, not an error
  return json.product;
}
```
```typescript
// apps/mobile/lib/nutritionSearch.ts (composition sketch)
export async function searchFoods(query: string, db: QueryableDB): Promise<FoodResult[]> {
  const local = await searchLocalFoods(db, query); // instant, offline, always runs
  if (local.length >= MIN_LOCAL_RESULTS || !isOnline()) return local;
  // debounce is applied by the calling component (e.g. useDebouncedValue), not here —
  // this function itself should only be called after the debounce fires
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 6000);
  try {
    const remote = await offSearch(query, controller.signal); // OFF /api/v2/search
    return [...local, ...dedupeAgainst(local, remote)];
  } catch {
    return local; // network failure never blocks — local results (possibly empty) still show
  } finally {
    clearTimeout(timeout);
  }
}
```

### Pattern 2: Denormalized `food_log` Rows (Freeze-at-Log-Time)

**What:** `food_log.kcal/p/c/f` are copied from `food.per100g × qtyGrams` **at insert time** and
never recomputed from a live join. If a user later edits/corrects the underlying `food` row
(e.g. fixes a wrong OFF value), historical `food_log` entries do NOT retroactively change.
**When to use:** Every food-log insert.
**Why:** Matches MFP/MacroFactor UX expectations (editing a food doesn't rewrite history) and
means day totals are a plain `SUM(food_log.kcal) WHERE localDate = ? GROUP BY localDate` with no
join required — this is simpler than `load_daily`'s pattern, not a re-implementation of it. Do
**not** build a separate `nutrition_daily` rollup table requiring its own recompute-on-write
cycle; a live SUM query over `food_log` is sufficient at this data scale and op-sqlite's
synchronous JSI reads make it fast. Only revisit this if a 28-day nutrition trend chart is added
later (out of Phase 7 scope per NUTRITION.md §1).

### Pattern 3: Day-Type Classification (Reuses Existing Double-Session Concept)

**What:** A pure function that maps the day's session types to one of
`heavy_lift|long_run|double|rest|mixed`, using the exact same `sessionCount > 1` precedence
`dailyHSS` already uses for the double-session penalty.
**When to use:** Feeds `nutrition_target` generation.
**Example:**
```typescript
// packages/engine/src/nutrition.ts
export type DayType = 'heavy_lift' | 'long_run' | 'double' | 'rest' | 'mixed';

/** Classifies a day's training from the set of session types logged that day (workout.type
 * values: 'strength' | 'endurance' | 'hybrid'). Pure; mirrors dailyHSS's sessionCount>1
 * precedence for 'double' (BUILD.md §4.2 double-session concept, reused here for nutrition). */
export function classifyDayType(sessionTypes: Array<'strength' | 'endurance' | 'hybrid'>): DayType {
  if (sessionTypes.length === 0) return 'rest';
  if (sessionTypes.length > 1) return 'double'; // >1 session always wins, regardless of type mix
  const only = sessionTypes[0];
  if (only === 'strength') return 'heavy_lift';
  if (only === 'endurance') return 'long_run';
  return 'mixed'; // only === 'hybrid'
}
```
```typescript
// packages/db/src/nutritionQueries.ts — mirrors sessionCountsByDate's grouping, but returns types
export function sessionTypesForDate(db: QueryableDB, localDate: string) {
  return db
    .select({ type: workout.type })
    .from(workout)
    .where(and(eq(workout.localDate, localDate), isNotNull(workout.finishedAt), activeWorkoutFilter));
  // caller maps rows -> string[] and passes to classifyDayType()
}
```

### Pattern 4: Adaptive Macro Target Model (Proposed — PRD §6 Does Not Exist)

**What:** Since NUTRITION.md defers to a "PRD §6 nutrition model" that is not present anywhere
in this repository (confirmed via grep across the full working tree), this section **is** the
model, derived from cited sports-nutrition sources and matching the exact locked engine
signature `dailyMacroTarget(profile, dayType, sessionKcal) -> {kcal,p,c,f}`.

**Required new profile inputs (schema gap — see Common Pitfalls):**
```typescript
// packages/shared/src/index.ts additions
export interface NutritionProfile {
  sex: Sex;               // existing
  bodyweightKg: number;   // existing
  heightCm: number;        // NEW — required by Mifflin-St Jeor
  age: number;             // NEW — required by Mifflin-St Jeor (derive from stored birthYear)
  goalMode: 'cut' | 'maintain' | 'bulk'; // NEW
}
```

**EngineConfig additions** (tunable, same convention as `kStrength`/`kEndurance`/`kCarry` —
every numeric constant below is a **starting guess**, not a calibrated value; tag accordingly):
```typescript
export interface EngineConfig {
  // ...existing fields unchanged...
  proteinGPerKgCut: number;      // 2.4 — mid-point of ISSN's cited 2.3-3.1 g/kg cutting range
  proteinGPerKgMaintain: number; // 1.8 — mid-point of ISSN's cited 1.4-2.2 g/kg maintenance range
  proteinGPerKgBulk: number;     // 1.8 — ISSN range is sufficient in surplus; no evidence a bulk needs more
  neatMultiplier: number;        // 1.2 — sedentary/light-NEAT baseline; exercise kcal added separately via sessionKcal
  cutDeltaKcal: number;          // -500 — common ~1lb/week deficit heuristic
  bulkDeltaKcal: number;         // 300 — common lean-bulk surplus heuristic
  kcalPerHssPoint: number;       // 5 — LOWEST-confidence constant; derived so a ~100-HSS hard session ≈ 500 kcal
  carbGPerKgHeavyLift: number;   // 4
  carbGPerKgLongRun: number;     // 7
  carbGPerKgDouble: number;      // 8
  carbGPerKgRest: number;        // 2.5
  carbGPerKgMixed: number;       // 5
  fatFloorGPerKg: number;        // 0.4 — essential-fatty-acid/hormonal-health practical floor
}
```

**Formula (pseudocode, matches `StrengthStressDetail`'s `warnings: string[]` convention):**
```typescript
// packages/engine/src/nutrition.ts
export interface MacroTargetResult { kcal: number; p: number; c: number; f: number; warnings: string[] }

function mifflinStJeorBmr(sex: Sex, weightKg: number, heightCm: number, age: number): number {
  const sexConstant = sex === 'male' ? 5 : sex === 'female' ? -161 : -78; // 'other': midpoint average [ASSUMED]
  return 10 * weightKg + 6.25 * heightCm - 5 * age + sexConstant;
}

export function trainingKcalFromHss(dayHss: number, cfg?: Partial<EngineConfig>): number {
  const config = mergeConfig(cfg);
  const safeHss = Number.isFinite(dayHss) ? Math.max(dayHss, 0) : 0;
  return safeHss * config.kcalPerHssPoint;
}

export function dailyMacroTarget(
  profile: NutritionProfile,
  dayType: DayType,
  sessionKcal: number,
  cfg?: Partial<EngineConfig>,
): MacroTargetResult {
  const config = mergeConfig(cfg);
  const warnings: string[] = [];

  if (!Number.isFinite(profile.bodyweightKg) || profile.bodyweightKg <= 0) {
    return { kcal: 0, p: 0, c: 0, f: 0, warnings: ['invalid bodyweight — cannot compute targets'] };
  }

  const proteinPerKg =
    profile.goalMode === 'cut' ? config.proteinGPerKgCut
    : profile.goalMode === 'bulk' ? config.proteinGPerKgBulk
    : config.proteinGPerKgMaintain;
  const p = proteinPerKg * profile.bodyweightKg;

  const bmr = mifflinStJeorBmr(profile.sex, profile.bodyweightKg, profile.heightCm, profile.age);
  const neat = bmr * config.neatMultiplier;
  const safeSessionKcal = Number.isFinite(sessionKcal) ? Math.max(sessionKcal, 0) : 0;
  const maintenanceKcal = neat + safeSessionKcal;
  const goalDelta =
    profile.goalMode === 'cut' ? config.cutDeltaKcal
    : profile.goalMode === 'bulk' ? config.bulkDeltaKcal
    : 0;
  let kcal = Math.max(maintenanceKcal + goalDelta, bmr); // safety floor: never target below BMR

  const carbPerKg = {
    heavy_lift: config.carbGPerKgHeavyLift,
    long_run: config.carbGPerKgLongRun,
    double: config.carbGPerKgDouble,
    rest: config.carbGPerKgRest,
    mixed: config.carbGPerKgMixed,
  }[dayType];
  let c = carbPerKg * profile.bodyweightKg;

  const proteinKcal = p * 4;
  const carbKcal = c * 4;
  let f = (kcal - proteinKcal - carbKcal) / 9;

  const fatFloor = config.fatFloorGPerKg * profile.bodyweightKg;
  if (f < fatFloor) {
    warnings.push('fat target below floor — reduced carb target to compensate');
    f = fatFloor;
    c = Math.max((kcal - proteinKcal - f * 9) / 4, 0);
    if (c === 0) warnings.push('kcal budget too low to hit protein+fat floor — targets are floor-clamped, not diet-optimal');
  }

  return {
    kcal: Math.round(kcal / 5) * 5, // round to nearest 5 kcal
    p: Math.round(p),
    c: Math.round(c),
    f: Math.round(f),
    warnings,
  };
}
```

**Recommended golden-file test cases** (planner/executor computes and locks actual numbers,
same process as `kStrength`'s 100.1 calibration anchor — do not hand-wave these, run the formula
and assert the real output):
1. Maintain + rest day, moderate baseline athlete (sanity range check, not a precise anchor).
2. Cut + heavy_lift day (protein highest relative to kcal; kcal reduced by exactly `cutDeltaKcal`).
3. Bulk + double day (highest carb target; `sessionKcal` clearly additive).
4. Invalid bodyweight (`<=0` or non-finite) → all-zero result + warning, no NaN/divide-by-zero.
5. Extreme aggressive-cut scenario that trips the fat-floor clamp → assert `warnings` populated,
   `f` pinned at `fatFloorGPerKg * bodyweightKg`.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|--------------|-----|
| Barcode detection | A custom camera pixel-scanning pipeline | `expo-camera`'s `CameraView` + `barcodeScannerSettings` | Native barcode detection (EAN/UPC/QR/etc.) is a solved, hardware-accelerated problem on iOS; hand-rolling it is pure waste |
| Nutrition-label text recognition | A custom Expo Modules API Swift wrapper around `VNRecognizeTextRequest` | `expo-text-extractor` | A maintained package already does exactly this with the right platform (Apple Vision on iOS) and the right API shape; only build custom if this package proves inadequate in practice |
| Food nutrition database | A hand-curated food list | Open Food Facts + USDA FoodData Central, cached locally | Both are free, real, government/community-maintained datasets with millions of entries — building an equivalent from scratch is out of scope for a 4-week-adjacent timeline |
| BMR/TDEE estimation | An invented ad-hoc formula with no citation | Mifflin-St Jeor (cited, ~5% avg error, most accurate of the common formulas per systematic review) | A defensible model needs a defensible formula; Mifflin-St Jeor is the most-cited, most-accurate common option and is simple enough to keep the engine pure |
| Debounce logic for search-as-you-type | A hand-rolled `setTimeout` debounce scattered per screen | A single shared `useDebouncedValue` hook | Prevents the OFF 10 req/min search rate limit from being burned through by fast typing (a real, concrete risk — see Pitfalls) |

**Key insight:** Every hand-roll risk in this phase is either a solved hardware/OS problem
(barcode/OCR) or a solved data problem (food database) — the only genuinely novel work is
gluing them together with local-first caching and inventing (then honestly labeling) the
adaptive-target formula, since no PRD §6 exists to hand-roll from.

## Common Pitfalls

### Pitfall 1: New Native Modules Require a Fresh EAS Dev Build
**What goes wrong:** `expo-camera` and `expo-text-extractor` are both native modules. Testing
Phase 7 features on-device with a stale dev client will silently fail (missing native module
errors) even though the JS/TS code is correct.
**Why it happens:** This project's dev client is a compiled binary; native module additions
require Metro/JS changes AND a new compiled binary.
**How to avoid:** Budget an EAS dev build cycle into this phase's plan, exactly as Phase 05
(HealthKit) had to. Also sync `pnpm-lock.yaml` before building — EAS installs with
`--frozen-lockfile`.
**Warning signs:** "Cannot find native module" errors, or barcode/camera screens that render but
never invoke native callbacks. [VERIFIED: STATE.md — "Native-dep changes require BOTH a
pnpm-lock.yaml sync... AND a fresh EAS dev build before on-device testing" — Phase 04 P02 and
Phase 05 both hit this exact gate.]

### Pitfall 2: `user_profile` Is Missing Fields the Adaptive Model Needs
**What goes wrong:** `dailyMacroTarget` cannot compute a BMR without height and age, and cannot
apply "goal-mode adjustment" without a goal field. None of `heightCm`, `birthYear`/`age`, or
`goalMode` exist on `user_profile` today.
**Why it happens:** The original onboarding (Phase 03, ONB-01) only ever asked for sex,
bodyweight, threshold HR, threshold pace — nutrition wasn't in scope when onboarding shipped.
**How to avoid:** Add a small migration (`heightCm: real`, `birthYear: integer`, `goalMode: text
enum('cut'|'maintain'|'bulk')`) and a minor UI addition. This can reuse the existing Settings
profile-editor pattern (Phase 03 P09: staged draft → single batched UPDATE) rather than
requiring a new onboarding wizard step.
**Warning signs:** Any implementation that tries to call `dailyMacroTarget` using only the
existing `userProfile` row shape will hit missing/undefined fields immediately. [VERIFIED:
`packages/db/src/schema.ts` read directly — confirmed no such columns exist.]

### Pitfall 3: Existing Users Have No Nutrition Profile Data When Phase 7 Ships
**What goes wrong:** Phase 7 ships as a v1.x update to users who already completed onboarding
in Phases 03-06. Their `heightCm`/`birthYear`/`goalMode` will all be `NULL` the first time they
open the nutrition tab — `dailyMacroTarget` must not silently produce a nonsense target (e.g.
treating `NULL` height as `0`).
**Why it happens:** This is a genuinely new situation for the project — every prior phase's
onboarding gate (`ONB-03`) applied to brand-new installs only; this is the first feature added
to an already-onboarded install base.
**How to avoid:** Gate the nutrition-target display behind a small "Nutrition Setup" prompt the
first time the fields are missing (mirrors `ONB-03`'s "readiness band never shows wrong numbers
until onboarding is complete" pattern, applied to a subset of profile fields instead of the
whole profile).
**Warning signs:** `heightCm`/`age` are `null`/`undefined` reaching `mifflinStJeorBmr` and
producing `NaN` targets.

### Pitfall 4: `userId` Columns Don't Match This Project's Schema Convention
**What goes wrong:** NUTRITION.md's literal proposed schema includes `userId` on
`food_log`/`recipe`/`nutrition_target`. Adding it would be the first `userId` column anywhere in
the schema.
**Why it happens:** NUTRITION.md was originally written as v2/v1.1 scope, possibly anticipating
a future multi-user/backend world; it wasn't re-checked against the actual (single-local-user,
no-auth) v1 schema when promoted into v1.
**How to avoid:** Drop `userId` from all new tables. `user_profile` itself has no `userId`
either — it's a singleton row. Keep the new nutrition tables consistent with `workout` /
`strength_set` / `endurance_segment`, none of which carry a `userId`. If/when a backend and
multi-user support are ever built (out of v1 scope), add `userId` in that phase's migration —
don't pre-build unused columns now.
**Warning signs:** Any new table with a `userId` column that's always populated with the same
single value.
[VERIFIED: `packages/db/src/schema.ts` — grepped every existing table, zero `userId` references anywhere.]

### Pitfall 5: `nutrition_target` Has No Trigger on Pure Rest Days
**What goes wrong:** If `nutrition_target` recompute is wired only to "workout finished" (mirroring
`recomputeLoadDaily`'s trigger), a day with zero workouts (a rest day) never triggers a recompute
— but the user still needs to see a rest-day target when they open the app.
**Why it happens:** `load_daily`'s existing recompute-on-write pattern assumes there's always a
write to hook; nutrition needs a target even on days with no writes at all.
**How to avoid:** Add a lazy-compute-on-view fallback: if the TODAY/nutrition screen finds no
`nutrition_target` row for today, compute and upsert one on the spot (using `sessionKcal = 0`,
`dayType = 'rest'` if no sessions exist yet today) rather than showing nothing.
**Warning signs:** Nutrition targets that "just don't show up" on days the user hasn't trained
yet.

### Pitfall 6: OFF Search Without a Debounce Burns the Rate Limit
**What goes wrong:** OFF limits search queries to **10 req/min/IP**. Firing a request per
keystroke during fast typing can exhaust this in well under a minute, producing visible 429s
mid-search.
**Why it happens:** No debounce between "user types" and "fire remote search."
**How to avoid:** Debounce remote search (400-500ms of no typing) and always try local cache
first — most keystrokes should never reach the network at all.
**Warning signs:** Search feels fine on a slow typist, breaks for a fast typist. [CITED:
openfoodfacts.github.io/openfoodfacts-server/api/ — "15 req/min/IP product reads, 10 req/min/IP
search queries".]

### Pitfall 7: OFF Data Is Crowdsourced — Code Defensively for Missing Fields
**What goes wrong:** A found product (`status:1`) can still be missing `nutriments` fields
(e.g. no `fiber_100g`), or have implausible values for sparsely-documented products.
**Why it happens:** OFF is community-contributed; NA branded coverage is patchier than European
coverage (locked in NUTRITION.md's own market research §2 — "quality varies (crowdsourced)").
**How to avoid:** Treat every `nutriments` field as optional; never assume `energy-kcal_100g`
exists — fall back to prompting the user to complete missing macros via the same confirm/edit
sheet used for OCR results, rather than saving a food with silent `0`/`NaN` macros.
**Warning signs:** Logged foods with suspiciously round or zero macros that were never
user-verified.

### Pitfall 8: USDA FDC's `foodNutrients` Shape Is Inconsistent Across Endpoints
**What goes wrong:** Two independently-fetched USDA documentation sources this session showed
**different** JSON shapes for the same conceptual data: a flat form
(`foodNutrients[].nutrientId/nutrientName/value/unitName`) and a nested form
(`foodNutrients[].nutrient.{id,name,unitName}` + `foodNutrients[].amount`). This is a known,
real inconsistency in USDA's API depending on endpoint/response format, not a research error —
both shapes were independently observed.
**Why it happens:** USDA FDC's API has historically supported multiple response formats
("abridged" vs "full") with different field naming.
**How to avoid:** Before writing the USDA parser, make one live test call (with `DEMO_KEY`, no
signup needed for this) against both `/foods/search` and `/food/{fdcId}` and inspect the actual
shape returned; write the parser defensively (check both `nutrient.id` and `nutrientId`) or pin
to whichever format parameter guarantees a single stable shape.
**Warning signs:** USDA-sourced foods logging with `undefined`/`NaN` macros despite the API call
succeeding. [Confidence: LOW on shape specifics — flagged in Assumptions Log A6; the rate
limits/endpoints/key-signup facts are CITED/MEDIUM, only the exact JSON field shape is
uncertain.]

### Pitfall 9: OCR Output Is Untrusted Input — Validate Before Persisting
**What goes wrong:** `expo-text-extractor` returns raw recognized text lines; a regex parse of
"kcal/protein/carbs/fat/serving" from an arbitrary photo can misfire (e.g. matching a random
number on the label as "protein"). This is already mitigated by NUTRITION.md's locked
confirm/edit-sheet requirement, but the parser itself should still clamp to sane bounds (no
negative macros, no absurd values like 50,000 kcal/100g) before pre-filling the form, so the
confirm sheet shows an obviously-wrong number the user will actually catch, not a value that
silently type-checks.
**How to avoid:** Bounds-check every regex-extracted numeric value; never write parsed OCR
output directly to the `food` table without passing through the confirm/edit sheet (already
locked behavior — just don't skip the validation on the way in).

### Pitfall 10: Attribution Is a Locked Legal Requirement, Not Optional Polish
**What goes wrong:** Shipping without the Open Food Facts ODbL/CC-BY-SA attribution in Settings
violates the license terms of the data being used.
**How to avoid:** Treat `NUTR-21` (attribution string in Settings) as part of the "ship 1-2"
minimum whenever barcode scanning (which uses OFF data) ships — not a nice-to-have deferred to
polish.
[CITED: openfoodfacts.github.io/openfoodfacts-server/api/ — "Data uses the Open Database License
and Database Contents License."]

## Code Examples

### USDA FoodData Central: Generic Food Search
```typescript
// apps/mobile/lib/usdaClient.ts
const USDA_BASE = 'https://api.nal.usda.gov/fdc/v1';
// EXPO_PUBLIC_USDA_FDC_API_KEY: free key from fdc.nal.usda.gov/api-key-signup — client-embedded
// is acceptable here (no backend exists to hide it behind; it's a free, non-billing government
// key, same class of exposure as any client-only app's public API key).
const API_KEY = process.env.EXPO_PUBLIC_USDA_FDC_API_KEY ?? 'DEMO_KEY'; // DEMO_KEY: 30/hr, 50/day only — get a real key before shipping

export async function usdaSearch(query: string, signal: AbortSignal) {
  const url = `${USDA_BASE}/foods/search?api_key=${API_KEY}&query=${encodeURIComponent(query)}&dataType=Foundation,SR%20Legacy`;
  const res = await fetch(url, { signal });
  if (res.status === 429) throw new Error('USDA rate limit exceeded'); // 1000 req/hr/IP with a real key
  const json = await res.json();
  return json.foods as Array<Record<string, unknown>>; // shape verify-before-use — see Pitfall 8
}
```

### Recipe Per-Serving Macro Aggregation
```typescript
// packages/db/src/nutritionQueries.ts (sketch)
export async function computeRecipeServingMacros(db: QueryableDB, recipeId: string) {
  const ingredients = await db
    .select({ qtyGrams: recipeIngredient.qtyGrams, food: food })
    .from(recipeIngredient)
    .innerJoin(food, eq(recipeIngredient.foodId, food.id))
    .where(eq(recipeIngredient.recipeId, recipeId));

  const [recipeRow] = await db.select().from(recipe).where(eq(recipe.id, recipeId)).limit(1);
  const servings = recipeRow?.servings ?? 1;

  const totals = ingredients.reduce(
    (acc, { qtyGrams, food: f }) => {
      const factor = qtyGrams / 100;
      acc.kcal += f.kcalPer100g * factor;
      acc.p += f.proteinGPer100g * factor;
      acc.c += f.carbGPer100g * factor;
      acc.f += f.fatGPer100g * factor;
      return acc;
    },
    { kcal: 0, p: 0, c: 0, f: 0 },
  );

  return { kcal: totals.kcal / servings, p: totals.p / servings, c: totals.c / servings, f: totals.f / servings };
}
```

### Camera: Barcode Scan + Label Photo Capture (Same Component)
```typescript
// apps/mobile/app/(tabs)/nutrition/scan.tsx (sketch)
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useRef } from 'react';

export default function ScanScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);

  // Barcode mode
  const handleBarcodeScanned = (result: { type: string; data: string }) => {
    // -> lookup local cache -> OFF -> confirm serving -> food_log
  };

  // Label-OCR mode: same component, different action
  const handleCapturePhoto = async () => {
    const photo = await cameraRef.current?.takePictureAsync({ quality: 0.8 });
    if (photo?.uri) {
      // -> expo-text-extractor.extractTextFromImage(photo.uri) -> regex parse -> confirm sheet
    }
  };

  return (
    <CameraView
      ref={cameraRef}
      barcodeScannerSettings={{ barcodeTypes: ['ean13', 'ean8', 'upc_a', 'upc_e', 'qr'] }}
      onBarcodeScanned={handleBarcodeScanned}
    />
  );
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|-------------------|---------------|--------|
| `expo-barcode-scanner` (separate package) | `expo-camera`'s built-in `CameraView` barcode scanning | Deprecated as of SDK 52+ | Do not install `expo-barcode-scanner` — it's the deprecated path; everything barcode-related lives in `expo-camera` now |
| Static once-computed TDEE (age/height/weight at signup, never revisited) | Adaptive/rolling TDEE reverse-calculated from logged weight-trend + intake (e.g. MacroFactor) | Popularized ~2022-2023, now a differentiator several apps market on | Noted for context only — NOT adopted here, since it's incompatible with the locked pure-function `dailyMacroTarget` signature (no history input). Static Mifflin-St Jeor + day-type modulation is the correct v1 scope; an adaptive layer is a defensible v1.1+ direction if `dailyMacroTarget`'s signature is later revisited to accept a history array. |

**Deprecated/outdated:**
- `expo-barcode-scanner`: superseded by `expo-camera`; do not install it.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|----------------|
| A1 | Package name `expo-text-extractor` is the correct/best npm package for Apple-Vision OCR in Expo | Standard Stack | Discovered via WebSearch, not an authoritative source. Registry lookup confirms it exists and looks legitimate (OK verdict, real repo, real downloads), but per the package-name-provenance rule this stays `[ASSUMED]` until a human confirms it during a `checkpoint:human-verify` install step. If wrong: wasted install, need to swap to an alternative (ML-Kit wrapper or hand-rolled native module — both identified as fallbacks above). |
| A2 | `sexConstant = -78` for `sex: 'other'` in the Mifflin-St Jeor BMR formula (midpoint average of male +5 / female -161) | Architecture Patterns → Adaptive Macro Target Model | The formula's original literature only defines male/female constants; the midpoint is my own extrapolation, not sourced. If wrong: `'other'`-sex users get a systematically biased BMR (probably still within a reasonable range, but not literature-backed). Needs explicit user/discuss-phase confirmation or replacement with a better-justified approach. |
| A3 | Day-type carb targets (4/7/8/2.5/5 g/kg for heavy_lift/long_run/double/rest/mixed) | Architecture Patterns → Adaptive Macro Target Model | These are **not** confirmed against a primary source this session (the PMC6566225 fetch did not contain the systematized band table I expected — see Pitfall 8-adjacent finding under Sources). They're a defensible, tunable **starting guess** in the general 2.5-8 g/kg envelope that IS broadly consistent with what WebSearch surfaced from secondary sources, but should be treated exactly like `kStrength`'s original "2.0 starting guess" — subject to a reasonableness golden-file test, not a precise calibration. If wrong: targets are directionally correct (more carbs on harder days) but the magnitude may be off; low real-world risk since the user can always override via `nutrition_target.source='override'` (already in the locked schema). |
| A4 | `kcalPerHssPoint = 5` (a ~100-HSS hard session ≈ 500 kcal) | Architecture Patterns → Adaptive Macro Target Model | This is the **lowest-confidence constant in the whole model** — pure estimation, no source. Every commercial app's "active calories" estimate is itself approximate (even Garmin/Strava), so this isn't uniquely worse than the state of the art, but it has zero citation backing. If wrong: `sessionKcal` over/under-shoots on hard training days; low risk since it only affects kcal magnitude, not direction, and is fully tunable via `EngineConfig`. |
| A5 | `neatMultiplier = 1.2`, `cutDeltaKcal = -500`, `bulkDeltaKcal = 300`, `fatFloorGPerKg = 0.4` | Architecture Patterns → Adaptive Macro Target Model | Common industry-standard heuristics (a 500kcal deficit ≈ 1lb/week is widely cited; MFP itself defaults to this), but not verified via a fetch this session — training-knowledge recall. If wrong: targets drift from "correct" by a modest, easily-tunable margin. |
| A6 | USDA FDC `foodNutrients` JSON shape — both a flat and a nested form were seen across two independent (non-authoritative-fetch) sources this session | Common Pitfalls → Pitfall 8 | Both WebFetch attempts against USDA's own official docs pages (`fdc.nal.usda.gov/api-spec/...`, Postman docs) failed to retrieve real page content (JS-rendered pages, tool couldn't extract). The shapes shown come from a third-party blog and general knowledge, not USDA's own spec. **Must be verified with one live test call before implementation** — flagged explicitly as an Open Question below, not just an assumption to accept. |
| A7 | VNRecognizeTextRequest requires no special iOS entitlement/Info.plist key beyond whatever already covers photo capture | Common Pitfalls / Standard Stack | Apple's own developer docs page could not be fetched this session (tool returned "no access to actual page content" both times, fell back to general knowledge). Cross-checked twice with consistent answers, and `expo-text-extractor`'s README independently confirms "no config plugin" needed, which is corroborating (not conclusive) evidence. If wrong: a build would fail at the Xcode/EAS build step with a missing-entitlement error, caught early, not a silent runtime issue. |
| A8 | React Native's `fetch` on iOS allows a custom `User-Agent` header (needed for OFF API compliance) without being silently stripped | Code Examples → OFF client | Training-knowledge recall (RN's fetch is not a browser fetch and isn't subject to the browser spec's forbidden-header restrictions), not verified via a live device test this session. If wrong: OFF requests would still likely succeed (User-Agent is requested, not strictly enforced per-request by the API), but would technically violate OFF's usage guidance. Low risk; verify with one real device request during implementation. |

## Open Questions

1. **Exact USDA `foodNutrients` JSON shape for `/foods/search` vs `/food/{fdcId}`**
   - What we know: Both endpoints exist, take the documented params, and the general concept
     (an array of nutrient entries per food) is correct.
   - What's unclear: Whether the shape is `foodNutrients[].nutrientId/nutrientName/value` (flat)
     or `foodNutrients[].nutrient.{id,name}` + `foodNutrients[].amount` (nested), and whether
     this differs between the two endpoints or by a `format` query param.
   - Recommendation: Make one live `curl` call with `DEMO_KEY` against both endpoints as the
     first task of the USDA integration plan, before writing the parser. This is cheap (no
     signup needed for `DEMO_KEY`) and eliminates the ambiguity in minutes.

2. **Whether "Apsis DB" contribution needs a backend at all, even for local-only device caching**
   - What we know: CONTEXT.md's discretion explicitly defers any server-requiring shared-dataset
     work; the local `food` table with `source='apsis'` as an enum value costs nothing to keep
     unpopulated.
   - What's unclear: Whether a future phase's shared-DB sync will need any v1 schema
     accommodation beyond what's already proposed (e.g. a `contributedAt`/`consentGiven` flag on
     `food`).
   - Recommendation: Do not add speculative sync-related columns in Phase 7; the enum value
     alone is sufficient forward-compatibility. Revisit when a backend actually exists.

3. **Whether `goalMode` needs a 4th value (e.g. `'recomp'`) or the 3 CONTEXT.md-implied values
   (cut/maintain/bulk) are sufficient for v1**
   - What we know: CONTEXT.md mentions "goal-mode adjustment" without enumerating values.
   - What's unclear: Whether body-recomposition (maintenance kcal + higher protein) is a
     distinct mode athletes will expect, given the HYROX/tactical audience often trains for
     recomp rather than pure cut/bulk.
   - Recommendation: Ship with `cut`/`maintain`/`bulk` for v1 (3 values keeps the UI and formula
     simple); flag `recomp` as a candidate v1.1 addition since it would reuse `maintain`'s kcal
     with `cut`'s protein target — a small, additive change later, not a blocker now.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|-------------|-----------|---------|----------|
| Open Food Facts API (network) | Barcode lookup, food search | ✓ (reachable, HTTP 200 confirmed live this session) | v2/v3 | — |
| USDA FoodData Central API (network) | Generic-food search | ✓ (reachable, HTTP 200 with `DEMO_KEY` confirmed live this session) | v1 | Ship without USDA in the "ship 1-2" cutline; OFF alone covers barcode + branded products |
| USDA API key (real, non-DEMO) | Production USDA calls at >30 req/hr | ✗ (not yet obtained — no `.env`/`EXPO_PUBLIC_*` USDA key found in repo) | — | `DEMO_KEY` works for development (30/hr, 50/day) but is not viable for shipped production use |
| Xcode / iOS build tooling | Compiling the dev client with new native modules | ✗ (Windows host — `xcodebuild` not found, as expected) | — | EAS cloud build, exactly as every prior native-dependency phase (04, 05) already does on this host |
| Node.js | Tooling | ✓ | v20.16.0 | `pnpm add`/`expo install` warned this is below the `>=20.19.4` recommended LTS — not a phase blocker, but worth a note for whoever runs installs |
| pnpm | Workspace package management | ✓ | 9.15.9 | — |

**Missing dependencies with no fallback:**
- A real (non-`DEMO_KEY`) USDA API key must be obtained before production shipping of the USDA
  integration — free self-serve signup at `fdc.nal.usda.gov/api-key-signup`, no blocker to
  development. Recommend a `07-USER-SETUP.md`-style human action item, mirroring the
  `EXPO_PUBLIC_SENTRY_DSN` pattern already used for Phase 06.

**Missing dependencies with fallback:**
- USDA integration entirely: OFF alone is sufficient to hit NUTRITION.md's "ship 1-2" cutline
  (manual logging + barcode chain with OFF); USDA can trail into the same phase or slip slightly
  without blocking the sellable increment.

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | vitest 4.1.9 (already configured in `packages/engine`, `packages/db`, `packages/shared`, `apps/mobile`) |
| Config file | `packages/engine/vitest.config.mts`, `packages/db/vitest.config.mts`, `apps/mobile/vitest.config.mts` (all pre-existing, no new config needed) |
| Quick run command | `pnpm --filter @apsis/engine test` / `pnpm --filter @apsis/db test` |
| Full suite command | `pnpm -r test` (all 4 workspaces) |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|---------------------|--------------|
| NUTR-16 | `dailyMacroTarget` computes correct kcal/p/c/f for goal-mode × day-type combinations | unit (golden-file) | `pnpm --filter @apsis/engine test nutrition` | ❌ Wave 0 |
| NUTR-17 | `classifyDayType` maps session-type combinations to the correct `DayType` | unit | `pnpm --filter @apsis/engine test nutrition` | ❌ Wave 0 |
| NUTR-16 | `dailyMacroTarget` clamps invalid bodyweight to zero-with-warning, never NaN | unit | `pnpm --filter @apsis/engine test nutrition` | ❌ Wave 0 |
| NUTR-16 | `dailyMacroTarget` fat-floor clamp triggers and reduces carbs correctly | unit | `pnpm --filter @apsis/engine test nutrition` | ❌ Wave 0 |
| NUTR-01 | New `food`/`food_log`/`recipe`/`recipe_ingredient`/`nutrition_target` tables round-trip via drizzle query builders | integration | `pnpm --filter @apsis/db test nutrition-queries` | ❌ Wave 0 |
| NUTR-13 | `computeRecipeServingMacros` aggregates ingredient macros / servings correctly | unit | `pnpm --filter @apsis/db test nutrition-queries` | ❌ Wave 0 |
| NUTR-08 | OFF barcode lookup client parses a real product response, handles `status:0` gracefully | unit (mocked fetch) | `pnpm --filter apsis-mobile test offClient` | ❌ Wave 0 |
| NUTR-11 | Label-OCR regex parser extracts kcal/P/C/F from representative sample label text | unit | `pnpm --filter apsis-mobile test labelOcrParse` | ❌ Wave 0 |
| NUTR-03/09/19 | Search, confirm-serving, and targets-vs-logged screens | manual-only | on-device UAT (mirrors existing Phase 03/04/05 practice — `apps/mobile` has no component test harness, documented gap in STATE.md) | N/A |

### Sampling Rate
- **Per task commit:** `pnpm --filter @apsis/engine test` / `pnpm --filter @apsis/db test` (whichever package changed)
- **Per wave merge:** `pnpm -r test` (full suite)
- **Phase gate:** Full suite green before `/gsd-verify-work`, plus one live USDA test call (Open Question 1) resolved before the USDA parser is considered done

### Wave 0 Gaps
- [ ] `packages/engine/src/__tests__/nutrition.test.ts` — covers NUTR-16, NUTR-17, golden-file cases from Pattern 4
- [ ] `packages/db/src/__tests__/nutrition-queries.test.ts` — covers NUTR-01, NUTR-13, day-type query
- [ ] `apps/mobile/lib/__tests__/offClient.test.ts` — covers NUTR-08 (mocked fetch, following the existing `apps/mobile/lib/__tests__/` pattern)
- [ ] `apps/mobile/lib/__tests__/labelOcrParse.test.ts` — covers NUTR-11 regex extraction against sample label text fixtures
- [ ] No new framework install needed — vitest is already wired in all 4 workspaces

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|----------------|---------|--------------------|
| V2 Authentication | No | Single local user, no auth system anywhere in this app — unaffected by this phase |
| V3 Session Management | No | Same as above |
| V4 Access Control | No | Same as above |
| V5 Input Validation | Yes | All new drizzle queries MUST use parameterized query builders exclusively (T-1-01 precedent, already enforced project-wide) — never a raw `sql` template literal with interpolated barcode/search/OCR text. OCR-extracted and user-typed macro values must be bounds-checked (no negative, no absurd values) before persisting (Pitfall 9). |
| V6 Cryptography | Minimal | USDA API key is a free, non-billing government key with no meaningful secret value; embedding it client-side via `EXPO_PUBLIC_*` is standard and acceptable for a backend-less app (same pattern already used for `EXPO_PUBLIC_SENTRY_DSN`). No new cryptography surface. |

### Known Threat Patterns for This Stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|------------------------|
| SQL injection via search/barcode/OCR text reaching a food query | Tampering | drizzle parameterized queries only — this project already has zero raw-`sql`-with-interpolation instances (T-1-01); new nutrition queries must maintain that record |
| Untrusted OCR-extracted numeric values corrupting a `food` row | Tampering / data integrity | Bounds-check before persisting; the locked confirm/edit sheet (NUTRITION.md §4) is the primary mitigation — do not let any path skip it |
| Hung/slow third-party (OFF/USDA) network request blocking the logging UI | Denial of service (self-inflicted) | `AbortController` timeout on every fetch (5-8s); always offer manual/quick-add as an escape hatch — this is also the "local-first: logging never blocks on the network" hard constraint, not just a security nicety |
| First-ever outbound network calls from this app (OFF, USDA) — no existing precedent to audit against | Information disclosure (minor) | Both are HTTPS by default (confirmed live); neither call carries any user-identifying data (no accounts exist) — only search text and barcodes are transmitted, which is inherent to the feature, not a leak |

## Sources

### Primary (HIGH confidence)
- Direct codebase reads: `packages/db/src/schema.ts`, `packages/engine/src/{config,daily,trend,index}.ts`, `packages/db/src/{queries,migrations}.ts`, `packages/shared/src/{index,units}.ts`, `apps/mobile/app.json`, `apps/mobile/app/(tabs)/_layout.tsx`, `.planning/STATE.md`, `.planning/REQUIREMENTS.md` — establishes every existing convention this research extends
- `npm view expo-camera versions/version`, `npm view expo-text-extractor version/repository/deprecated/license`, `npm view react-native-vision-camera version` — live registry checks
- `gsd-tools query package-legitimacy check` — live legitimacy verdicts for all 3 evaluated packages
- Live `curl` reachability checks against `world.openfoodfacts.org` and `api.nal.usda.gov` this session (both HTTP 200)

### Secondary (MEDIUM confidence)
- [Open Food Facts API tutorial](https://openfoodfacts.github.io/openfoodfacts-server/api/tutorial-off-api/) - concrete barcode-lookup JSON example, nutriments field names
- [Open Food Facts API introduction](https://openfoodfacts.github.io/openfoodfacts-server/api/) - base URLs, rate limits, User-Agent requirement, ODbL/CC-BY-SA attribution
- [USDA FDC API Guide](https://fdc.nal.usda.gov/api-guide/) - key signup, endpoints, rate limits
- [USDA FDC API key signup](https://fdc.nal.usda.gov/api-key-signup/)
- [Expo Camera docs (v56.0.0)](https://docs.expo.dev/versions/v56.0.0/sdk/camera/) - CameraView barcode API, permissions, SDK-52+ deprecation of expo-barcode-scanner
- [expo-text-extractor README](https://github.com/pchalupa/expo-text-extractor/blob/main/README.md) - API shape, platform support, Apple Vision confirmation
- [ISSN Position Stand: protein and exercise (PMC5477153)](https://pmc.ncbi.nlm.nih.gov/articles/PMC5477153/) - protein g/kg ranges, cross-verified via 2 independent fetches
- Mifflin-St Jeor formula constants - cross-verified via 2 independent WebSearch queries returning identical constants

### Tertiary (LOW confidence)
- Day-type carbohydrate g/kg bands (A3) - WebSearch synthesis only; primary source (PMC6566225) fetch did not confirm the systematized table
- `kcalPerHssPoint`, `neatMultiplier`, `cutDeltaKcal`/`bulkDeltaKcal`, `fatFloorGPerKg` (A4/A5) - training-knowledge heuristics, not verified this session
- USDA `foodNutrients` exact JSON shape (A6) - both WebFetch attempts against USDA's own spec pages failed to retrieve real content; shown shape came from a third-party blog, not confirmed live
- VNRecognizeTextRequest entitlement requirements (A7) - Apple's own docs page could not be fetched; training-knowledge recall only, cross-checked twice with consistent (but not authoritative) results

## Metadata

**Confidence breakdown:**
- Standard stack (expo-camera, expo-text-extractor): MEDIUM-HIGH - versions/legitimacy verified live via npm registry; exact SDK-56 pin deferred to `expo install` resolution per established project convention
- OFF/USDA API mechanics: MEDIUM - endpoint shapes and rate limits confirmed via official docs pages (fetched), but USDA's exact nutrient JSON shape needs one live verification call before implementation (Open Question 1)
- Adaptive macro target model: LOW-MEDIUM - protein targets and BMR formula are cited/cross-verified against a real primary source (ISSN position stand); day-type carb bands and all HSS-to-kcal/goal-delta/fat-floor constants are defensible starting guesses requiring golden-file "reasonableness" tests, not precise calibration, exactly like `kStrength`'s original starting-guess treatment
- Schema/architecture findings (missing profile fields, `userId` mismatch, rest-day trigger gap): HIGH - all three are directly verified against the actual codebase, not inferred

**Research date:** 2026-07-13
**Valid until:** ~30 days for API mechanics/library versions (fast-moving Expo SDK ecosystem); the adaptive-target model constants should be treated as "pending calibration" rather than time-limited — they need a golden-file test pass during implementation, not a research refresh
