---
phase: 260907-rnr
plan: 01
subsystem: ui
tags: [react-native, victory-native, reanimated, skia, gesture, tooltip, expo-router]

# Dependency graph
requires:
  - phase: 260907-qe6b
    provides: "Enriched home TrendChart.tsx (gridlines, dual area fills, point dots) whose D-19/D-20 scrub mechanism this plan reads as a reference and ports, unedited"
provides:
  - "formatScrubTooltip(row) in lib/trendStats.ts — the single tested D-20 tooltip-copy formatter, composing formatTrendDateLabel + formatSignedDelta"
  - "D-19 scrub hairline + D-20 tooltip wired into app/trends.tsx's detail chart, with centre-on-finger + clamp-to-card-edge placement"
affects: [trends, home-dashboard, ui-polish]

# Actuals (#2632)
actuals:
  tokens: 3222
  tasks: 2
  commits: 3

tech-stack:
  added: []
  patterns:
    - "Tooltip-copy formatters live in lib/trendStats.ts (pure, no React/native imports) and are composed — never re-implemented — by every screen that renders a scrub tooltip"
    - "Scrub-gesture wiring (useChartPressState/hairline/tooltip fade) is duplicated per screen rather than extracted into a shared hook, by explicit user decision, to avoid touching a concurrently-owned file"

key-files:
  created: []
  modified:
    - apps/mobile/lib/trendStats.ts
    - apps/mobile/lib/__tests__/trendStats.test.ts
    - apps/mobile/app/trends.tsx

key-decisions:
  - "formatScrubTooltip composes formatTrendDateLabel + formatSignedDelta rather than reimplementing date/sign formatting, so home and detail tooltips cannot drift on copy (verified by the U+2212 minus-sign count gate)"
  - "Detail tooltip centres on the finger and clamps inside the card's overflow:'hidden' bounds instead of home's left-anchored placement — approved divergence to keep the wide D-20 line readable across the whole chart width"
  - "No chartPressConfig and no shared-hook extraction: matched app/(tabs)/index.tsx's home chart configuration exactly rather than tuning pan behavior or touching the concurrently-owned TrendChart.tsx"

patterns-established:
  - "Any future third scrub-enabled chart should extract the gesture-wiring hook this task deliberately left duplicated, now that TrendChart.tsx ownership (qe6b) has landed"

requirements-completed: [D-19, D-20]

coverage:
  - id: D1
    description: "formatScrubTooltip is exported from lib/trendStats.ts, composes the existing tested date/sign formatters, and is covered by 6 new unit tests (typical day, rest day, negative TSB minus-sign, signed-zero TSB, fractional rounding, date-formatter parity)"
    requirement: D-20
    verification:
      - kind: unit
        ref: "apps/mobile/lib/__tests__/trendStats.test.ts#formatScrubTooltip"
        status: pass
      - kind: other
        ref: "plan gate G1c — exactly one U+2212 in trendStats.ts (anti-duplication)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Dragging a finger across the /trends detail chart shows the ash hairline + tooltip tracking the finger with zero lag, clamped inside the card at both edges, coexisting with page scroll and the range switcher"
    requirement: D-19
    verification:
      - kind: other
        ref: "typecheck + structural gates G2a-G2f (no screen-level test harness exists for app/trends.tsx per plan Interfaces section)"
        status: pass
    human_judgment: true
    rationale: "app/trends.tsx has no component test harness (vitest.config.mts only includes lib/**); the interactive scrub feel, edge-clamping, and gesture-vs-scroll coexistence can only be confirmed by the user on their running physical-device Metro session, which this executor cannot drive"

duration: 27min
completed: 2026-09-08
status: complete
---

# Quick Task 260907-rnr: D-19 Scrub/Drag on the /trends Detail Chart Summary

**Ported the home chart's D-19 scrub hairline + D-20 tooltip onto the `/trends` detail chart, with a single tested `formatScrubTooltip` formatter so the two screens' tooltip copy can never drift apart.**

## Performance

- **Duration:** 27 min
- **Started:** 2026-09-07T23:47:00Z
- **Completed:** 2026-09-08T00:14:00Z
- **Tasks:** 2 completed
- **Files modified:** 3

## Accomplishments
- Added `formatScrubTooltip(row: TrendStatRow): string` to `lib/trendStats.ts`, composing the already-tested `formatTrendDateLabel` and `formatSignedDelta` — no second date formatter, no second sign formatter.
- 6 new unit tests covering a typical day, a rest day, negative TSB (U+2212 minus, no ASCII hyphen), signed-zero TSB, fractional rounding, and date-formatter parity. Mobile suite: 103 → 109 passing.
- Wired the D-19 scrub hairline (1px ash `SkiaLine`, opacity-only fade ≤150ms) and D-20 tooltip (`AnimatedTextInput` driven by `useAnimatedProps`) into `app/trends.tsx`'s `CartesianChart`, matching the home chart's `useChartPressState`/gesture configuration exactly (no `chartPressConfig`, no touchable wrapper).
- Implemented the approved divergence from home: the tooltip centres on the finger (`state.x.position.value - tooltipWidthSV.value / 2`) then clamps between `TOOLTIP_EDGE_INSET` and the card's measured width, so it stays fully visible at both edges of the card instead of being clipped by `overflow: 'hidden'`.

## Task Commits

Each task was committed atomically (TDD RED/GREEN split for Task 1):

1. **Task 1 (RED): failing tests for formatScrubTooltip** - `873eadc` (test)
2. **Task 1 (GREEN): implement formatScrubTooltip** - `14be815` (feat)
3. **Task 2: wire D-19 scrub hairline + D-20 tooltip into app/trends.tsx** - `2eaa06f` (feat)

No plan-metadata commit made per this dispatch's constraints (STATE.md/ROADMAP.md updates are the orchestrator's job).

## Files Created/Modified
- `apps/mobile/lib/trendStats.ts` - added `formatScrubTooltip`, the single tested D-20 tooltip-copy source
- `apps/mobile/lib/__tests__/trendStats.test.ts` - added `describe('formatScrubTooltip')` with 6 cases
- `apps/mobile/app/trends.tsx` - added `useChartPressState`, hairline `SkiaLine`, `AnimatedTextInput` tooltip, centre-clamp placement, `onLayout` width tracking on the card and tooltip

## Decisions Made
- Composed rather than reimplemented date/sign formatting in `formatScrubTooltip` (per plan's hard prohibition and the G1c anti-duplication gate).
- Kept the ~30 lines of gesture wiring duplicated between `TrendChart.tsx` and `trends.tsx` rather than extracting a shared hook, per the plan's explicit non-goal (would require editing the concurrently-owned `TrendChart.tsx`).
- Used `windowRows.map((row) => formatScrubTooltip(row))` for `tooltipLines` (calling the formatter with an explicit reference rather than passing it directly to `.map`) — functionally identical, but this shape reads unambiguously as "the formatter is called here" for anyone auditing the copy-locality invariant.

## Deviations from Plan

None - plan executed exactly as written. All named interfaces (`useChartPressState`, `ChartBounds`, `clamp`, `Animated.addWhitelistedNativeProps`) matched the plan's pre-verified signatures with no compile-time surprises.

## Issues Encountered

None.

## Verification Results (verbatim)

**Task 1 gates:**
```
G1a GREEN (109 tests)
G1b GREEN
G1c GREEN
```

**Task 2 gates:**
```
G2a GREEN   (pnpm run typecheck clean)
G2b GREEN   (all positive wiring tokens present; formatScrubTooltip( called, not just imported)
G2c GREEN   (touchables=1 handlers=1 responders=0 scrollEnabled=0 — unchanged from baseline, no new touchable wraps the card)
G2d GREEN   (screen=0 module=1 minus-in-screen=0 — tooltip copy stays single-sourced in lib/trendStats.ts)
G2e GREEN   (TrendChart.tsx / 04-UI-SPEC.md / packages/engine untouched by this task's commits)
```

**All four suites (G2f), no reduction from the 103/64/95/21 baseline:**
```
apps/mobile   GREEN (109)
packages/db   GREEN (64)
packages/engine GREEN (95)
packages/shared GREEN (21)
```

**`git diff --name-only` since BASE_SHA (14be8150) lists exactly:**
```
apps/mobile/app/trends.tsx
```
(matches the plan's expected file list combined with Task 1's own commits, which preceded BASE_SHA.)

## Human On-Device Verification — NOT PERFORMED BY THIS EXECUTOR

Per the environment constraints, Metro is running live on the user's physical device and this
executor has no ability to drive that device. The plan's five `<human-check>` items are reported
here as **pending user confirmation**, not verified:

1. Dragging across the chart shows the ash hairline and tooltip, matching the home chart's line shape — **not verified by executor**.
2. Tooltip stays fully visible at both the far-left and far-right edges of the chart — **not verified by executor**.
3. Hairline tracks the finger with no rubber-banding; only fade eases — **not verified by executor**.
4. A vertical drag starting on the chart still scrolls the page; range buttons still switch on a single tap — **not verified by executor**.
5. Switching range mid-scrub leaves no stale tooltip line — **not verified by executor**.

**To verify:** open `/trends` on the already-running Metro session (no restart needed — re-saving
`apps/mobile/app/trends.tsx` should already have triggered Fast Refresh) and walk through the five
items above.

## Known Stubs

None.

## Threat Flags

None — this task adds no new network endpoint, auth path, or schema change. `T-rnr-01` (out-of-range `matchedIndex` on a range switch) is mitigated by the `?? ''` fallback in `tooltipText`'s derived value, as specified in the plan's threat register.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- `/trends` now has full scrub parity with the home chart's interaction model, pending the user's on-device confirmation of the five human-check items above.
- If a third scrub-enabled chart is ever added, the duplicated gesture-wiring block in both `TrendChart.tsx` and `trends.tsx` is the natural extraction candidate into a shared hook — deliberately deferred here since `TrendChart.tsx` was concurrently owned during this task.

---
*Quick task: 260907-rnr*
*Completed: 2026-09-08*

## Self-Check: PASSED

- FOUND: apps/mobile/lib/trendStats.ts
- FOUND: apps/mobile/lib/__tests__/trendStats.test.ts
- FOUND: apps/mobile/app/trends.tsx
- FOUND: .planning/quick/260907-rnr-add-d-19-scrub-drag-interaction-to-the-t/260907-rnr-SUMMARY.md
- FOUND commit: 873eadc (test RED)
- FOUND commit: 14be815 (feat GREEN)
- FOUND commit: 2eaa06f (feat Task 2)
- Confirmed `export function formatScrubTooltip` present in lib/trendStats.ts
