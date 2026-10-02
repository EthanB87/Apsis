---
phase: quick
plan: 260907-la6
subsystem: ui
tags: [victory-native, skia, reanimated, trend-chart, dev-tooling, seeder, ui-spec]

requires:
  - phase: 04-run-logger-home-dashboard
    provides: TrendChart.tsx, TrendChartPoint contract, 04-UI-SPEC.md section 5 (D-18/D-19/D-20/D-22)
provides:
  - "04-UI-SPEC.md section 5 amended (dated 2026-09-07) to permit a gradient area fill, softened curves, a mount draw-on animation, and an eased scrub hairline/tooltip"
  - "Redesigned TrendChart.tsx: monotoneX curves on both series, ATL-only bone gradient area fill (alpha <=0.18), 600ms draw-on (Skia stroke trim via Line's `end` prop + a wrapping Skia Group opacity ramp for the area), 150ms hairline/tooltip opacity fade with untweened x-position"
  - "apps/mobile/lib/devSeedPlan.ts -- pure, deterministic ~90-day build->taper->peak session generator (mulberry32 PRNG, no Math.random/Date.now)"
  - "apps/mobile/lib/devSeed.ts -- __DEV__-guarded seedDevTrendData/clearDevSeedData writing workout+endurance_segment then calling the existing recomputeLoadDaily"
  - "Settings Developer section (__DEV__-only) to seed/clear the demo data"
affects: [06-07-polish-app-store-submission]

actuals:
  tokens: 8003
  tasks: 3
  commits: 5

tech-stack:
  added: []
  patterns:
    - "Skia stroke-trim draw-on via a component's own `end` AnimatedProp<number> prop (victory-native's Line/CartesianLinePathProps type fully wraps its picked PathProps subset in AnimatedProp, so a Reanimated shared value passes straight through with no cast)"
    - "Reactive fade of a component whose own declared prop type is NOT AnimatedProp-wrapped (victory-native's Area.opacity is a plain `number` in its .d.ts) by wrapping it in a Skia `<Group opacity={sharedValue}>` instead of casting -- Group's SkiaProps<PublicGroupProps> wraps every field in AnimatedProp"
    - "Always-mounted scrub hairline/tooltip with opacity driven by a separate shared value (withTiming), while x-position keeps reading the press-state shared value directly every frame with no timing/spring -- decouples 'fade' easing from 'track the finger' zero-lag requirement"
    - "Deterministic synthetic-data PRNG: mulberry32 seeded from a string hash of the caller-supplied date, plus a seeded partial Fisher-Yates shuffle to pick an EXACT rest-day count (not an independent per-day probability) so a percentage-band test assertion holds for any seed, not just the one exercised at authoring time"
    - "__DEV__-guarded native seeder module (devSeed.ts) kept separate from a pure, vitest-testable planning module (devSeedPlan.ts) -- mirrors the existing runEntryLogic.ts/runEntry.ts split"

key-files:
  created:
    - apps/mobile/lib/devSeedPlan.ts
    - apps/mobile/lib/devSeed.ts
    - apps/mobile/lib/__tests__/devSeedPlan.test.ts
  modified:
    - .planning/phases/04-run-logger-home-dashboard/04-UI-SPEC.md
    - apps/mobile/components/home/TrendChart.tsx
    - apps/mobile/app/(tabs)/settings/index.tsx

key-decisions:
  - "victory-native Area's declared TS prop type does not wrap `opacity` in AnimatedProp (unlike Line, which does) -- routed the area fill's draw-on opacity ramp through a wrapping Skia `<Group opacity={drawProgress}>` instead of a type-unsafe cast, achieving a fully type-checked reactive fade with a supported primitive"
  - "Both ATL and CTL lines get the same `end={drawProgress}` stroke-trim draw-on (not just ATL) -- the plan's behavior section requires 'both series animate in'; CTL is a bare line so trimming it has no area/fill interaction concerns"
  - "Rest-day fraction implemented as an exact seeded-shuffle-selected count (Math.round(days * 0.2)), not an independent per-day Bernoulli probability -- verified by prototyping that the 20% target as an independent probability produced only 13.3% realized rest days for the exact 2026-09-07 test date; the exact-count design guarantees the 15-25% band holds for any seed"
  - "__DEV__ already resolves under `tsc --build` via react-native's own bundled ambient types -- no apps/mobile/expo-env.d.ts was created (the plan listed it as conditional, only if needed)"

requirements-completed: []

coverage:
  - id: D1
    description: "04-UI-SPEC.md section 5 amended to permit the D-18 redesign while preserving volt prohibition, vertical-gridline prohibition, ~2px weight, D-19/D-20/D-22 mechanics"
    verification:
      - kind: other
        ref: "node -e amendment gate + collateral-preservation gate (both in PLAN.md Task 1 <verify>)"
        status: pass
    human_judgment: false
  - id: D2
    description: "TrendChart.tsx redesigned: monotoneX curves, ATL-only bone gradient fill (alpha<=0.18), 600ms draw-on, 150ms hairline/tooltip fade with untweened x-position, TrendChartPoint/Props/calibratingCaption byte-compatible, no volt token/hex"
    verification:
      - kind: other
        ref: "pnpm run typecheck; node -e constants/tokens gate; node -e public-contract gate (PLAN.md Task 2 <verify>)"
        status: pass
      - kind: manual_procedural
        ref: "PLAN.md Task 2 <human-check> -- on-device visual confirmation after Task 3's seeder populates real data"
        status: unknown
    human_judgment: true
    rationale: "The draw-on timing, gradient visual weight vs. the HssRing, and curve softness are inherently visual judgments the plan explicitly defers to an on-device <human-check> gated behind seeded data existing -- not runnable in this environment."
  - id: D3
    description: "devSeedPlan.ts pure ~90-day build->taper->peak generator, TDD RED/GREEN, deterministic, native-import-free"
    verification:
      - kind: unit
        ref: "apps/mobile/lib/__tests__/devSeedPlan.test.ts (7 tests, all passing)"
        status: pass
    human_judgment: false
  - id: D4
    description: "devSeed.ts __DEV__-guarded seedDevTrendData/clearDevSeedData; Settings Developer section reachable only inside a __DEV__-gated block; seeder reachable from exactly 4 files; no HealthKit import"
    verification:
      - kind: other
        ref: "node -e devSeed guard-adjacency+purity gate; node -e Settings structural gate; node -e reachability gate (PLAN.md Task 3 <verify>)"
        status: pass
      - kind: manual_procedural
        ref: "PLAN.md Task 3 <human-check> -- on-device Seed/Clear tap-through"
        status: unknown
    human_judgment: true
    rationale: "Confirming the seeded data actually renders correctly on the Today screen and that Clear returns to the real empty state requires a physical/simulator dev build, which this environment cannot run."

duration: 50min
completed: 2026-09-07
status: complete
---

# Quick Task 260907-la6: Amend D-18 and Redesign the TrendChart Summary

**Amended the locked D-18 trend-chart contract, redesigned `TrendChart.tsx` with a bone gradient area fill, softened curves, a mount draw-on animation, and an eased scrub tooltip, then added a `__DEV__`-only 90-day demo-data seeder reachable from Settings.**

## Performance

- **Duration:** ~50 min
- **Started:** 2026-09-07 (approx. 15:25 local)
- **Completed:** 2026-09-07T20:15:03Z
- **Tasks:** 3 / 3 complete
- **Files modified:** 6 (3 created, 3 modified)

## Accomplishments

- Revised `04-UI-SPEC.md` section 5 with a dated `Revised 2026-09-07` blockquote: permits the
  gradient fill, softened curve, draw-on, and tooltip fade while preserving every prior
  constraint verbatim (no volt, no vertical gridlines, ~2px weight, D-19/D-20/D-22 mechanics).
- Verified the installed `victory-native@41.26.0` / `@shopify/react-native-skia@2.6.9` typings
  directly (per the mutable-scope-authority instruction) before writing any import, and
  discovered a real API asymmetry: `Line`'s `end` prop is fully `AnimatedProp<number>`-wrapped
  (safe for a Reanimated shared value with no cast), but `Area`'s `opacity` prop is a plain
  `number` in its declared type. Solved the latter with a wrapping Skia `<Group opacity={...}>`
  instead of a cast -- a supported, type-safe primitive achieving the same reactive fade.
- Redesigned `TrendChart.tsx`: `monotoneX` curve on both series, ATL-only bone gradient area
  fill capped at alpha 0.18, a 600ms once-per-mount draw-on (stroke trim on both lines + Group
  opacity ramp on the fill), and a 150ms opacity fade on the scrub hairline/tooltip whose
  x-position still reads the press-state shared value directly every frame (zero lag).
  `TrendChartPoint`/`TrendChartProps`/`calibratingCaption` are byte-compatible.
- Added `devSeedPlan.ts` (pure, TDD RED->GREEN, 7 passing tests) generating a deterministic
  ~90-day build->taper->peak synthetic session plan via a seeded mulberry32 PRNG, and
  `devSeed.ts` (native, `__DEV__`-guarded) that reuses the existing `resolveRunSegment` /
  `sessionHSSDetailed` / `recomputeLoadDaily` to seed and clear demo data with zero
  stress/EWMA arithmetic of its own.
- Wired a `__DEV__`-only Developer section into Settings, reusing the existing `hkConnectRow`
  style (no new visual language), with both seeder call sites as inline arrows inside the
  brace-matched `{__DEV__ ? ... : null}` block per the release-build structural gate's
  requirements.

## Task Commits

Each task was committed atomically (Task 3 additionally follows RED/GREEN for its pure module):

1. **Task 1: Amend 04-UI-SPEC.md section 5** - `ff0ed42` (docs)
2. **Task 2: Redesign TrendChart** - `1cdc7b3` (feat)
3. **Task 3a (RED): failing devSeedPlan test** - `0069555` (test)
   **Task 3b (GREEN): buildDevSeedSessions implementation** - `b97649d` (feat)
   **Task 3c: devSeed.ts + Settings Developer section** - `45fe5c4` (feat)

**Plan metadata:** committed separately by the orchestrator (per this executor's constraints).

## Files Created/Modified

- `.planning/phases/04-run-logger-home-dashboard/04-UI-SPEC.md` - Section 5 amended with a dated revision blockquote
- `apps/mobile/components/home/TrendChart.tsx` - Draw-on, gradient fill, softened curves, eased tooltip
- `apps/mobile/lib/devSeedPlan.ts` - Pure deterministic 90-day session-plan generator
- `apps/mobile/lib/__tests__/devSeedPlan.test.ts` - 7 tests covering window bounds, rest fraction, field validity, build/taper/peak shape, determinism
- `apps/mobile/lib/devSeed.ts` - `__DEV__`-guarded `seedDevTrendData`/`clearDevSeedData`
- `apps/mobile/app/(tabs)/settings/index.tsx` - `__DEV__`-only Developer section (Seed/Clear demo data)

## API Surface Verified (Task 2 Step 1)

Read directly from installed `.d.ts` files before writing any import:

- **`victory-native@41.26.0`**: `Area` component exists (`points`, `y0`, `curveType`,
  `connectMissingData`, `animate`, plus a Skia paint-prop subset and Skia paint children --
  confirmed via its compiled implementation, which forwards to `<Path style="fill" {...ops}/>`).
  `Line`'s declared prop type (`CartesianLinePathProps`) wraps its picked `PathProps` subset
  (including `start`/`end`) fully in `AnimatedProp<T>` via `SkiaDefaultProps`/`AnimatedProps` --
  a Reanimated shared value passes as `end` with no cast. `Area`'s declared prop type does
  **not** include `start`/`end` at all and picks `opacity` from the raw (non-animated)
  `PathProps`, so `Area`'s own `opacity` prop only accepts a plain `number`. `CurveType` union:
  `linear | natural | bumpX | bumpY | cardinal | cardinal50 | catmullRom | catmullRom0 |
  catmullRom100 | monotoneX | step | stepAfter | stepBefore | basis`. `useAreaPath`/`useLinePath`
  hooks exist and return `{ path: SkPath }`. `CartesianChart`'s render-prop argument includes
  `chartBounds` directly (not just via the `onChartBoundsChange` callback).
- **`@shopify/react-native-skia@2.6.9`**: `Group`'s declared prop type (`SkiaProps<PublicGroupProps>`)
  wraps every field, including `opacity`, in `AnimatedProp<number>` -- confirmed exported at the
  package's top level via `renderer/components/Group` -> `renderer/components/index` ->
  `renderer/index` -> `src/index` -> package root. `LinearGradient` takes `colors: Color[]`,
  `start`/`end: Vector`. Skia's own dom-level `PathProps` interface has raw `start`/`end: number`
  (non-animated at that layer); it's `victory-native`'s own `Line`/`Area` wrapper types that
  determine whether a caller-facing prop is reactive, not this raw interface.

**Fallback taken:** Area's opacity ramp uses a wrapping `<Group opacity={drawProgress}>` (a
Skia primitive with a fully `AnimatedProp`-wrapped type) rather than the plan's suggested "cast"
or "victory-native's `animate` prop" fallback -- this achieves the exact same reactive fade with
zero type-unsafe casts and zero `pnpm run typecheck` risk.

## Final Constant Values

- `CURVE_TYPE = 'monotoneX'` (non-overshooting; ATL cannot visually dip below zero during calibration)
- `AREA_FILL_TOP_ALPHA = 0.18` (at the plan's ceiling; not yet retuned on-device -- see below)
- `DRAW_ON_DURATION_MS = 600` (under the 800ms DESIGN-SYSTEM.md ceiling)
- `CURSOR_FADE_MS = 150` (at the D-19 amendment's ceiling)

## On-Device Competition Check

Not performed in this environment (no device/simulator available to this executor). The
`AREA_FILL_TOP_ALPHA` constant is deliberately isolated as the single tuning knob per the
plan's own instruction, ready for retuning if the bone wash under ATL competes with the
HssRing on a real device. This is the Task 2 `<human-check>` and the Task 3 `<human-check>`
gates the plan itself defers to a human with a running dev build.

## Decisions Made

See `key-decisions` in frontmatter. Most notable: the victory-native `Area`/`Line` prop-type
asymmetry (`Line.end` is reactive, `Area.opacity` is not) was resolved via a Skia `Group`
wrapper rather than a type cast, and the rest-day fraction is an exact seeded-selection count
rather than an independent per-day probability (verified by prototyping that the literal test
date `2026-09-07` would have produced only 13.3% rest days under an independent-probability
design, missing the required 15-25% band).

## Deviations from Plan

None - plan executed exactly as written. Both API-surface findings described above (Area's
non-reactive `opacity`, the rest-day-fraction design) were resolved within the plan's own
pre-authorized discretion (Task 2's explicit fallback-chain language, and the test being
authored fresh by this executor per Task 3's "write the test first" instruction) -- neither
required an architectural deviation or a checkpoint.

## Issues Encountered

None blocking. The initial rest-day-probability prototype (independent 20% per-day Bernoulli)
produced only 13.3% realized rest days for the exact `2026-09-07` test date -- caught by
prototyping in plain Node before writing the TypeScript implementation, and fixed by switching
to an exact seeded-count selection (Fisher-Yates partial shuffle) before any test was written
against the flawed design.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Tasks 1 and 2 (spec amendment + chart redesign) are independently correct and complete.
- Task 3 (seeder) is fully implemented and gated-green, but its own `<human-check>` and Task 2's
  `<human-check>` (both requiring a running dev build with seeded data) remain outstanding --
  the sanctioned stopping point was NOT needed since all three tasks completed within budget,
  but the on-device visual checks still require the developer to run a dev build.
- 06-07 (App Store screenshots) can now use "Seed 90 days of demo data" from Settings to
  populate a believable Today screen before capturing screenshots, then "Clear demo data"
  afterward.
- `AREA_FILL_TOP_ALPHA` is ready to retune in one place if the bone wash competes with the
  HssRing on-device.

---
*Phase: quick*
*Completed: 2026-09-07*

## Self-Check: PASSED
