---
phase: 05-healthkit-integration
plan: 06
subsystem: healthkit
tags: [healthkit, drizzle, fire-and-forget, write-back]

requires:
  - phase: 05-healthkit-integration (05-03)
    provides: "buildHSSMetadata/HSS_METADATA_KEY (D-13 metadata builder) and getSyncState/setSyncState (drizzle-backed sync-state accessors)"
provides:
  - "healthkitWriteback.ts: writeBackRun/writeBackLift (saveWorkoutSample tail calls, raw-meters distance, ApsisHSS-only metadata) and deleteHealthKitSample (deleteObjects delete-sync)"
  - "saveRun/finishWorkout fire-and-forget HealthKit write-back tails storing the returned sample uuid on the workout row"
  - "discardWorkout delete-sync tail restricted to source==='manual' && healthkitUuid != null rows"
affects: [05-07 (onboarding/settings UI wiring the connect toggle that gates these tails), 05-09 (TODAY import notice — unaffected by this plan but shares the sync-state module)]

tech-stack:
  added: []
  patterns:
    - "The ONE place in the codebase where a caught error is deliberately swallowed, not re-thrown (healthkitWriteback.ts's three helpers) — contrasts with saveRun/recomputeLoadDaily's log-then-rethrow convention"
    - "Fire-and-forget tail via .then()/.catch() appended after a function's own try/catch-and-rethrow block has already completed, so the tail's own failure can never affect the caller's return value or thrown error"

key-files:
  created:
    - apps/mobile/lib/healthkitWriteback.ts
  modified:
    - apps/mobile/lib/runEntry.ts
    - apps/mobile/lib/finishWorkout.ts

key-decisions:
  - "runEntry.ts's HK write-back startedAt is back-computed as finishedAt - durationS*1000, since endurance sessions are complete-on-save (RESEARCH D-13) and carry no separate begin timestamp on the workout/endurance_segment rows"
  - "finishWorkout.ts's HK write-back duration is computed from workout.createdAt (session start, set at insert) to the caller-supplied finishedAt, rather than adding a new column — matches the existing schema's only two session-boundary timestamps"
  - "Both write-back tails are gated by a single getSyncState(database) read placed after recomputeLoadDaily has already succeeded, so a slow/failed sync-state read can never delay or fail the local save/finish path itself (D-25 layered on top of D-12)"
  - "discardWorkout reads workout.source/healthkitUuid via a SELECT before the soft-delete UPDATE runs, since the row's source can no longer be trivially distinguished from an imported row's `null` source default after other columns change (defensive ordering, not a behavior requirement)"

requirements-completed: [HK-04]

coverage:
  - id: D1
    description: "healthkitWriteback.ts's writeBackRun/writeBackLift pass distanceM as raw meters (no km/mi conversion, Pitfall 4) and attach only the ApsisHSS metadata key with no calorie/energy field (D-13); every native call is wrapped and never rethrows"
    requirement: HK-04
    verification:
      - kind: other
        ref: "grep -q saveWorkoutSample lib/healthkitWriteback.ts && grep -q deleteObjects lib/healthkitWriteback.ts"
        status: pass
    human_judgment: true
    rationale: "The payload shape (raw meters, ApsisHSS-only metadata, no calories) is verifiable by code review and the grep above, but confirming the write actually appears correctly in the Health app requires a physical device (05-RESEARCH.md Pitfall 6) and is blocked on the pending EAS dev build (05-01's in-flight checkpoint)."
  - id: D2
    description: "saveRun and finishWorkout fire a fire-and-forget write-back tail after a successful save/finish, gated on healthkitConnected, and store the returned uuid on the workout row without any possibility of failing the local save/finish (D-12/D-25)"
    verification:
      - kind: other
        ref: "grep -q writeBackRun lib/runEntry.ts && grep -q writeBackLift lib/finishWorkout.ts"
        status: pass
    human_judgment: true
    rationale: "Gating/never-block logic is verifiable by code review (the tail is appended after the function's own try/catch block completes, via .then/.catch, never awaited into the outer catch); confirming a real Health-app write with the correct HSS metadata requires a physical device and the pending EAS dev build."
  - id: D3
    description: "discardWorkout deletes the HK sample ONLY when source==='manual' && healthkitUuid != null — never for an imported (source==='healthkit') row's healthkitUuid"
    requirement: HK-04
    verification:
      - kind: other
        ref: "grep -q deleteHealthKitSample lib/finishWorkout.ts"
        status: pass
    human_judgment: true
    rationale: "The source==='manual' guard is verifiable by code review; confirming an actual Health-app deletion occurs (and that an imported sample survives a discard) requires a physical device and the pending EAS dev build."

duration: ~12min
completed: 2026-07-11
status: complete
---

# Phase 05 Plan 06: HealthKit Write-Back Engine Summary

**`healthkitWriteback.ts` (writeBackRun/writeBackLift/deleteHealthKitSample) plus fire-and-forget write-back tails on `saveRun`/`finishWorkout` and a source-gated delete-sync tail on `discardWorkout` — Apsis sessions now write to Apple Health on save/finish and clean up on discard, without ever blocking the local write.**

## Performance

- **Duration:** ~12 min
- **Started:** 2026-07-11T23:28:21Z
- **Completed:** 2026-07-11T23:33:56Z
- **Tasks:** 2
- **Files modified:** 3 (1 created, 2 modified)

## Accomplishments
- `healthkitWriteback.ts`: `writeBackRun`/`writeBackLift` call `saveWorkoutSample` with an empty `quantities: []` array, raw-meters `totals.distance` (Pitfall 4 — no km/mi conversion helper in the path), and `buildHSSMetadata(hss)` as the sole metadata payload (D-13, no calorie/energy field anywhere); `deleteHealthKitSample` calls `deleteObjects(WorkoutTypeIdentifier, { uuid })` (D-14). All three helpers wrap their native call in try/catch, log the caught `Error` object only (T-05-01), and never rethrow — the one deliberate swallow-not-rethrow location in the codebase, called out explicitly in the file header.
- `saveRun` (runEntry.ts): after `recomputeLoadDaily` succeeds, reads `getSyncState`; if `healthkitConnected`, fires `writeBackRun` with a back-computed `startedAt` (`finishedAt - durationS`, since endurance sessions are complete-on-save) and stores the returned uuid on the workout row via a `.then()/.catch()` tail that can never affect `saveRun`'s own return value or its outer try/catch.
- `finishWorkout` (finishWorkout.ts): after `recomputeLoadDaily` succeeds, reads `getSyncState`; if connected, reads the workout's `createdAt`/`hss`, computes `durationS` from `createdAt` to the caller-supplied `finishedAt`, fires `writeBackLift`, and stores the returned uuid the same fire-and-forget way.
- `discardWorkout` (finishWorkout.ts): reads the row's `source`/`healthkitUuid` before the soft-delete, then — only when `source === 'manual' && healthkitUuid != null` — fires `deleteHealthKitSample` fire-and-forget. An imported (`source === 'healthkit'`) row's `healthkitUuid` is never touched.

## Task Commits

Each task was committed atomically:

1. **Task 1: healthkitWriteback.ts — writeBackRun/writeBackLift/deleteHealthKitSample** — `ae5682a` (feat)
2. **Task 2: Wire write-back into saveRun + finishWorkout; delete-sync into discardWorkout** — `e1b3317` (feat)

**Plan metadata:** (this commit)

## Files Created/Modified
- `apps/mobile/lib/healthkitWriteback.ts` — `writeBackRun`, `writeBackLift`, `deleteHealthKitSample`
- `apps/mobile/lib/runEntry.ts` — `saveRun` extended with a fire-and-forget write-back tail
- `apps/mobile/lib/finishWorkout.ts` — `finishWorkout` extended with a write-back tail; `discardWorkout` extended with a source-gated delete-sync tail

## Decisions Made
- `startedAt` for a run write-back is back-computed as `finishedAt - durationS*1000` since `saveRun` never persists a separate session-begin timestamp — the endurance session row is written complete-on-save (RESEARCH D-13).
- `durationS` for a lift write-back is computed from the existing `workout.createdAt` (set at insert, i.e. session start) to the caller-supplied `finishedAt` — no new column was needed since these are the only two session-boundary timestamps already on the schema.
- Both write-back gates (`getSyncState`) are placed strictly after `recomputeLoadDaily` has already succeeded in each function, so a slow or failed sync-state read can never delay or fail the primary local write path (D-25 applied on top of D-12, not just at the native-call boundary).
- `discardWorkout`'s `source`/`healthkitUuid` SELECT runs before the soft-delete UPDATE, matching the RESEARCH Code Examples' verified ordering exactly.

## Deviations from Plan

None - plan executed exactly as written. Both tasks' grep-based automated verification commands passed on first implementation; root `pnpm run typecheck` introduced no new errors (only the two pre-existing deferred errors already tracked in STATE.md/03-deferred-items.md remain); `pnpm vitest run` in `apps/mobile` stayed green at 30/30 (this plan added no new pure-logic surface requiring its own unit tests — `healthkitWriteback.ts` is impure I/O code whose behavior is manual-only per 05-RESEARCH.md's validation architecture, same class as 05-05's `healthkitImport.ts`/`useForegroundHealthKitSync.ts`).

## Issues Encountered
None. Library API surface (`saveWorkoutSample`'s signature, `WorkoutProxy.uuid`, `deleteObjects`'s `FilterForSamplesBase.uuid` filter field, `WorkoutTypeIdentifier` constant) was confirmed directly against the installed `@kingstinct/react-native-healthkit@14.0.2` package's shipped `.d.ts` files before writing code, matching 05-RESEARCH.md's verified Pattern 3/Code Examples exactly — no surprises versus the plan's `<action>` text.

## User Setup Required

None - no external service configuration required. On-device verification that a saved run/finished lift actually appears in the Health app with the correct distance/duration/ApsisHSS metadata, and that discarding an Apsis-authored session removes it, remains blocked on the pending EAS dev build (provisioning-profile fix, tracked against 05-01's in-flight checkpoint) and requires a physical device (05-RESEARCH.md Pitfall 6) — this is not new to this plan and was anticipated in this plan's own `<verification>` section (grep-only automated verification; Health-app appearance and delete-on-discard are UAT/manual-only).

## Next Phase Readiness
- `healthkitWriteback.ts` and the wired `saveRun`/`finishWorkout`/`discardWorkout` tails are ready for 05-07 (onboarding/settings UI), which will be the first code path to actually flip `healthkitConnected` to `true` via `setSyncState` — until that UI exists, these write-back tails are dormant (gate always reads `false`), which is expected and not a stub/gap in this plan's own scope.
- HK-04's requirement is now structurally complete pending on-device UAT; no further write-back logic is anticipated for the remainder of the phase.
- On-device UAT of HK-04's actual Health-app write/delete behavior remains deferred to phase UAT, same blocker already tracked from 05-01/05-03/05-05.

---
*Phase: 05-healthkit-integration*
*Completed: 2026-07-11*

## Self-Check: PASSED

All created/modified files verified present on disk; commits ae5682a and e1b3317 verified present in git log.
