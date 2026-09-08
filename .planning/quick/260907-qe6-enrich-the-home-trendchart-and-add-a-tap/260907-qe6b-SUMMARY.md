---
phase: 260907-qe6b
plan: 01
subsystem: ui
tags: [victory-native, skia, react-native, trend-chart, home-dashboard]

requires:
  - phase: 260907-qe6
    provides: "onPressDetail prop + tap-affordance row on TrendChart.tsx, constants/readinessBand.ts"
provides:
  - "Home TrendChart with horizontal AND vertical steel gridlines"
  - "Gradient area fills under BOTH ATL and CTL series (CTL alpha strictly below ATL's)"
  - "Point dots (Scatter) on both series"
  - "Densified x-axis labels (every 4th day) plus new y-axis tick labels"
  - "Second dated 04-UI-SPEC.md section 5 revision recording the D-02/D-03/D-04 divergence"
affects: [home-dashboard, trends-detail-screen, ui-spec]

actuals:
  tokens: 2745
  tasks: 1
  commits: 1

tech-stack:
  added: []
  patterns:
    - "Palette-containment gate resolves volt by VALUE (not key name) from constants/Colors.ts at runtime, walking local imports up to 3 hops"
    - "Skia Group opacity wrapper as the sanctioned workaround for Area.opacity (plain number) vs Line.end/Scatter.opacity (animated-capable)"

key-files:
  created: []
  modified:
    - apps/mobile/components/home/TrendChart.tsx
    - .planning/phases/04-run-logger-home-dashboard/04-UI-SPEC.md

key-decisions:
  - "CTL_AREA_FILL_TOP_ALPHA set to 0.1, strictly below the pre-existing ATL AREA_FILL_TOP_ALPHA of 0.18, so ATL stays the visually dominant series"
  - "X_TICK_EVERY_N_DAYS set to 4 (was inline every-7th-day), giving a 28-day window seven x labels instead of four"
  - "Scatter.opacity is animated-capable in the installed victory-native 41.26.0 typings, so point dots ride drawProgress directly with no extra Group wrapper (unlike Area.opacity, which stays a plain number and remains inside the existing Group)"
  - "Point dot radius (POINT_DOT_RADIUS = 2.5) and y-axis tick count (Y_AXIS_TICK_COUNT = 4) added as new named constants rather than inline literals, matching the file's existing tuning-knob convention"

patterns-established:
  - "New chart affordances (dots, second area, extra axis labels) reuse the existing hexToRgba() local helper and Colors.dark.TOKEN dot-access discipline -- no new color constants, no raw hex"

requirements-completed: [D-02, D-03]

coverage:
  - id: D1
    description: "Home chart shows horizontal AND vertical steel gridlines"
    verification:
      - kind: unit
        ref: "node -e enrichment gate: lineWidth!==0 check on xAxis"
        status: pass
    human_judgment: true
    rationale: "Static gate proves the props are wired; actual on-device rendering (does it read richer without stealing focus from HssRing) requires visual confirmation on the running Metro dev server, per the plan's on-device verification list."
  - id: D2
    description: "Gradient area fills under BOTH ATL and CTL series, CTL alpha strictly below ATL's"
    verification:
      - kind: unit
        ref: "node -e enrichment gate: Area count >=2, LinearGradient count >=2, CTL_AREA_FILL_TOP_ALPHA < AREA_FILL_TOP_ALPHA"
        status: pass
    human_judgment: false
  - id: D3
    description: "Point dots on both series via Scatter"
    verification:
      - kind: unit
        ref: "node -e enrichment gate: /\\bScatter\\b/.test(code)"
        status: pass
    human_judgment: false
  - id: D4
    description: "Denser mono axis labels on both axes (x every 4th day, y gains tick labels)"
    verification:
      - kind: unit
        ref: "node -e enrichment gate: X_TICK_EVERY_N_DAYS<7, yAxis labelColor present"
        status: pass
    human_judgment: false
  - id: D5
    description: "No volt reaches the home chart in any form (token name, hex, rgb triple, hsl, computed/destructured access, or transitive import within 3 hops)"
    verification:
      - kind: unit
        ref: "node -e hardened volt-containment gate (printed: accent, accentPressed, tint, tabIconSelected)"
        status: pass
    human_judgment: false
  - id: D6
    description: "la6 gates and the public TrendChart contract survive unchanged (D-19 scrub, animate-once/800ms ceiling, 0.18 area-alpha ceiling, calibratingCaption, TrendChartPoint index signature)"
    verification:
      - kind: unit
        ref: "node -e la6 shape gate + public-contract gate"
        status: pass
    human_judgment: false
  - id: D7
    description: "04-UI-SPEC.md section 5 carries a second dated revision recording every override, la6 block intact, rest of document intact"
    verification:
      - kind: unit
        ref: "node -e section-5 amendment gate + collateral-damage gate"
        status: pass
    human_judgment: false
  - id: D8
    description: "pnpm run typecheck clean and all four vitest suites pass with no reduction in test count"
    verification:
      - kind: unit
        ref: "pnpm run typecheck; pnpm --filter @apsis/mobile|db|engine|shared test"
        status: pass
    human_judgment: false

duration: ~15min
completed: 2026-09-08
status: complete
---

# Phase 260907-qe6b: Enrich home TrendChart + amend 04-UI-SPEC Summary

**Home TrendChart gains vertical+horizontal steel gridlines, dual-series gradient fills (CTL strictly under ATL's alpha), point dots via victory-native's Scatter, and denser bone/ash axis labels -- all volt-free and containment-gate-verified -- with a matching dated 04-UI-SPEC.md section 5 revision.**

## Performance

- **Duration:** ~15 min (not precisely instrumented at session start)
- **Completed:** 2026-09-08T00:00Z
- **Tasks:** 1/1
- **Files modified:** 2

## Accomplishments

- `apps/mobile/components/home/TrendChart.tsx`: xAxis now carries a real hairline `lineColor: Colors.dark.steel` (was zeroed out), enabling vertical gridlines to match the existing horizontal `yAxis` rule.
- Added a second `<Area>` + `<LinearGradient>` under the CTL series (ash, `CTL_AREA_FILL_TOP_ALPHA = 0.1`), strictly below the pre-existing ATL fill's `AREA_FILL_TOP_ALPHA = 0.18`, so the acute ATL line/fill stays visually dominant while both series are now filled. Paint order: CTL area, ATL area (both inside the existing draw-on `Group`), ATL line, CTL line, ATL dots, CTL dots, scrub hairline.
- Imported `Scatter` from `victory-native` and rendered one dot layer per series (ATL in `Colors.dark.text`, CTL in `Colors.dark.mutedText`), circle shape, `POINT_DOT_RADIUS = 2.5`, explicit `style="fill"`, `opacity={drawProgress}` passed directly (no extra Group needed -- `Scatter.opacity` is animated-capable in the installed 41.26.0 typings, confirmed against the `.d.ts` before writing).
- Replaced the inline every-7th-day x-tick filter with a named `X_TICK_EVERY_N_DAYS = 4` constant; a 28-day window now carries seven x labels instead of four.
- Added `font`, `labelColor: Colors.dark.mutedText`, and `tickCount: Y_AXIS_TICK_COUNT` (= 4) to the `yAxis` config so the horizontal gridlines now carry readable numeric values.
- Updated the file's header doc comment to describe the D-02 amendment (both-series fill, gridlines, dots) rather than the stale D-18-only description.
- `.planning/phases/04-run-logger-home-dashboard/04-UI-SPEC.md` section 5: appended a second dated revision block (`Revised 2026-09-07 (quick task 260907-qe6)`) directly after the existing la6 block, following its exact supersede idiom (Changed on the home chart / Changed elsewhere / New surface / Accent usage / Unchanged / Why), recording the `/trends` route, the deliberate non-resurrection of the five-tab TRENDS layout (D-04), and the TSB-as-third-line exception scoped to the detail screen only.

## Task Commits

1. **Task 1: Enrich the home TrendChart, then amend 04-UI-SPEC.md section 5** - `f3346d3` (feat)

**Plan metadata:** this SUMMARY + STATE.md update (STATE.md committed separately by the orchestrator per this plan's constraints).

## Files Created/Modified

- `apps/mobile/components/home/TrendChart.tsx` - vertical gridlines, dual-series area fills, point dots, densified axis labels, all volt-free
- `.planning/phases/04-run-logger-home-dashboard/04-UI-SPEC.md` - second dated section-5 revision block (qe6, amends D-18/D-02)

## Decisions Made

- `CTL_AREA_FILL_TOP_ALPHA = 0.1` (ATL's pre-existing `AREA_FILL_TOP_ALPHA` stays at `0.18`) -- strictly below per the plan's "acute line stays dominant" requirement, verified by the enrichment gate's numeric comparison.
- `X_TICK_EVERY_N_DAYS = 4` -- densifies from the prior inline `day % 7 === 0` to `day % 4 === 0`, giving seven labels on a 28-day window; kept as the single named tuning knob the plan specified.
- `POINT_DOT_RADIUS = 2.5` and `Y_AXIS_TICK_COUNT = 4` added as new named constants (not inline literals), matching the file's existing tuning-knob documentation convention (each has an inline comment explaining its purpose and how to retune on-device).
- Both new `<Area>` fills placed inside the existing draw-on `<Group opacity={drawProgress}>` per the plan's explicit instruction (`Area.opacity` is a plain `number` in the installed victory-native typings, confirmed directly against `node_modules/victory-native/dist/cartesian/components/Area.d.ts` -- `Partial<Pick<PathProps, "color"|"blendMode"|"opacity"|"antiAlias">>`, not run through `SkiaDefaultProps`). `Scatter.opacity`, by contrast, IS `SkiaDefaultProps`-wrapped and animated-capable (confirmed against `Scatter.d.ts`), so the two `<Scatter>` dot layers ride `drawProgress` directly with no wrapping Group.

## Deviations from Plan

None - plan executed exactly as written. The header doc-comment update (describing the new D-02 fill/gridline/dot behavior instead of the stale D-18-only text) was a documentation-accuracy touch-up within the same declared file, not a scope change.

## Issues Encountered

- The section-5 amendment gate initially failed on a missing `point dots` (lowercase) substring -- the first draft used "Point dots" (capitalized, sentence-medial). Rewrote the sentence so the phrase appears lowercase mid-sentence, matching the gate's exact string match. Re-ran the gate green.

## Interface Verification (per plan's Output spec)

- **`X_TICK_EVERY_N_DAYS` final value:** `4` (was inline `% 7`).
- **`CTL_AREA_FILL_TOP_ALPHA` final value:** `0.1`, set against the pre-existing **ATL `AREA_FILL_TOP_ALPHA`** of `0.18`.
- **Volt token set the containment gate resolved from `constants/Colors.ts`:** `accent, accentPressed, tint, tabIconSelected` (printed verbatim by the gate's green run -- four keys, matching the plan's `<plan_provenance>` claim).
- **Installed victory-native typings vs. `<interface_context>`:** matched exactly. `Scatter` props (`points`, `animate`, `radius`, `shape`, plus `SkiaDefaultProps<Pick<PathProps, ..., "opacity", ...>>`) confirmed in `node_modules/victory-native/dist/cartesian/components/Scatter.d.ts` -- `opacity` is animated-capable. `Area` props (`Partial<Pick<PathProps, "color"|"blendMode"|"opacity"|"antiAlias">>`) confirmed in `Area.d.ts` -- `opacity` is a plain `number`, not `SkiaDefaultProps`-wrapped, matching the plan's stated la6 asymmetry exactly.
- **Resulting per-suite test counts:** mobile 103/103 (unchanged), db 64/64 (unchanged), engine 95/95 (unchanged, `git status --short -- packages/engine/` empty), shared 21/21 (unchanged). No suite lost or gained a test, matching the plan's floor requirement.

## Known Stubs

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- The home chart and 04-UI-SPEC.md are now consistent; no outstanding divergence between the shipped code and the design doc for this surface.
- On-device visual confirmation (does the richer chart read well without stealing focus from HssRing, does the D-19 scrub still track with no lag) is the one item left to the developer via the already-running Metro dev server, per the plan's on-device verification list -- this was not killed or restarted during this task.
- No blockers for subsequent phase work.

## Self-Check: PASSED

- FOUND: apps/mobile/components/home/TrendChart.tsx
- FOUND: .planning/phases/04-run-logger-home-dashboard/04-UI-SPEC.md
- FOUND: commit f3346d3

---
*Phase: 260907-qe6b*
*Completed: 2026-09-08*
