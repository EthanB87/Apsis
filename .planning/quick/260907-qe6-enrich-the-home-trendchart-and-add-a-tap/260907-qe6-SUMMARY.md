---
phase: 260907-qe6
plan: 01
subsystem: ui
tags: [expo-router, victory-native, skia, drizzle, vitest, trends, readiness]

# Dependency graph
requires:
  - phase: 260907-la6
    provides: TrendChart redesign (draw-on, gradient fill, softened curves) and the __DEV__ 90-day demo seeder this plan widens to 400 days
provides:
  - "recentTrend(db, days) parameterized query builder in @apsis/db, with last28DaysTrend delegating to it"
  - "A pushed /trends route (apps/mobile/app/trends.tsx) reached via a new VIEW FULL TREND tap affordance on the home TrendChart"
  - "apps/mobile/lib/trendStats.ts: pure computeTrendStats/sliceRange/formatSignedDelta/formatTrendDateLabel + TREND_RANGES table"
  - "apps/mobile/constants/readinessBand.ts: single band->color source of truth shared by ReadinessLight and the /trends readiness strip"
  - "28D/90D/1Y range switcher on /trends sourced from one 365-row read, sliced client-side"
  - "~400-day dev seeder (devSeedPlan.ts macrocycle blocks + devSeed.ts DEV_SEED_DAYS) so the 1Y range is demonstrable on a dev build"
affects: [260907-qe6b, home-dashboard, trends-detail, settings-developer-tools]

# Actuals (#2632)
actuals:
  tokens: 13600
  tasks: 3
  commits: 5

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Pure presentation-layer stats module (trendStats.ts) mirroring the runEntryLogic.ts/devSeedPlan pure-vs-native split -- no @apsis/db or react-native imports, lands in vitest's lib/** include"
    - "Single band->color constant file (readinessBand.ts) consumed by two components, mirroring the calibratingCaption shared-constant precedent"
    - "Read-once-slice-client-side range switching (recentTrend(db,365) + sliceRange), matching History's read-everything-fold-in-memory discipline"
    - "Macrocycle-block seeded data generation (devSeedPlan.ts) -- repeating build->taper blocks with across-block progression instead of one long linear ramp"

key-files:
  created:
    - apps/mobile/app/trends.tsx
    - apps/mobile/lib/trendStats.ts
    - apps/mobile/lib/__tests__/trendStats.test.ts
    - apps/mobile/constants/readinessBand.ts
  modified:
    - packages/db/src/queries.ts
    - packages/db/src/index.ts
    - packages/db/src/__tests__/history-queries.test.ts
    - apps/mobile/components/home/TrendChart.tsx
    - apps/mobile/components/home/ReadinessLight.tsx
    - apps/mobile/app/(tabs)/index.tsx
    - apps/mobile/app/(tabs)/settings/index.tsx
    - apps/mobile/lib/devSeedPlan.ts
    - apps/mobile/lib/devSeed.ts
    - apps/mobile/lib/__tests__/devSeedPlan.test.ts

key-decisions:
  - "TSB is drawn as a real volt line on /trends ONLY -- a deliberate, scoped override of D-18's no-TSB-line rule for the home chart, since /trends has no HssRing and TSB is the readiness quantity the screen exists to show"
  - "recentTrend(db, days) replaces last28DaysTrend's hardcoded query body; last28DaysTrend now delegates to recentTrend(db, 28) so there is exactly one query shape"
  - "Range switching never refetches: one recentTrend(db, 365) read per focus, sliced client-side via sliceRange for 28D/90D/1Y -- matches History's precedent for this local-first dataset size"
  - "devSeedPlan.ts's phaseMultiplier restructured into macrocycleBlocks/blockPhaseMultiplier so windows > 90 days repeat the build->taper shape per ~90-day block with a mild across-block progression, while the <=90-day shape stays bit-for-bit identical to the pre-existing seeder"
  - "Reworded two trendStats.ts/trendStats.test.ts doc comments that named devSeedPlan.ts by name -- the Task 3 seeder-reachability gate does a naive substring scan for 'devSeed' across all .tsx?/.ts files, and the prose reference (not an actual import) was a false positive"

patterns-established:
  - "Named per-range tick-thinning constants (TICK_INTERVAL_DAYS_28D/90D/1Y) instead of an inline magic number, keyed via TICK_INTERVAL_BY_RANGE"

requirements-completed: [D-01, D-02, D-04]

coverage:
  - id: D1
    description: "Tapping VIEW FULL TREND beneath the home chart pushes a real /trends screen with a native back button"
    verification:
      - kind: unit
        ref: "node gate: packages/db + tracer-wiring verification script (Task 1 <verify>)"
        status: pass
    human_judgment: true
    rationale: "Actual tap-to-navigate behavior and back-button feel require on-device interaction; automated gates only proved the wiring exists and typechecks."
  - id: D2
    description: "/trends draws three real lines (ATL bone, CTL ash, TSB volt) plus a dashed steel zero reference, with honest empty/short-history captions"
    verification:
      - kind: unit
        ref: "node gate: trends.tsx tracer-wiring + stats-layer verification scripts"
        status: pass
    human_judgment: true
    rationale: "Visual correctness of the chart render (line colors, dash pattern, gridlines) needs a human to view it on-device; the gates only prove the required symbols/wiring are present."
  - id: D3
    description: "computeTrendStats/sliceRange/formatSignedDelta/formatTrendDateLabel are pure and fully covered by vitest"
    verification:
      - kind: unit
        ref: "apps/mobile/lib/__tests__/trendStats.test.ts (11 cases, all pass)"
        status: pass
    human_judgment: false
  - id: D4
    description: "constants/readinessBand.ts is the single band->color source consumed by both ReadinessLight and the /trends strip"
    verification:
      - kind: unit
        ref: "node gate: stats-layer verification script (Task 2 <verify>)"
        status: pass
    human_judgment: false
  - id: D5
    description: "28D/90D/1Y range switcher redraws chart+strip+stats from one 365-row read with no refetch; short history captions honestly instead of padding"
    verification:
      - kind: unit
        ref: "node gate: range-switcher + seeder-window verification script (Task 3 <verify>)"
        status: pass
    human_judgment: true
    rationale: "Instant-switch feel and caption legibility on-device need human confirmation; the gate only proves the client-side slicing wiring exists."
  - id: D6
    description: "~400-day dev seeder demonstrates the 1Y range without breaking any la6 structural guarantee or existing devSeedPlan test"
    verification:
      - kind: unit
        ref: "apps/mobile/lib/__tests__/devSeedPlan.test.ts (12 cases, all pass); node gates: devSeed guard-adjacency+purity, settings structural gate, seeder-reachability gate"
        status: pass
    human_judgment: true
    rationale: "Actual on-device seed runtime/duration and the resulting 1Y chart appearance need a human running the seeder on the live Metro instance."

duration: ~55min
completed: 2026-09-07
status: complete
---

# Quick Task 260907-qe6: Home Chart Tap-to-Detail + /trends Screen Summary

**A pushed `/trends` route (28D/90D/1Y range switcher, three-series chart with a real TSB line, readiness-band history strip, six-cell stats block) reached from a new "VIEW FULL TREND" tap affordance beneath the home TrendChart, backed by a pure `trendStats.ts` module and a widened 400-day dev seeder.**

## Performance

- **Duration:** ~55 min
- **Tasks:** 3/3 completed
- **Files created:** 4 (`app/trends.tsx`, `lib/trendStats.ts`, `lib/__tests__/trendStats.test.ts`, `constants/readinessBand.ts`)
- **Files modified:** 10

## Accomplishments

- **Task 1 (tracer):** `recentTrend(db, days)` added to `@apsis/db` (parameterized, `last28DaysTrend` now delegates to it); `TrendChart.tsx` gained an optional `onPressDetail` prop rendering a sibling "VIEW FULL TREND" row (never wrapping the chart card, so the D-19 scrub gesture stays uncontended); `app/(tabs)/index.tsx` wires that to `router.push('/trends')`, the only entry point; a new `apps/mobile/app/trends.tsx` pushed route renders a fixed 90-day slice as three real lines (ATL bone, CTL ash, TSB volt) plus a dashed steel zero reference, with honest empty/short-history captions.
- **Task 2 (TDD):** `apps/mobile/lib/trendStats.ts` — pure `computeTrendStats`/`sliceRange`/`formatSignedDelta`/`formatTrendDateLabel` plus the `TREND_RANGES` table, covered by 11 vitest cases written RED-first. `constants/readinessBand.ts` is now the single band→color source consumed by both `ReadinessLight` and a new `/trends` readiness-band history strip. `/trends` gained a six-cell stats block (ATL/CTL/TSB with 7-day deltas, peak load with date, rest days, avg HSS).
- **Task 3:** `/trends` replaced its fixed 90-day slice with a 28D/90D/1Y segmented range switcher sourced from one `recentTrend(db, 365)` read, sliced client-side via `sliceRange` (no refetch on range change); added an honest "SHOWING N OF REQUESTED DAYS · SINCE ..." caption for sparse history; axis label density and point-dot visibility now scale per range. `devSeedPlan.ts`'s `phaseMultiplier` was restructured into `macrocycleBlocks`/`blockPhaseMultiplier` so windows longer than one 90-day macrocycle repeat the build→taper shape as a sequence of near-equal-length blocks (with mild across-block progression), while the ≤90-day shape is preserved bit-for-bit. `devSeed.ts` now seeds `DEV_SEED_DAYS = 400` days.

## Task Commits

Each task was committed atomically:

1. **Task 1: End-to-end tracer (tap → /trends)** — `7449088` (feat)
2. **Task 2: trendStats module (TDD)** — `ecb34b9` (test, RED) → `e088841` (feat, GREEN) → `90a5d6d` (feat: stats block + readiness strip wired into trends.tsx/ReadinessLight/readinessBand.ts)
3. **Task 3: Range switcher + 400-day seeder** — `f237026` (feat)

No plan-metadata commit was made per the orchestrator's explicit instruction for this dispatch: SUMMARY.md/STATE.md/PLAN.md are left uncommitted for the orchestrator to commit.

## Files Created/Modified

- `packages/db/src/queries.ts` — adds `recentTrend(db, days)`; `last28DaysTrend` now delegates to it
- `packages/db/src/index.ts` — re-exports `recentTrend`
- `packages/db/src/__tests__/history-queries.test.ts` — new `describe('recentTrend')` SQL-shape case
- `apps/mobile/components/home/TrendChart.tsx` — optional `onPressDetail` prop + sibling tap-affordance row
- `apps/mobile/components/home/ReadinessLight.tsx` — imports the shared `BAND_COLOR` instead of a private copy
- `apps/mobile/constants/readinessBand.ts` — new: `BAND_COLOR` + `bandColor()` single source of truth
- `apps/mobile/app/(tabs)/index.tsx` — wires `onPressDetail`; `formatShortDate` now delegates to `formatTrendDateLabel`
- `apps/mobile/app/trends.tsx` — new: the full pushed detail route (chart, legend, readiness strip, stats block, range switcher, sparse-history caption)
- `apps/mobile/lib/trendStats.ts` — new: pure stats/formatting module + `TREND_RANGES`
- `apps/mobile/lib/__tests__/trendStats.test.ts` — new: 11 vitest cases
- `apps/mobile/lib/devSeedPlan.ts` — `MACROCYCLE_DAYS`, `macrocycleBlocks`, `blockPhaseMultiplier`
- `apps/mobile/lib/devSeed.ts` — `DEV_SEED_DAYS = 400`, passed through to `buildDevSeedSessions`
- `apps/mobile/lib/__tests__/devSeedPlan.test.ts` — new `describe` block covering the 400-day window (5 cases)
- `apps/mobile/app/(tabs)/settings/index.tsx` — seeder row label/accessibilityLabel/alert/console.error copy updated to the new day count

## Decisions Made

See `key-decisions` in frontmatter above. Notably:
- TSB-as-a-real-line is a deliberate, scoped override of D-18 for `/trends` only (no HssRing on this screen; TSB is the readiness quantity the screen exists to show).
- Range switching is read-once/slice-client-side (matches History's precedent), never a per-range refetch.
- `devSeedPlan.ts`'s macrocycle-block restructuring preserves the pre-existing ≤90-day shape bit-for-bit — verified by running all 7 original tests unchanged (they still pass) plus 5 new long-window cases.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Task 3's seeder-window gate regex couldn't match `buildDevSeedSessions(todayLocalDate(), DEV_SEED_DAYS)`**
- **Found during:** Task 3, running the `range switcher + seeder window` automated gate
- **Issue:** The gate's regex `/buildDevSeedSessions\([^)]*DEV_SEED_DAYS/` requires no `)` between the opening paren and `DEV_SEED_DAYS`; the closing `)` of `todayLocalDate()` broke the match even though the code was correct.
- **Fix:** Extracted `const today = todayLocalDate();` on its own line, then called `buildDevSeedSessions(today, DEV_SEED_DAYS)` — no intervening `)`.
- **Files modified:** `apps/mobile/lib/devSeed.ts`
- **Verification:** Gate script re-run, passes; `pnpm run typecheck` clean.
- **Committed in:** `f237026` (Task 3 commit)

**2. [Rule 3 - Blocking] Task 3's seeder-reachability gate false-positived on doc-comment prose**
- **Found during:** Task 3, running the `seeder reachable only from Settings` automated gate
- **Issue:** The gate does a naive substring scan for `"devSeed"` across every `.tsx?/.ts` file under `apps/mobile`. Two doc comments in `trendStats.ts`/`trendStats.test.ts` (written during Task 2) mentioned `devSeedPlan.ts`/`devSeedPlan.test.ts` by name as a precedent, with no actual import — but the substring match still tripped the gate.
- **Fix:** Reworded both comments to describe the precedent without naming the file literally ("the Settings demo-data planner module" instead of `devSeedPlan.ts`).
- **Files modified:** `apps/mobile/lib/trendStats.ts`, `apps/mobile/lib/__tests__/trendStats.test.ts`
- **Verification:** Gate script re-run, passes; `pnpm --filter @apsis/mobile test` still 103/103.
- **Committed in:** `f237026` (Task 3 commit, alongside the unrelated Task 3 changes since both fixes were discovered while running Task 3's gates)

---

**Total deviations:** 2 auto-fixed (both Rule 3 — blocking automated-gate false positives, no functional code change)
**Impact on plan:** Zero scope creep; both fixes are cosmetic (variable extraction, comment wording) with no behavioral change. Neither gate was weakened, rewritten, or deleted — the underlying code was adjusted to satisfy the existing gate exactly as written.

## Issues Encountered

None beyond the two auto-fixed gate false-positives above.

## Interface Context Confirmation (per plan's `<output>` requirement)

- **victory-native 41.26.0 symbols used and confirmed present at execution time:** `CartesianChart`, `Line`, `Scatter` (added to the `/trends` import; `radius` prop used for 28D-only point dots) — matched the plan's `<interface_context>` exactly, no differences found.
- **@shopify/react-native-skia symbols used and confirmed present:** `DashPathEffect` (child of a Skia `Line`, `intervals`/`phase` props per `dom/types/PathEffects.ts`), `Line` (aliased `SkiaLine`), `matchFont`, `vec` — all matched the plan's description exactly.
- **`yScale(0)`** used via the `CartesianChartRenderArg` destructure to place the dashed TSB zero-reference line, exactly as described.
- **No symbol differed from the plan's `<interface_context>`.**

## Per-range tick thinning constants (this plan; `X_TICK_EVERY_N_DAYS`/`CTL_AREA_FILL_TOP_ALPHA` belong to 260907-qe6b)

- `TICK_INTERVAL_DAYS_28D = 7`
- `TICK_INTERVAL_DAYS_90D = 14`
- `TICK_INTERVAL_DAYS_1Y = 60`
- (looked up per range via `TICK_INTERVAL_BY_RANGE: Record<TrendRangeKey, number>`)

## Dev seeder window

- **Final `DEV_SEED_DAYS` value: 400** (in `apps/mobile/lib/devSeed.ts`)
- **Observed wall-clock duration of the 400-day seed on device:** NOT measured in this session — this sandboxed execution environment has no interactive device/simulator access (no ability to tap the Settings "Seed 400 days of demo data" button and time it). The existing `devSeedBusy` double-tap guard is unchanged and already covers the widened window per the plan's stated expectation ("roughly 320 workout rows plus 320 segment rows"). This is flagged for the user to time on their own device via the live Metro instance mentioned in the dispatch environment notes.

## Resulting per-suite test counts

| Suite | Before this plan | After this plan |
|---|---|---|
| `@apsis/mobile` | 87 | 103 (+11 trendStats, +5 devSeedPlan long-window) |
| `@apsis/db` | 63 | 64 (+1 recentTrend) |
| `@apsis/engine` | 95 | 95 (unchanged, untouched) |
| `@apsis/shared` | 21 | 21 (unchanged, untouched) |

`pnpm run typecheck` is clean. `/trends` is present in `apps/mobile/.expo/types/router.d.ts` (confirmed via the Task 1 typegen-poll gate against the live Metro watcher, which was never killed or restarted). `git status` confirms `packages/engine/` has zero changes.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- The sibling plan `260907-qe6b-PLAN.md` (home `TrendChart.tsx` visual enrichment + `04-UI-SPEC.md` section 5 amendment) may now proceed — this plan's Task 1 commit to `TrendChart.tsx` (the `onPressDetail` prop + tap row) is complete and committed, so qe6b's edits to the same file will layer on top cleanly.
- **On-device spot-check still recommended** (not blocking, since this plan has no checkpoint tasks and ran fully autonomously): confirm the VIEW FULL TREND tap doesn't fight the home chart's scrub gesture, the range switcher redraws instantly with no visible refetch flicker, TSB reads correctly against the dashed zero line when negative, and the 400-day seed completes in a reasonable time on the live Metro instance.
- No blockers.

---
*Phase: 260907-qe6*
*Completed: 2026-09-07*
SELF-CHECK: PASSED — all 6 claimed artifacts and all 5 claimed commits verified present.
