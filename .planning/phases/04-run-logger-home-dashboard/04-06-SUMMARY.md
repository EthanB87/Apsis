---
phase: 04-run-logger-home-dashboard
plan: 06
subsystem: ui
tags: [react-native, react-native-svg, drizzle, hss-engine, finish-screen]

requires:
  - phase: 04-04
    provides: HssRing.tsx (shared 200px home / 84px finish mini ring component)
  - phase: 04-05
    provides: runEntry.ts saveRun (endurance_segment persistence, resolveRunSegment IF resolution)
provides:
  - "app/session/finish.tsx retrofit: branches summary-fetch on workout.type, endurance path
    queries endurance_segment + computes session HSS via sessionHSSDetailed, shared 84px
    HssRing mini-ring replaces the bare HSS number, Done/Discard route to TODAY"
affects: [04-07 (TODAY screen, consumes the same '/(tabs)' route as the finish-screen Done target)]

tech-stack:
  added: []
  patterns:
    - "finish.tsx queries workout.type first, then branches the summary-fetch effect: strength/hybrid keeps the existing strengthSet path, endurance queries endurance_segment and re-derives HSS from SQLite rows (never a store)"
    - "One shared HssRing component instance renders both the 200px home hero and the 84px finish mini-ring (size-driven branch inside HssRing itself, no new props needed here)"

key-files:
  created: []
  modified:
    - apps/mobile/app/session/finish.tsx

key-decisions:
  - "Endurance segment rows map directly to sessionHSSDetailed's EnduranceSegment input via durationS + intensityFactor already persisted by runEntry.ts's saveRun — no IF re-resolution needed on the finish screen"
  - "Session HSS mini-ring passes a hardcoded non-calibrating band ('green') since a single-session ring never carries readiness-band semantics — only RING_FILL_REFERENCE_HSS-capped fill + the exact rounded number matter here"
  - "Endurance summary line format is built by a new local formatEnduranceSummary helper (run/erg: distance+pace+duration; conditioning: duration+HR only), reusing @apsis/shared's formatPaceMinSec/kmToDisplayMi/paceSecPerKmToSecPerMi rather than duplicating unit-conversion math"

requirements-completed: [RUN-06]

coverage:
  - id: D1
    description: "finish.tsx branches on workout.type: strength/hybrid keeps the existing per-exercise summary path unchanged; endurance queries endurance_segment and computes session HSS via sessionHSSDetailed over the segment rows (durationS + intensityFactor)"
    requirement: "RUN-06"
    verification:
      - kind: unit
        ref: "grep enduranceSegment in app/session/finish.tsx (task 1 automated verify) — confirms the endurance query path and sessionHSSDetailed(enduranceSegments) call exist"
        status: pass
    human_judgment: true
    rationale: "Correct HSS value and summary-line rendering for a real endurance workout requires on-device UAT (per this plan's own <verification> section) — the grep only proves the code path exists, not that it renders the right number/text for a real saved run."
  - id: D2
    description: "Both lift and run finish screens show the shared 84px HssRing mini-ring counting up the session HSS (D-04), replacing the bare Typography.display number"
    requirement: "RUN-06"
    verification:
      - kind: unit
        ref: "grep HssRing + size={84} in app/session/finish.tsx (task 2 automated verify)"
        status: pass
    human_judgment: true
    rationale: "Ring animation, volt-arc rendering, and count-up correctness require on-device confirmation per the plan's <verification> section (phase UAT gate) — grep only proves the component is wired in."
  - id: D3
    description: "Done and Discard route to the TODAY tab ('/(tabs)') instead of '/(tabs)/log'"
    requirement: "RUN-06"
    verification:
      - kind: unit
        ref: "grep \"router.replace('/(tabs)')\" in app/session/finish.tsx"
        status: pass
    human_judgment: false

duration: ~15min
completed: 2026-07-10
status: complete
---

# Phase 04 Plan 06: Finish Screen Retrofit Summary

**Retrofitted the existing lift-only finish.tsx to branch on workout.type, computing and rendering an endurance session's HSS/summary from endurance_segment rows and replacing the bare HSS number with the shared 84px HssRing mini-ring; Done/Discard now route to TODAY.**

## Performance

- **Duration:** ~15 min
- **Tasks:** 2
- **Files modified:** 1

## Accomplishments
- `finish.tsx`'s summary-fetch effect now reads `workout.type` first: `strength`/`hybrid` sessions keep the exact existing `strengthSet`/`exercise` query and per-exercise summary rendering untouched; `endurance` sessions query `endurance_segment` rows and compute the session HSS via `sessionHSSDetailed({ enduranceSegments: [...] })`, mapping each row's persisted `durationS` + `intensityFactor` straight through (no re-derivation of IF — that was already resolved and stored at save time by `runEntry.ts`'s `saveRun`).
- New `formatEnduranceSummary` helper builds the per-type summary line per 04-UI-SPEC.md section 8: run/erg render `"{DISTANCE} · {PACE} · {DURATION}"` (KM or MI per profile units for run, M/500M-pace for erg); conditioning renders `"{DURATION} · {AVG HR} BPM"` only (D-16, no distance/pace concept). Distance/pace conversions reuse `@apsis/shared`'s `kmToDisplayMi`/`paceSecPerKmToSecPerMi`/`formatPaceMinSec` rather than duplicating unit math.
- The bare `Typography.display` (40px) HSS number is replaced by the shared `HssRing` component at `size={84}` (D-04), passed `hss={hss ?? 0}`, a hardcoded non-calibrating `band="green"` (a single-session ring never carries readiness-band semantics), and `animate` always true — finish screens are a one-time view, so D-05's once-per-day gate doesn't apply here.
- `handleDone` and `handleConfirmDiscard` now `router.replace('/(tabs)')` (TODAY) instead of `'/(tabs)/log'`, per D-07's Home→TODAY rename — this is now the natural landing point after either a lift or a run.
- Re-derive-from-SQLite invariant preserved exactly: the endurance branch never reads from `sessionStore` or any other in-memory store, matching the screen's documented D-14 crash-resume contract.
- Warnings section and the "•••" Discard menu chrome are unchanged, as required.

## Task Commits

1. **Task 1: Branch finish summary on workout.type + endurance HSS/summary** - `efe3863` (feat)
2. **Task 2: 84px mini-ring + Done-to-TODAY routing** - `ee8d1b8` (feat)

**Plan metadata:** (pending — this commit)

## Files Created/Modified
- `apps/mobile/app/session/finish.tsx` - branched summary-fetch on `workout.type` (strength/hybrid unchanged, new endurance path via `endurance_segment` + `sessionHSSDetailed`), added `formatSessionDuration`/`formatEnduranceSummary` local helpers, replaced the bare HSS `Text` with the shared 84px `HssRing`, changed `handleDone`/`handleConfirmDiscard` routing target from `/(tabs)/log` to `/(tabs)`

## Decisions Made
- Endurance segment rows feed `sessionHSSDetailed` directly via `durationS` + `intensityFactor` (both already persisted by `saveRun`) — no IF re-resolution logic duplicated on the finish screen, keeping this a pure re-derive-from-SQLite read.
- Session HSS mini-ring always passes a hardcoded `band="green"` (non-calibrating) since a single-session ring has no readiness-band concept — only the `RING_FILL_REFERENCE_HSS`-capped arc and the exact rounded number are meaningful here.
- Removed the now-unused `styles.hss`/`tabularNums` import in favor of a `ringWrapper` spacing wrapper around the new `HssRing`, keeping the file lint-clean rather than leaving a dead style behind.

## Deviations from Plan

None - plan executed exactly as written. Both tasks' acceptance criteria (workout.type branch, endurance_segment query, per-type summary line, 84px HssRing, TODAY routing, unchanged warnings/discard chrome) match verbatim.

## Issues Encountered

None. `pnpm run typecheck` shows zero new errors from `finish.tsx` — only the two pre-existing `router.push` typed-route errors (`app/onboarding/review.tsx`, `components/ExternalLink.tsx`) already logged in STATE.md/03 deferred-items.md remain, unchanged by this plan.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Both activity families now share one finish flow with the 84px mini-ring and TODAY routing — 04-07 (TODAY screen) can rely on `/(tabs)` being the landing route after either a lift or a run.
- On-device UAT for the endurance HSS value/summary-line correctness and the mini-ring's count-up/volt-arc rendering is explicitly deferred to the phase gate per this plan's own `<verification>` section — not a blocker for handing off, but should be confirmed before Phase 04 is marked complete.

---
*Phase: 04-run-logger-home-dashboard*
*Completed: 2026-07-10*

## Self-Check: PASSED

`apps/mobile/app/session/finish.tsx` confirmed present on disk with both task edits; commit hashes `efe3863` and `ee8d1b8` confirmed in `git log`.
