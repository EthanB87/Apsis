---
phase: 05-healthkit-integration
plan: 09
subsystem: healthkit
tags: [healthkit, ui, dedupe, import-notice, run-form, today-dashboard]

requires:
  - phase: 05-healthkit-integration (05-05)
    provides: "runHealthKitSync + useForegroundHealthKitSync/useHealthKitImportSignal (last-import count/timestamp signal)"
  - phase: 05-healthkit-integration (05-03)
    provides: "isDuplicateOfExisting/DUPE_TOLERANCE pure dedupe comparator (healthkitMapping.ts)"
provides:
  - "D-09 soft, non-blocking dedupe hint on the run entry form warning when the selected date already has a similar imported session"
  - "D-10 transient TODAY notice explaining a just-completed foreground HealthKit import, silent when nothing new arrived"
affects: []

tech-stack:
  added: []
  patterns:
    - "Reused the import pipeline's own isDuplicateOfExisting/DUPE_TOLERANCE comparator in a UI-side effect rather than introducing a second tolerance constant"
    - "Module-scoped 'last shown batch' gate (mirrors index.tsx's existing lastAnimatedHssDate/lastAnimatedHssValue animate-once pattern), keyed on the import signal's syncedAt timestamp instead of a dedicated batch-id field"
    - "getState() (not the reactive zustand hook) read once per useFocusEffect so a UI notice is captured statically for that focus and doesn't flicker if the store updates again before the user navigates away"

key-files:
  created: []
  modified:
    - apps/mobile/app/(tabs)/log/run.tsx
    - apps/mobile/app/(tabs)/index.tsx

key-decisions:
  - "candidatesForDedupe's returned healthkitUuid field (non-null only for source==='healthkit' rows) is used to filter candidates to imported sessions, instead of modifying the query builder to also select `source` -- queries.ts was not in this plan's declared files_modified, and healthkitUuid non-null is exactly equivalent to source==='healthkit' for this table (only HK imports ever set it)"
  - "TODAY's import-notice batch id is the import signal's syncedAt timestamp (Date.getTime()), not a new dedicated batch-id field on useHealthKitImportSignal -- each completed foreground sync produces a distinct syncedAt, making it a sufficient, zero-new-surface batch key"
  - "The dedupe-hint effect skips the query entirely when durationS === 0 (no duration entered yet) rather than running a query that could spuriously match a zero-duration candidate"

requirements-completed: [HK-03]

coverage:
  - id: D9
    description: "Run form renders a soft amber warningLabel hint beneath the Date row, reusing D-06's isDuplicateOfExisting/DUPE_TOLERANCE comparator, when the selected localDate + activityType already has an imported (healthkitUuid != null) session of similar duration; Save stays enabled regardless"
    requirement: HK-03
    verification:
      - kind: other
        ref: "grep -q 'saving will count both' 'app/(tabs)/log/run.tsx' -- passed"
        status: pass
    human_judgment: true
    rationale: "The hint's query/comparator logic is grep-verified and typecheck/vitest-clean; observing the hint actually appear against a real imported session requires the pending EAS dev build + physical device (Pitfall 6, same blocker tracked since 05-01/05-05)."
  - id: D10
    description: "TODAY renders 'IMPORTED {N} SESSION{S} FROM APPLE HEALTH' beneath the greeting, above the ring, exactly once per completed import batch (keyed on useHealthKitImportSignal's syncedAt), silent when zero sessions were imported"
    requirement: HK-03
    verification:
      - kind: other
        ref: "grep -q 'FROM APPLE HEALTH' 'app/(tabs)/index.tsx' -- passed"
        status: pass
    human_judgment: true
    rationale: "The notice's signal-read/gate logic is grep-verified and typecheck/vitest-clean; observing an actual foreground-triggered notice against a real import batch requires the pending EAS dev build + physical device (Pitfall 6)."

duration: ~12min
completed: 2026-07-11
status: complete
---

# Phase 05 Plan 09: HealthKit Reactive UI Feedback Summary

**Soft amber dedupe hint on the run form (D-09) and a transient mono "IMPORTED N SESSIONS FROM APPLE HEALTH" notice on TODAY (D-10), both reusing existing pipeline logic/signals rather than introducing new tolerance constants or persisted dismissal state.**

## Performance

- **Duration:** ~12 min
- **Started:** 2026-07-11T23:44:00Z
- **Completed:** 2026-07-11T23:56:00Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- `run.tsx`: a `localDate`/`activityType`/`durationS`-keyed effect calls `candidatesForDedupe` (filtered to `healthkitUuid != null` -- imported rows), reuses `isDuplicateOfExisting`/`DUPE_TOLERANCE` from `healthkitMapping.ts` (no second tolerance constant), and renders the exact copy "An imported run already covers this — saving will count both." beneath the Date row using the pre-existing `warningLabel` style. Save's enabled/disabled logic (`saveDisabled = saving || durationS === 0`) is untouched.
- `index.tsx`: a second `useFocusEffect` reads `useHealthKitImportSignal.getState()` once per fresh focus and renders "IMPORTED {N} SESSION{S} FROM APPLE HEALTH" (singular/plural) via a new `Mono`/ash `importNotice` style beneath the "LET'S WORK" greeting and above the `HssRing`. A module-scoped `lastShownImportBatchAt` (mirrors the file's existing `lastAnimatedHssDate`/`lastAnimatedHssValue` animate-once gate), keyed on the import signal's `syncedAt` timestamp, ensures the notice shows exactly once per completed sync batch and disappears the next time the screen is freshly focused. Renders nothing when the last sync imported zero sessions.

## Task Commits

Each task was committed atomically:

1. **Task 1: Soft dedupe hint on the run form (D-09)** — `fa1beac` (feat)
2. **Task 2: Transient TODAY import notice (D-10)** — `5baa358` (feat)

**Plan metadata:** (this commit)

## Files Created/Modified
- `apps/mobile/app/(tabs)/log/run.tsx` — D-09 dedupe-check effect + amber hint beneath the Date row
- `apps/mobile/app/(tabs)/index.tsx` — D-10 import-signal read + transient mono notice above the ring

## Decisions Made
- Filtered `candidatesForDedupe`'s results to `healthkitUuid != null` (a field it already returns) instead of modifying the query builder to also select `source` — `packages/db/src/queries.ts` was not in this plan's declared `files_modified`, and `healthkitUuid` is non-null exclusively for `source === 'healthkit'` rows in this schema (confirmed against `schema.ts` and `healthkitImport.ts`'s own insert, which always sets both together).
- Used the import signal's existing `syncedAt` timestamp as the "batch id" for the show-once gate rather than adding a dedicated batch-id field to `useHealthKitImportSignal` — each completed sync produces a distinct `syncedAt`, so no new store surface was needed to satisfy D-10's presentation lifecycle.
- Read the import signal via `useHealthKitImportSignal.getState()` inside `useFocusEffect` (not the reactive hook subscription) so the notice text is captured once per focus and can't flicker or reappear if the store updates again while the screen stays mounted but unfocused-then-refocused with the same batch.

## Deviations from Plan

None - plan executed exactly as written. Both tasks' automated grep verification commands passed on first implementation, root `pnpm run typecheck` showed only the two pre-existing deferred errors (`app/onboarding/review.tsx`, `components/ExternalLink.tsx`, tracked in STATE.md/03 deferred-items.md), and `pnpm vitest run` stayed green at 30/30 (unchanged — this plan added no new pure-logic surface requiring its own unit tests; both changes are UI-effect code whose end-to-end behavior is manual-only per 05-RESEARCH.md's validation architecture, same as 05-05/05-06).

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required. On-device verification of the actual hint/notice appearing against real imported data (HK-03's UI-facing behaviors) remains blocked on the pending EAS dev build (provisioning-profile fix, tracked against 05-01's in-flight checkpoint) and requires a physical device (Simulator has minimal Health data, Pitfall 6) — neither is new to this plan.

## Next Phase Readiness
- This is the last of the 05-CONTEXT.md-locked UI touch-points (D-08 chip, D-09 hint, D-10 notice) to ship code; phase UAT will need to exercise all three plus HK-01/02/03's underlying import/write-back/dedupe behavior together once the EAS dev build is available.
- No gaps: both tasks' `<done>` criteria are met by inspection/grep/typecheck/vitest per this plan's own declared verification scope.

---
*Phase: 05-healthkit-integration*
*Completed: 2026-07-11*

## Self-Check: PASSED

All modified files verified present on disk; commits fa1beac and 5baa358 verified present in git log.
