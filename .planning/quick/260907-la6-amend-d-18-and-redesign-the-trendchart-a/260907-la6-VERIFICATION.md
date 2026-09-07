---
phase: quick/260907-la6
verified: 2026-09-07T20:26:06Z
status: human_needed
score: 10/12 must-haves verified
behavior_unverified: 2
overrides_applied: 0
behavior_unverified_items:
  - truth: "TrendChart animates its series in on first paint, in under 800ms, once per mount"
    test: "On a dev build, mount the Today screen with real seeded data present, observe the initial draw-on, then force a data refresh (e.g. background/foreground the app, or wait for the next load_daily recompute) and confirm the lines do NOT redraw a second time."
    expected: "Both ATL/CTL lines and the ATL area fill animate from undrawn to fully drawn over ~600ms exactly once; any subsequent re-render with updated `data` (same or larger array) must NOT replay the draw-on."
    why_human: "The animate-once latch (`hasDrawnOnceRef` + `drawProgress` shared value) is a state-transition/non-replay invariant. Static analysis confirms the guard code is present and correctly wired (verified against installed victory-native/Skia .d.ts and compiled .js — `Line`'s `end` prop is a genuine native stroke-trim via `<skPath start end>`, and `<Group opacity={drawProgress}>` is a genuine native paint-opacity ramp, not a no-op), but no automated test exercises the mount-then-update sequence, and this environment has no device/simulator to observe the actual animation timing or confirm non-replay at runtime."
  - truth: "The scrub hairline and tooltip card fade rather than snap, while the tooltip's horizontal position still tracks the finger with zero lag"
    test: "On a dev build, start a touch-drag scrub across the chart and release it, while dragging a finger fast across the chart."
    expected: "The hairline and tooltip opacity ramp in/out over ~150ms (not an instant snap); the hairline's x-position and the tooltip's horizontal translation track the fingertip on every frame with no visually perceptible lag or catch-up easing."
    why_human: "This is an ordering/decoupling invariant (opacity eased via `withTiming`, x-position read directly from `state.x.position.value` with no timing/spring) that only a running gesture responder can demonstrate. Static analysis confirms the code correctly separates the two concerns (`cursorOpacity` shared value for fade vs. direct `state.x.position.value` reads in `useDerivedValue`/`useAnimatedStyle` for position), but perceived lag and animation feel cannot be judged from source alone."
  - truth: "A developer can populate roughly 90 days of plausible HSS/ATL/CTL from Settings in a dev build, and can clear it again"
    test: "In a dev build, open Settings > Developer, tap 'Seed 90 days of demo data', confirm the Today screen updates with a non-calibrating ring, populated ATL/CTL/TSB tiles, and the redesigned chart; then tap 'Clear demo data' and confirm the screen returns to its prior (likely empty/calibrating) state."
    expected: "Seed populates real-looking data end-to-end through the UI; Clear fully reverses it with no residual synthetic rows."
    why_human: "The pure data-generation half (`buildDevSeedSessions`) is unit-tested and verified deterministic/plausible (7/7 tests, independently re-run and passing). The DB-writing half (`seedDevTrendData`/`clearDevSeedData`) and its Settings tap-through wiring are statically verified (guard placement, call-site gating, `recomputeLoadDaily` reuse) but require op-sqlite + a running RN app to confirm the round-trip actually renders and clears correctly on the Today screen — no device/simulator is available in this environment."
coincidental_reliance_items: []
---

# Quick Task 260907-la6: Amend D-18 and Redesign the TrendChart Verification Report

**Task Goal:** Amend D-18 and redesign the TrendChart (animated draw-on, gradient area fill, softened curves) plus a `__DEV__`-only 90-day seeder
**Verified:** 2026-09-07T20:26:06Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | 04-UI-SPEC.md §5 permits gradient area fill, softened curve, mount draw-on, no longer forbids them | ✓ VERIFIED | Read full §5 text directly (lines between `### 5.` and `### 6.`): "A vertical gradient area fill beneath the ATL series only is permitted..." / "Curve interpolation:..." / "Mount draw-on animation:..." bullets present; prior forbidding clauses absent. |
| 2 | §5 still forbids volt, vertical gridlines, ~2px weight, mono/9px/ash labels, D-20 copy format, D-19 mechanics, D-22 calibrating behavior | ✓ VERIFIED | Same read: "No volt anywhere on the chart (D-18)", "Line weight ~2px", "Gridlines: steel, 1px, horizontal only (no vertical gridlines)", "Axis labels: mono, 9px, ash", exact D-20 copy string `"{MON DD} · HSS {N} · ATL {N} · CTL {N} · TSB {±N}"`, D-19 hairline-snap/tooltip-offset mechanics, and D-22 "never a fake/placeholder line" all present verbatim. |
| 3 | TrendChart renders ATL/CTL with a softened (non-straight) curve | ✓ VERIFIED | `TrendChart.tsx` line 50: `const CURVE_TYPE: CurveType = 'monotoneX';` applied identically to `<Area>` (line 201) and both `<Line>` elements (lines 213, 220). `'monotoneX'` confirmed as a real member of victory-native's exported `CurveType` union. |
| 4 | TrendChart draws a vertical gradient area fill beneath ATL, bone at capped low alpha fading to fully transparent | ✓ VERIFIED | Lines 200-208: `<Area points={points.atl} y0={chartBounds.bottom} curveType={CURVE_TYPE}>` wraps a `<LinearGradient start=top end=bottom colors=[bone@0.18, bone@0]>`; `AREA_FILL_TOP_ALPHA = 0.18` (at the plan's ceiling). CTL renders no `<Area>` — bare line only. |
| 5 | TrendChart animates its series in on first paint, in under 800ms, once per mount | ⚠️ PRESENT_BEHAVIOR_UNVERIFIED | Code present and correctly wired (see behavior_unverified_items); no automated test exercises the animate-once/non-replay runtime invariant. |
| 6 | Scrub hairline/tooltip fade rather than snap; tooltip x-position tracks finger with zero lag | ⚠️ PRESENT_BEHAVIOR_UNVERIFIED | Code present and correctly wired (see behavior_unverified_items); ordering invariant not exercised by any test. |
| 7 | TrendChart references no volt/accent color token and no volt hex anywhere | ✓ VERIFIED | `grep -n "volt\|#C6F23D\|#c6f23d\|Colors.dark.accent" apps/mobile/components/home/TrendChart.tsx` — zero code hits (two comment mentions of "no volt" only, both prose). |
| 8 | TrendChartPoint interface unchanged, so index.tsx's trendData mapping still compiles/renders | ✓ VERIFIED | `TrendChartPoint` (lines 79-95) retains `day/hss/atl/ctl/tsb/dateLabel` + index signature exactly as documented in the plan's live observations; `pnpm run typecheck` passes clean (independently re-run), confirming `index.tsx`'s ~line 296/409 usage still compiles. |
| 9 | A developer can populate ~90 days of plausible HSS/ATL/CTL from Settings in a dev build, and clear it again | ⚠️ PRESENT_BEHAVIOR_UNVERIFIED | Data-plausibility half fully machine-verified (see artifacts below); the Settings-tap-through / DB round-trip half requires a running dev build (see behavior_unverified_items). |
| 10 | Every seeder entry point is dead code in a release build — guard first statement positionally, both Settings call sites brace-matched inside `{__DEV__}` | ✓ VERIFIED | `devSeed.ts` lines 54/126: `if (!__DEV__) return;` is the literal first statement of both `async function` bodies (confirmed by direct read — no statement precedes it). `settings/index.tsx` lines 481-540: `{__DEV__ ? (<>...</>) : null}` opens before, and closes after, both `seedDevTrendData(db)` (488) and `clearDevSeedData(db)` (515) call sites, both as inline `onPress` arrows. |
| 11 | Seeded ATL/CTL/TSB/readinessBand values come from the real engine via `recomputeLoadDaily`, never seeder-authored math | ✓ VERIFIED | `devSeed.ts`: `seedDevTrendData` calls `resolveRunSegment` (existing pure fn) + `sessionHSSDetailed` (from `@apsis/engine`) per session, inserts only `workout`/`endurance_segment` rows, then calls `recomputeLoadDaily(database)` exactly once at the end (line 113) — zero EWMA/stress arithmetic written in this file. |
| 12 | Root `pnpm run typecheck` passes and every workspace vitest suite passes | ✓ VERIFIED | Independently re-run: `pnpm run typecheck` clean; `@apsis/mobile` 87/87, `@apsis/engine` 95/95, `@apsis/db` 63/63, `@apsis/shared` 21/21 — all four workspace suites pass. |

**Score:** 10/12 truths verified (2 present, behavior-unverified)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `.planning/phases/04-run-logger-home-dashboard/04-UI-SPEC.md` | Revised §5 with dated revision blockquote | ✓ VERIFIED | Full §5 read directly; dated `> **Revised 2026-09-07 (quick task 260907-la6) — amends D-18:**` blockquote present with all four required components (changed/unchanged/why/note). Collateral-preservation confirmed: `git diff` of the task's 5 commits touches only this one file plus the 5 declared code files — no edits to `DESIGN-SYSTEM.md`, other headings, or `## Checker Sign-Off`. |
| `apps/mobile/components/home/TrendChart.tsx` (redesigned) | Draw-on, gradient fill, softened curves, eased tooltip | ✓ VERIFIED | Read in full (287 lines). All redesign elements present and semantically correct (see Data-Flow Trace below for the `Area.opacity`/`Group` wrapping claim, independently confirmed against installed `.d.ts`/compiled `.js`). |
| `apps/mobile/lib/devSeedPlan.ts` (pure synthetic-session generator) | 90-day build→taper→peak, deterministic, no native imports | ✓ VERIFIED | Read in full; imports only `./localDate`; mulberry32 PRNG seeded from date-string hash (never `Math.random`); exact-count Fisher-Yates rest-day selection (`Math.round(90*0.2)=18` days, always exactly 20% — not a noisy per-day probability). |
| `apps/mobile/lib/devSeed.ts` (`__DEV__`-guarded DB seeder + clearer) | Guard-first, reuses engine, no HealthKit | ✓ VERIFIED | Read in full; matches all Task 3 requirements (see truths 10-11 above). |
| `apps/mobile/lib/__tests__/devSeedPlan.test.ts` | 7 tests covering window/rest-fraction/fields/shape/determinism | ✓ VERIFIED | Re-run in isolation: `Test Files 1 passed (1)`, `Tests 7 passed (7)`. Test assertions independently reviewed — genuinely check window bounds, exact 15-25% rest fraction, field plausibility (110-185 HR, positive duration/distance), build→taper→peak weekly-mean trend + single-peak-in-build-block, and determinism across repeated + differing dates. |
| `apps/mobile/app/(tabs)/settings/index.tsx` (`__DEV__`-only Developer section) | Two gated rows, busy-guard, inline handlers | ✓ VERIFIED | Read lines 470-545; matches plan's structural requirements exactly (inline arrow `onPress`, `devSeedBusy` state guard, `Alert` feedback, reuses `styles.hkConnectRow`/`sectionLabel`/`hairlineDivider`, no new visual language). |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `TrendChartPoint` (TrendChart.tsx) | `index.tsx` ~line 296/409 | Shared interface shape | ✓ WIRED | Interface fields unchanged; `pnpm run typecheck` passes, confirming the contract still compiles at the `index.tsx` call site. |
| `devSeed.ts` | `recomputeLoadDaily` | Single-call reuse after inserts | ✓ WIRED | `seedDevTrendData` and `clearDevSeedData` each call `recomputeLoadDaily(database)` exactly once, after all `workout`/`endurance_segment` mutations — confirmed by direct read, no direct `load_daily` write anywhere in the file. |
| `devSeed.ts` | `resolveRunSegment` + `sessionHSSDetailed` | Reused IF/HSS derivation | ✓ WIRED | `seedDevTrendData` imports and calls both per-session; zero re-derived stress math. |
| `settings/index.tsx` | `devSeed.ts` exports | `{__DEV__}`-gated inline `onPress` calls | ✓ WIRED | Both call sites confirmed structurally inside the gated `<>...</>` block that also contains the `onPress` rows. |
| `04-UI-SPEC.md` §5 revision | `TrendChart.tsx` | Same commit sequence | ✓ WIRED | Commit `ff0ed42` (spec) immediately precedes `1cdc7b3` (chart) in the same task's linear commit sequence; spec content and implementation match line-for-line (curve type, alpha ceiling, duration ceiling, fade ceiling). |

### Data-Flow Trace (Level 4) — victory-native/Skia typing claim

The SUMMARY's most load-bearing technical claim — that `Area`'s `opacity` prop is a plain `number` (not `AnimatedProp`-wrapped) while `Line`'s `end` prop is `AnimatedProp<number>`-wrapped, requiring the `<Group opacity={drawProgress}>` workaround — was independently verified against the actual installed packages (not taken on the executor's word):

| Claim | Verification | Result |
|-------|--------------|--------|
| `victory-native`'s `AreaProps.opacity` is a plain `number`, not `AnimatedProp` | Read `node_modules/victory-native/dist/cartesian/components/Area.d.ts`: `AreaProps` picks `opacity` via `Partial<Pick<PathProps, ...>>` with no `SkiaProps`/`AnimatedProps` wrapper; traced `PathProps` → `DrawingNodeProps` → `GroupProps` → `PaintProps` in Skia's own `Common.d.ts`: `opacity?: number` (raw, dom-level type). | ✓ CONFIRMED |
| `victory-native`'s `Line`'s `end` prop is `AnimatedProp<number>`-wrapped | Read `Line.d.ts`: `CartesianLinePathProps` uses `SkiaDefaultProps<Pick<PathProps, ... "start" \| "end" ...>, "start" \| "end">`; traced `SkiaDefaultProps`/`SkiaProps`/`AnimatedProps` in Skia's `Animations.d.ts`: `AnimatedProps<T>` wraps every key of `T` (except `children`) in `AnimatedProp<T[K]> = T[K] \| { value: T[K] }` — so `end` (and every other picked field) is reactive. | ✓ CONFIRMED |
| `<Group opacity={sharedValue}>` is a genuine, type-safe, functioning fade primitive (not a no-op) | Read `Group.d.ts`: takes `SkiaProps<PublicGroupProps>` — `opacity` wrapped in `AnimatedProp`. Read compiled `Group.js`: forwards `opacity` straight to the native `skGroup` element (real Skia paint-group opacity), no swallowed prop. | ✓ CONFIRMED |
| `<Line end={drawProgress}>` genuinely performs a native stroke-trim draw-on (not a silent no-op) | Read compiled `Line.js`: when `animate` is unset (as in this code), renders a plain `react_native_skia_1.Path` with `{...ops}` spread (`end` included) → Skia's own `Path.js`: destructures `start = 0, end = 1` and forwards to the native `skPath` element, whose `SkPath.trim()` semantics are documented (`trim(startT, stopT, ...)`: "modify this path such that it is a subset of the original path"). | ✓ CONFIRMED |

**Conclusion:** the executor's stated rationale for the `Group` wrapper is genuine, not a rationalized workaround for a mistake — the Area/Line prop-type asymmetry is real, and the chosen fix is a correct, idiomatic use of a real Skia primitive that will visibly animate on-device.

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| `devSeedPlan` test suite passes in isolation | `pnpm --filter @apsis/mobile exec vitest run lib/__tests__/devSeedPlan.test.ts` | `Test Files 1 passed (1)`, `Tests 7 passed (7)` | ✓ PASS |
| Full `@apsis/mobile` suite (regression check) | `pnpm --filter @apsis/mobile test` | `Test Files 8 passed (8)`, `Tests 87 passed (87)` | ✓ PASS |
| `@apsis/engine` suite (no regression) | `pnpm --filter @apsis/engine test` | `95 passed (95)` | ✓ PASS |
| `@apsis/db` suite (no regression) | `pnpm --filter @apsis/db test` | `63 passed (63)` | ✓ PASS |
| `@apsis/shared` suite (no regression) | `pnpm --filter @apsis/shared test` | `21 passed (21)` | ✓ PASS |
| Root typecheck | `pnpm run typecheck` | Clean, no errors | ✓ PASS |
| On-device draw-on / gradient / curve / scrub-fade rendering | — | — | ? SKIP (no device/simulator in this environment — see behavior_unverified_items) |
| On-device Seed/Clear tap-through | — | — | ? SKIP (no device/simulator; op-sqlite requires a dev build, not runnable headlessly here) |

### Anti-Patterns Found

None. Scanned all 6 modified/created files for `TBD`/`FIXME`/`XXX`/`TODO`/`HACK`/`PLACEHOLDER`, empty-return stubs, hardcoded-empty data flowing to render, and console.log-only implementations — no matches. `devSeedPlan.ts` explicitly avoids `Math.random()` and wall-clock reads (verified by direct read, not just grep). Error paths in `devSeed.ts` `console.error` + re-throw as documented.

### Requirements Coverage

No formal requirement IDs were declared in this quick task's plan frontmatter (`requirements: []`), and this is a quick task rather than a numbered roadmap phase, so no REQUIREMENTS.md cross-reference applies.

### Human Verification Required

### 1. TrendChart draw-on fires once per mount and never replays

**Test:** On a dev build, load the Today screen with real (seeded) data present, observe the initial draw-on animation, then trigger a data update (background/foreground the app, or wait for the next `load_daily` recompute) while the component stays mounted.
**Expected:** The lines and area fill animate from undrawn to fully drawn over ~600ms exactly once on first real data; the same draw-on must NOT replay on the subsequent data update.
**Why human:** State-transition/non-replay invariant — code is present and correctly wired (verified against real typings and compiled implementation), but no automated test exercises the mount-then-update sequence, and no device/simulator is available here to observe actual runtime timing or confirm the second update does not redraw.

### 2. Scrub hairline/tooltip opacity fade with zero-lag x-position tracking

**Test:** On a dev build, start and release a touch-drag scrub across the chart, including a fast finger movement.
**Expected:** Hairline + tooltip opacity ramps over ~150ms (no instant snap); the hairline and tooltip x-position track the fingertip on every frame with no visible lag.
**Why human:** Ordering/decoupling invariant between an eased opacity channel and an untweened position channel — visually judged animation quality/lag cannot be assessed from source, and this environment has no gesture-capable runtime.

### 3. Seed / Clear demo data end-to-end from Settings

**Test:** In a dev build, Settings > Developer > "Seed 90 days of demo data", confirm the Today screen populates (ring, tiles, chart); then "Clear demo data" and confirm it reverts.
**Expected:** Seed populates real UI state end-to-end; Clear fully reverses it with no residual `devseed-` rows.
**Why human:** The pure generator (`buildDevSeedSessions`) is unit-tested and independently re-confirmed (7/7 passing); the DB-writing + Settings-wiring half is statically verified for correctness (guard placement, `recomputeLoadDaily` reuse, structural gating) but requires op-sqlite + a running RN app to confirm the actual on-screen round-trip, which this environment cannot run.

### Gaps Summary

No gaps found. All ten statically-verifiable must-haves (spec amendment content and preservation, chart redesign correctness including the independently-confirmed victory-native/Skia typing claims, seeder purity/determinism/plausibility, release-build dead-code guards, engine-reuse discipline, and full green typecheck/test suites) are genuinely implemented — not stubs, not placeholders, not rationalized-after-the-fact claims. The two chart-behavior truths and the seeder's end-to-end Settings round-trip are code-complete and correctly wired by every static check available, but assert on-device runtime behavior (animation timing/non-replay, gesture lag, actual op-sqlite writes surfacing in the UI) that cannot be exercised without a physical device or simulator — exactly the three `<human-check>` gates the plan itself flagged as deferred. This is the sanctioned category of incompleteness for this environment, not a defect.

---

*Verified: 2026-09-07T20:26:06Z*
*Verifier: Claude (gsd-verifier)*
