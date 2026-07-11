---
phase: 05-healthkit-integration
plan: 05
subsystem: healthkit
tags: [healthkit, drizzle, appstate, dedupe, sync]

requires:
  - phase: 05-healthkit-integration (05-03)
    provides: "Pure HK decision logic (healthkitMapping.ts), authorization identifier sets (healthkitAuth.ts), and drizzle-backed sync-state accessors (healthkitSyncState.ts)"
provides:
  - "runHealthKitSync(db, { initial }): anchored 90-day-initial / foreground-delta batch import of HK workouts + most-recent bodyweight, deduped and echo-excluded, single end-of-batch recompute, anchor advances only on success"
  - "useForegroundHealthKitSync(): AppState-driven, debounced, silent foreground sync trigger mounted in the tab shell"
  - "useHealthKitImportSignal: zustand store carrying the last-sync import count/timestamp for 05-09's TODAY notice"
affects: [05-06 (write-back engine), 05-07 (onboarding/settings UI wiring the toggle/connect flow), 05-09 (TODAY import notice)]

tech-stack:
  added: []
  patterns:
    - "Batch import: loop insert+HSS-write, single recomputeLoadDaily call after the loop (not per row) — the one new deviation from runEntry.ts's per-action recompute contract"
    - "Dedupe tombstone check (any candidate, incl. soft-deleted) separated from manual-duplicate tolerance check (only healthkitUuid == null candidates) so two real same-day HK sessions of similar duration don't false-positive-skip each other"
    - "profileVersion.ts-style tiny zustand store as the cross-cutting 'last sync result' signal for a future screen to read"

key-files:
  created:
    - apps/mobile/lib/healthkitImport.ts
    - apps/mobile/hooks/useForegroundHealthKitSync.ts
  modified:
    - apps/mobile/app/(tabs)/_layout.tsx

key-decisions:
  - "fetchThresholds duplicated locally in healthkitImport.ts (not imported) since runEntry.ts's version is a private, unexported helper — avoids a cross-cutting refactor outside this plan's declared files"
  - "Duration-tolerance manual-duplicate check filters candidatesForDedupe results to healthkitUuid == null before applying isDuplicateOfExisting, while the tombstone check runs against the full unfiltered candidate list — prevents two legitimate same-day HK sessions of similar duration from incorrectly skipping each other, while still catching manual-vs-import duplicates (D-06/07) and soft-deleted tombstones (Pitfall 8/9)"
  - "sanitizeHKNumeric bounds (duration <=48h, distance <=500km, HR 0-250bpm, bodyweight 20-400kg) are discretion sanity ranges for hostile/corrupted HK data (V5/T-05-02), separate from the engine's own IF/duration clamps"
  - "workout.duration.quantity used directly as durationS (native Swift source confirms it's always HKUnit.second()), and totalDistance.quantity used directly as distanceM (native Swift source confirms it's always HKUnit.meter()) — no unit-conversion helper needed for either"
  - "useHealthKitImportSignal is a new, non-persisted zustand store (mirrors profileVersion.ts's pattern) — the coordinated exported symbol 05-09 will import for the TODAY quiet transient notice (D-10); resets every app session by design"
  - "Debounce (2s) + in-flight ref guard useForegroundHealthKitSync — not present in RestTimerBanner's AppState analog, added per 05-PATTERNS.md's flagged discretion item"

requirements-completed: [HK-01, HK-02, HK-03]

coverage:
  - id: D1
    description: "runHealthKitSync batch-imports HK workouts on initial connect (90-day date window, D-01) and on foreground delta (anchor-based, D-02), mapping activity type via mapHKActivityType and skipping strength/unknown types (D-04/D-05)"
    requirement: HK-01
    verification:
      - kind: other
        ref: "grep -q recomputeLoadDaily lib/healthkitImport.ts && grep -q candidatesForDedupe lib/healthkitImport.ts && grep -q getMostRecentQuantitySample lib/healthkitImport.ts"
        status: pass
    human_judgment: true
    rationale: "Actual on-device HealthKit permission grant + real import is manual-only per 05-RESEARCH.md (Simulator has minimal Health data, Pitfall 6); this plan's own verification scope is grep + typecheck/vitest only, confirmed passing above."
  - id: D2
    description: "Most-recent HK bodyweight sample imported and applied to user_profile.bodyweightKg/bodyweightSetAt only when newer than the existing bodyweightSetAt (D-16/D-17, most-recent-wins), gated on an existing profile row"
    requirement: HK-02
    verification:
      - kind: unit
        ref: "apps/mobile/lib/__tests__/healthkitMapping.test.ts#bodyweightSampleIsNewer (D-17) — pre-existing 05-03 coverage of the recency comparator this plan calls"
        status: pass
    human_judgment: true
    rationale: "The recency comparator itself is unit-tested (05-03); the actual HealthKit read (getMostRecentQuantitySample) and the resulting SQLite write are native-module-dependent and can only be verified on a physical device (Pitfall 6)."
  - id: D3
    description: "Dedupe: candidatesForDedupe consulted for both a healthkitUuid tombstone match (incl. soft-deleted rows, Pitfall 8/9) and a duration-within-tolerance manual-entry match (D-06/D-07 manual wins), skipping the sample on either match"
    requirement: HK-03
    verification:
      - kind: other
        ref: "grep -q candidatesForDedupe lib/healthkitImport.ts (query call site); apps/mobile/lib/__tests__/healthkitMapping.test.ts#isDuplicateOfExisting (D-06) covers the duration-tolerance comparator this logic calls"
        status: pass
    human_judgment: true
    rationale: "The duration-tolerance comparator is unit-tested (05-03); the end-to-end dedupe flow against real imported/soft-deleted rows needs a physical device with real Health data to observe (Pitfall 6/9)."
  - id: D4
    description: "useForegroundHealthKitSync fires a gated (healthkitConnected), debounced, in-flight-guarded, silent (D-25) sync on every AppState transition to 'active', mounted once in the tab shell outside the logging path"
    verification:
      - kind: other
        ref: "grep -q AppState hooks/useForegroundHealthKitSync.ts && grep -q useForegroundHealthKitSync 'app/(tabs)/_layout.tsx'"
        status: pass
    human_judgment: true
    rationale: "The listener wiring is grep-verified and typecheck/vitest-clean, but observing an actual foreground-triggered sync against real Health data requires a physical device (Pitfall 6) and the still-pending EAS dev build (05-01 checkpoint)."

duration: ~9min
completed: 2026-07-11
status: complete
---

# Phase 05 Plan 05: HealthKit Import Engine + Foreground Sync Summary

**Anchored 90-day/foreground-delta HealthKit import (`healthkitImport.ts`) with duration-tolerance + tombstone dedupe and most-recent bodyweight sync, triggered silently on every app foreground via a debounced `AppState` hook mounted in the tab shell.**

## Performance

- **Duration:** ~9 min
- **Started:** 2026-07-11T23:16:31Z
- **Completed:** 2026-07-11T23:25:06Z
- **Tasks:** 2
- **Files modified:** 3 (2 created, 1 modified)

## Accomplishments
- `healthkitImport.ts`: `runHealthKitSync(db, { initial })` — anchored `queryWorkoutSamplesWithAnchor` with a `sources` NOT-filter (D-11 primary echo defense) plus a 90-day `date.startDate` window on initial connect only (D-01); per-sample activity-type mapping (D-04/D-05), `sanitizeHKNumeric` clamping on duration/distance/avg-HR (V5/T-05-02), and a dual dedupe check against `candidatesForDedupe` (tombstone match across all candidates incl. soft-deleted, D-11/Pitfall 8/9; duration-tolerance match against manual-only candidates, D-06/D-07); non-duplicates insert `workout(source:'healthkit', healthkitUuid)` + `endurance_segment` via the existing `resolveRunSegment`/`sessionHSSDetailed`, with `recomputeLoadDaily` called exactly once after the whole loop (Pitfall 10); most-recent bodyweight pulled and applied only if newer (D-16/D-17); `newAnchor`/`healthkitLastSyncAt` persisted only on full success (D-25)
- `useForegroundHealthKitSync.ts`: `AppState` `'change'`-listener mirroring `RestTimerBanner.tsx`'s shape, gated on `healthkitConnected` (D-21), debounced + in-flight-guarded against a rapid background/foreground bounce, silently swallowing sync rejections (D-25); also exports `useHealthKitImportSignal`, a small zustand store (`profileVersion.ts` pattern) carrying the last sync's `importedCount`/`syncedAt` for 05-09's TODAY notice
- Mounted `useForegroundHealthKitSync()` once in `app/(tabs)/_layout.tsx`, outside every logging screen (local-first — sync never touches the logging path)

## Task Commits

Each task was committed atomically:

1. **Task 1: healthkitImport.ts — anchored batch import + dedupe + bodyweight** — `1b1f82d` (feat)
2. **Task 2: useForegroundHealthKitSync hook + mount in tab shell** — `fda2443` (feat)

**Plan metadata:** (this commit)

## Files Created/Modified
- `apps/mobile/lib/healthkitImport.ts` — the anchored batch-import engine described above
- `apps/mobile/hooks/useForegroundHealthKitSync.ts` — AppState foreground trigger + `useHealthKitImportSignal` store
- `apps/mobile/app/(tabs)/_layout.tsx` — mounts `useForegroundHealthKitSync()` in the tab shell

## Decisions Made
- Restricted the duration-tolerance manual-duplicate check to `healthkitUuid == null` candidates while running the tombstone check against the full unfiltered candidate list — prevents two legitimate same-day HK imports of similar duration from false-positive-skipping each other, while still correctly implementing D-06/D-07 (manual wins) and Pitfall 8/9 (soft-deleted tombstones block resurrection).
- Used `workout.duration.quantity`/`totalDistance.quantity` directly as `durationS`/`distanceM` — confirmed against the library's native Swift source (`ios/WorkoutProxy.swift`) that both are unconditionally seconds/meters, so no unit-conversion helper is needed on the read side (mirrors the write-side Pitfall 4 finding from 05-RESEARCH.md).
- Duplicated `fetchThresholds` locally in `healthkitImport.ts` rather than exporting/importing `runEntry.ts`'s private helper of the same name and shape — keeps this plan's file scope to exactly its declared `files_modified` list.
- `useHealthKitImportSignal` is intentionally non-persisted (resets every app session) — a stale "3 imported" notice from yesterday's sync should never resurface after a relaunch.
- Chose a 2-second debounce + in-flight ref for the foreground sync guard (05-PATTERNS.md flagged this as a new discretion item with no existing analog).

## Deviations from Plan

None - plan executed exactly as written. Both tasks' automated verification commands (grep-based) passed on first implementation, and no Rule 1-3 fixes were required.

## Issues Encountered
None. Root `pnpm run typecheck` shows only the two pre-existing deferred errors (`app/onboarding/review.tsx`, `components/ExternalLink.tsx`) already tracked in STATE.md/03 deferred-items.md — no new typecheck errors introduced by this plan. `pnpm vitest run` (apps/mobile) stayed green at 30/30 (unchanged from 05-03 — this plan added no new pure-logic surface requiring its own unit tests; the two new files are impure I/O/hook code whose behavior is manual-only per 05-RESEARCH.md's validation architecture).

## User Setup Required

None - no external service configuration required. On-device verification of the actual import/dedupe/bodyweight-sync behavior (HK-01/02/03) remains blocked on the pending EAS dev build (provisioning-profile fix, tracked against 05-01's in-flight checkpoint) and requires a physical device (Simulator has minimal Health data, Pitfall 6) — neither is new to this plan.

## Next Phase Readiness
- `runHealthKitSync` and `useForegroundHealthKitSync`/`useHealthKitImportSignal` are ready for 05-06 (write-back engine, which will extend `saveRun`/`finishWorkout` with a fire-and-forget tail call using the same `db`/`healthkitSyncState` conventions), 05-07 (onboarding/settings UI, which will call `runHealthKitSync(db, { initial: true })` after the permission sheet completes and toggle `healthkitConnected` via `setSyncState`), and 05-09 (TODAY notice, which reads `useHealthKitImportSignal`'s `lastImportedCount`/`lastSyncedAt`).
- No settings/onboarding UI exists yet to actually flip `healthkitConnected` to `true` or trigger the initial 90-day import — that wiring is explicitly out of this plan's scope (05-07) and is not a stub/gap, per the phase's wave sequencing.
- On-device UAT of HK-01/02/03's actual HealthKit behavior remains deferred to phase UAT, same blocker already tracked from 05-01/05-03.

---
*Phase: 05-healthkit-integration*
*Completed: 2026-07-11*

## Self-Check: PASSED

All created/modified files verified present on disk; commits 1b1f82d and fda2443 verified present in git log.
