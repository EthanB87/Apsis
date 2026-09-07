---
phase: 04-run-logger-home-dashboard
plan: 07
subsystem: ui
tags: [react-native, victory-native, skia, reanimated, drizzle, home-dashboard, chart]

requires:
  - phase: 04-01
    provides: computeLoadDailyUpsertRows, last28DaysTrend/dayGroupedSessions query builders, todayLocalDate
  - phase: 04-02
    provides: victory-native 41.26.0 + Skia 2.6.9 + react-native-svg installed and linked
  - phase: 04-03
    provides: recomputeLoadDaily pipeline writing load_daily.readinessBand/atl/ctl/tsb/dayHss on every finish/save
  - phase: 04-04
    provides: HssRing/ReadinessLight/StatTiles home components (props-driven, DB-free)
provides:
  - components/home/TrendChart.tsx (victory-native CartesianChart + useChartPressState scrub-tooltip chart)
  - components/home/TodayBreakdownSheet.tsx (per-session ring-tap breakdown with D-26 double-day math)
  - app/(tabs)/index.tsx TODAY dashboard (replaces the Phase 4 placeholder)
affects: [04-08 (session detail screen -- receives the /session/detail navigation wired here)]

tech-stack:
  added: []
  patterns:
    - "matchFont({fontFamily, fontSize}) resolves an already-loaded expo-google-fonts family through Skia's system font manager for on-canvas axis labels, guarded with try/catch so a resolution failure degrades to no labels rather than throwing"
    - "TrendChartPoint carries an explicit `[key: string]: number | string` index signature so it satisfies victory-native's `RawData extends Record<string, unknown>` CartesianChart generic constraint -- without it, xKey/yKeys/chartPressState/points all silently collapse to never/{}"
    - "Module-scoped lastAnimatedHssDate/lastAnimatedHssValue pair implements D-05's animate-once-per-day gate without a new Zustand store or AsyncStorage dependency (resets on app relaunch, stable across screen focus/blur within a launch)"

key-files:
  created:
    - apps/mobile/components/home/TrendChart.tsx
    - apps/mobile/components/home/TodayBreakdownSheet.tsx
  modified:
    - apps/mobile/app/(tabs)/index.tsx

key-decisions:
  - "TrendChart's calibrating caption is data-availability-driven (historyDays < 14, independent variable) while HssRing's calibrating variant stays readiness-algorithm-driven (persisted band === 'calibrating') -- these usually agree but can diverge in a rare low-CTL-floor edge case, so they're computed as two separate values in index.tsx rather than one shared boolean"
  - "Today's session row 'title' (Archivo_500Medium, bone) is the capitalized workout/activity type (Strength/Hybrid/Run/Erg/Conditioning) -- distinct from the mono metadata line, which carries the literal D-23 example format (dominant body part + lift count + avg RPE for lifts; distance/pace/duration for runs). 04-UI-SPEC.md's exact metadata-line example ('LOWER · 6 LIFTS · RPE 8') is reproduced verbatim as the metadata line; the separate row title above it was left as an open Claude's-Discretion gap in the spec and resolved this way"
  - "Dominant body part per lift session is the most-frequent exercise.bodyPart across that workout's committed strength_set rows (mode, ties broken by first-seen); 'N LIFTS' counts distinct exerciseIds, not total sets"
  - "formatEnduranceMeta/formatCompactDuration are duplicated locally in index.tsx rather than extracted to a shared lib -- app/session/finish.tsx (which has the original formatEnduranceSummary) is outside this plan's declared file scope"
  - "Day Total in TodayBreakdownSheet uses the persisted load_daily.dayHss (authoritative) rather than a local re-sum, matching HSSBreakdownSheet's 'never drifts from what the ring shows' precedent; only the +Y double-day delta is computed live via @apsis/engine's dailyHSS"

requirements-completed: [HOME-01, HOME-02, HOME-03, HOME-04]

coverage:
  - id: D1
    description: "TrendChart renders victory-native CartesianChart + useChartPressState with ATL (bone) / CTL (ash) lines over persisted load_daily points, steel horizontal-only gridlines, sparse mono x-axis labels, and a scrub hairline cursor + tooltip (MON DD / HSS / ATL / CTL / signed TSB)"
    requirement: "HOME-03"
    verification:
      - kind: unit
        ref: "grep useChartPressState/CartesianChart in components/home/TrendChart.tsx (task 1 automated verify); confirmed no Colors.dark.accent (volt) reference anywhere in the file"
        status: pass
    human_judgment: true
    rationale: "Scrub-gesture correctness, cursor tracking, tooltip positioning, and Skia font resolution (matchFont) all require on-device rendering to confirm -- this plan's own <verification> section defers to phase UAT gate. Windows dev host cannot run the iOS build to observe the chart live."
  - id: D2
    description: "TrendChart's calibrating state renders whatever real load_daily days exist (never a fake line) plus a shared BUILDING TREND / DAY N/14 caption matching HssRing's calibrating label string"
    requirement: "HOME-04"
    verification:
      - kind: unit
        ref: "calibratingCaption() exported and reused verbatim between TrendChart.tsx and index.tsx's chartCalibratingDayN prop wiring"
        status: pass
    human_judgment: true
    rationale: "Visual confirmation that the caption and partial-data chart render correctly together requires on-device UAT, deferred per this plan's <verification> section."
  - id: D3
    description: "app/(tabs)/index.tsx TODAY dashboard: useFocusEffect-driven load of today's load_daily row, last 28 rows, and today's sessions; D-17 scroll order (greeting -> ring -> readiness -> tiles -> chart -> sessions); D-06 empty state (ring at 0, readiness light live, two ghost shortcuts) when no session logged today"
    requirement: "HOME-01"
    verification:
      - kind: unit
        ref: "grep useFocusEffect/last28DaysTrend/HssRing present + absence of bare useEffect( in app/(tabs)/index.tsx (task 2 automated verify)"
        status: pass
    human_judgment: true
    rationale: "Correct visual scroll order, ring animation gating, and empty/calibrating state rendering require on-device confirmation -- deferred to phase UAT per this plan's <verification> section."
  - id: D4
    description: "Today's session rows (title + mono metadata + bone HSS) render under a TODAY · N SESSION(S) header; tapping the ring opens TodayBreakdownSheet showing per-session HSS + Day Total + the D-26 double-day math via @apsis/engine's dailyHSS"
    requirement: "HOME-02"
    verification:
      - kind: unit
        ref: "test -f components/home/TodayBreakdownSheet.tsx && grep dailyHSS/DOUBLE-DAY in it (task 3 automated verify)"
        status: pass
    human_judgment: true
    rationale: "Correct per-session metadata formatting and double-day math values for a real multi-session day require on-device confirmation -- deferred to phase UAT gate."

duration: ~35min
completed: 2026-07-10
status: complete
---

# Phase 04 Plan 07: TODAY Dashboard Summary

**Full TODAY dashboard (200px HSS ring, readiness light, ATL/CTL/TSB tiles, first victory-native chart in the codebase with a Skia scrub tooltip, and today's session list) replacing the Phase 4 placeholder Home tab, all reading persisted load_daily/workout output.**

## Performance

- **Duration:** ~35 min
- **Completed:** 2026-07-10
- **Tasks:** 3
- **Files modified:** 3 (2 created, 1 modified)

## Accomplishments

- `TrendChart.tsx`: the codebase's first `victory-native` consumer -- `CartesianChart` + `useChartPressState` render ATL (bone) and CTL (ash) lines over the last 28 persisted `load_daily` points, steel horizontal-only gridlines (no vertical gridlines, D-18), sparse `matchFont`-rendered mono x-axis labels every ~7th day, and a scrub interaction (Skia hairline cursor + floating tooltip showing `{MON DD} · HSS N · ATL N · CTL N · TSB ±N`, D-19/D-20). TSB is never drawn as a line. The calibrating state (D-22) renders whatever real days exist plus a `BUILDING TREND · DAY N/14` caption shared verbatim with `HssRing`'s own calibrating label via an exported `calibratingCaption()` helper.
- `app/(tabs)/index.tsx`: the placeholder replaced with the full TODAY dashboard. A single `useFocusEffect`-gated load (never a bare `useEffect`, Pitfall 5) reads today's `load_daily` row, the last 28 rows (reversed to chronological), and today's finished sessions on every screen focus. The D-17 scroll order (mono timestamp + "LET'S WORK" -> 200px `HssRing` -> `ReadinessLight` -> `StatTiles` -> `TrendChart` -> today's sessions) is implemented exactly. Readiness/ATL/CTL/TSB fall back from today's row to the most recent persisted row so readiness is never blank before today's first session (D-06). The D-06 empty state (ring at 0, readiness light still live from history, two ghost non-volt shortcuts "Start Workout"/"Log Run") renders whenever no session has been logged today.
- Today's session rows: Archivo_500Medium bone title (capitalized activity type) + mono ash metadata line (dominant body part/lift count/avg RPE for lifts, matching the literal D-23 example format; distance/pace/duration for runs, mirroring `finish.tsx`'s endurance summary conventions) + bone (never volt) right-aligned HSS, under a `TODAY · N SESSION(S)` header. Tapping a row wires navigation to `/session/detail` (the screen itself ships in 04-08).
- `TodayBreakdownSheet.tsx`: adapts `HSSBreakdownSheet.tsx`'s per-exercise pattern to per-session rows, wired to the ring's `onPress` (D-24). Shows each session's HSS, an authoritative Day Total (the persisted `load_daily.dayHss`, never a local re-sum), and -- when 2+ sessions were logged -- the honest `INCL. +Y DOUBLE-DAY LOAD` line computed via `@apsis/engine`'s `dailyHSS` (never a hand-rolled multiplier).
- D-05's animate-once-per-day ring gate implemented as a module-scoped date/value pair in `index.tsx` (no new Zustand store or AsyncStorage dependency).

## Task Commits

1. **Task 1: TrendChart victory-native scrub chart** - `60d66c1` (feat)
2. **Task 2 + 3: TODAY dashboard scaffold + today's sessions + breakdown sheet** - `be1cbdf` (feat)

_Task 2 and Task 3 were committed together: both are scoped to the same `app/(tabs)/index.tsx` file and are functionally interdependent (the session-row list and ring-tap sheet consume the same data-load scaffold), so splitting them into two commits would have required an artificial mid-file checkpoint with no independent verification value._

**Plan metadata:** (pending -- this commit)

## Files Created/Modified

- `apps/mobile/components/home/TrendChart.tsx` - victory-native 28-day ATL/CTL scrub-tooltip chart, calibrating caption
- `apps/mobile/components/home/TodayBreakdownSheet.tsx` - per-session ring-tap breakdown sheet with D-26 double-day math
- `apps/mobile/app/(tabs)/index.tsx` - full TODAY dashboard: data load, hero/tiles/chart composition, empty state, today's session rows, breakdown-sheet wiring

## Decisions Made

- `TrendChartPoint` carries an explicit `[key: string]: number | string` index signature -- without it, TypeScript can't satisfy victory-native's `RawData extends Record<string, unknown>` `CartesianChart` generic constraint, and `xKey`/`yKeys`/`chartPressState`/`points.atl`/`points.ctl` all silently collapse to `never`/`{}` (caught by `pnpm run typecheck`, fixed before committing).
- `matchFont({fontFamily: 'JetBrainsMono_500Medium', fontSize: 9})` resolves the chart's x-axis labels through Skia's system font manager (same already-loaded expo-google-fonts family RN `<Text>` uses elsewhere), guarded in a try/catch so a resolution failure degrades gracefully to no axis labels rather than throwing.
- The chart's calibrating caption is driven by real data-availability (`historyDays < 14`), while the ring's calibrating variant stays driven by the persisted `readinessBand === 'calibrating'` -- computed as two separate values in `index.tsx` since they can theoretically diverge in a rare low-CTL-floor edge case (historyDays >= 14 but still calibrating due to `calibratingCtlFloor`).
- Today's session row "title" (bone, Archivo_500Medium) is the capitalized workout/activity type (Strength/Hybrid/Run/Erg/Conditioning); the mono metadata line beneath it reproduces 04-UI-SPEC.md's literal example format verbatim ("LOWER · 6 LIFTS · RPE 8" / "6.2 KM · 5:30 /KM · 142 BPM"). The spec described the metadata line's exact content but left the separate row title unspecified ("exercise/activity title" with no example) -- resolved as the capitalized type label.
- Dominant body part per lift session = the most-frequent `exercise.bodyPart` (mode) across that session's committed `strength_set` rows; "N LIFTS" = distinct `exerciseId` count, not total set count.
- `formatEnduranceMeta`/`formatCompactDuration` are duplicated locally in `index.tsx` rather than extracted into a shared lib, since the original `formatEnduranceSummary` lives in `app/session/finish.tsx`, which is outside this plan's declared `files_modified` scope.

## Deviations from Plan

None - plan executed as written, aside from the Task 2/3 commit-grouping practicality noted above (not a scope deviation, just a commit-boundary choice given the shared file).

## Issues Encountered

- Initial `TrendChartPoint` interface (no index signature) failed `pnpm run typecheck` with victory-native's `CartesianChart` generic overloads collapsing to `never`/`{}` for `xKey`/`yKeys`/`points`. Fixed by adding an explicit `[key: string]: number | string` index signature (Rule 1 -- caught and fixed before the task commit, not a separate deviation commit).
- Referencing `/session/detail` (built in 04-08, not yet on disk) introduces one new, expected `pnpm run typecheck` error (`Type '"/session/detail"' is not assignable to...`), alongside the two pre-existing `router.push` typed-route errors already logged in STATE.md/03 deferred-items.md (`app/onboarding/review.tsx`, `components/ExternalLink.tsx`). This is anticipated by the plan's own Task 3 instruction ("wire the navigation now" ahead of the screen's build) and will resolve automatically once 04-08 adds `app/session/detail.tsx` and expo-router's generated route types include it.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `app/(tabs)/index.tsx` now composes all four 04-04 home components (`HssRing`, `ReadinessLight`, `StatTiles`) plus this plan's `TrendChart`/`TodayBreakdownSheet` against real persisted data -- Phase 4's core "make the engine's output visible" value is now on-screen.
- 04-08 can build `app/session/detail.tsx` and the `/session/detail` navigation wired here will resolve immediately (both the runtime `router.push` call and the expo-router typed-route gap).
- On-device UAT is required before Phase 04 is marked complete, per this plan's own `<verification>` section: ring animate-once-per-day behavior, scrub-tooltip gesture tracking and Skia font rendering, calibrating-hero visual correctness before 14 days of data, and the empty-state ghost shortcuts before today's first session. None of this is verifiable from the Windows dev host used for this plan's execution.
- `pnpm run typecheck` is clean except the two pre-existing errors (unchanged) and the one new, expected `/session/detail` gap described above, which 04-08 resolves.

---
*Phase: 04-run-logger-home-dashboard*
*Completed: 2026-07-10*

## Self-Check: PASSED

All 3 created/modified files confirmed present on disk; both task commit hashes (`60d66c1`, `be1cbdf`) confirmed in git log.
