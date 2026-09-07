---
phase: 04-run-logger-home-dashboard
plan: 03
subsystem: database
tags: [drizzle, sqlite, op-sqlite, load_daily, timezone]

# Dependency graph
requires:
  - phase: 04-run-logger-home-dashboard
    provides: "04-01's computeLoadDailyUpsertRows pure recompute-row builder (packages/db/src/loadDaily.ts)"
provides:
  - "apps/mobile/lib/localDate.ts — single shared todayLocalDate/addDaysLocal local-time helper"
  - "apps/mobile/lib/recomputeLoadDaily.ts — op-sqlite read + full-history load_daily upsert pipeline"
  - "finishWorkout.ts and discardWorkout.ts both trigger a full-history load_daily recompute"
affects: [04-04, 04-05, 04-06, 04-07, 04-08 (Home dashboard, History screen, run form all read/write load_daily through this pipeline)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "recomputeLoadDaily mirrors commitSet.ts's recompute-then-write shape at day scope: read all rows, fold via the pure engine-backed builder, write back"
    - "load_daily upserts use a loop of single-row onConflictDoUpdate calls with literal set values, never a batch excluded.* reference (RESEARCH A1 safe fallback)"

key-files:
  created:
    - apps/mobile/lib/localDate.ts
    - apps/mobile/lib/recomputeLoadDaily.ts
  modified:
    - apps/mobile/app/(tabs)/log/index.tsx
    - apps/mobile/lib/finishWorkout.ts

key-decisions:
  - "onConflictDoUpdate uses per-row literal values (row.dayHss, row.atl, ...) rather than the excluded.* SQL fragment — RESEARCH flagged the excluded.* batch-upsert idiom as unverified against drizzle-orm 0.45.2 + op-sqlite; PLAN.md Task 2 resolved this at planning time by adopting the safe single-row-loop fallback"
  - "Both finishWorkout and discardWorkout now await recomputeLoadDaily after their write, closing the Pitfall 1 gap where load_daily was never written for lifting sessions"

patterns-established:
  - "Any future terminal write to workout (finish/discard/edit) must call recomputeLoadDaily so load_daily never drifts from the source-of-truth workout rows"

requirements-completed: [HOME-01, HOME-02]

coverage:
  - id: D1
    description: "Shared todayLocalDate/addDaysLocal local-time helper promoted to apps/mobile/lib/localDate.ts and consumed by log/index.tsx, removing the duplicate inline function (Pitfall 4)"
    requirement: "HOME-01"
    verification:
      - kind: unit
        ref: "grep verification: lib/localDate.ts exports both functions; log/index.tsx imports from @/lib/localDate and no longer declares its own todayLocalDate"
        status: pass
    human_judgment: false
  - id: D2
    description: "recomputeLoadDaily reads finished, non-deleted workouts and upserts a full-history contiguous load_daily table via computeLoadDailyUpsertRows, using per-row literal onConflictDoUpdate (no excluded.* / raw sql interpolation)"
    requirement: "HOME-01"
    verification:
      - kind: unit
        ref: "grep verification: recomputeLoadDaily exported, calls computeLoadDailyUpsertRows, uses onConflictDoUpdate; apps/mobile typecheck shows no new errors beyond the two pre-existing typed-route errors"
        status: pass
    human_judgment: false
  - id: D3
    description: "finishWorkout and discardWorkout both await recomputeLoadDaily after their write, so Home reflects lifting sessions (not just runs) and removes a discarded session's load from the trend"
    requirement: "HOME-02"
    verification:
      - kind: manual_procedural
        ref: "grep -c recomputeLoadDaily lib/finishWorkout.ts returns 4 (import + doc comment + 2 call sites); full on-device confirmation (ring/band changes on lift finish, trend point disappears on discard) deferred to phase UAT gate per PLAN.md's <verification> section"
        status: unknown
    human_judgment: true
    rationale: "The plan's own <verification> section defers the ring/band/trend-update behavior to on-device UAT at the phase gate — this is source code plus static grep evidence only, not a running-app observation."

duration: 8min
completed: 2026-07-10
status: complete
---

# Phase 04 Plan 03: Load Daily Recompute Pipeline Summary

**New op-sqlite recomputeLoadDaily pipeline (single-row parameterized upserts, no excluded.* SQL) wired into finishWorkout + discardWorkout so Home reflects lifting sessions, not just runs; local-date helper promoted to a shared module.**

## Performance

- **Duration:** 8 min
- **Started:** 2026-07-10T20:49:14Z
- **Completed:** 2026-07-10T20:57:00Z
- **Tasks:** 3
- **Files modified:** 4 (2 created, 2 modified)

## Accomplishments
- `apps/mobile/lib/localDate.ts` — single shared `todayLocalDate`/`addDaysLocal` local-time (never UTC) helper, deduplicated out of `log/index.tsx` (Pitfall 4)
- `apps/mobile/lib/recomputeLoadDaily.ts` — the net-new op-sqlite read + full-history upsert pipeline that was completely missing before this plan (RESEARCH Pitfall 1: `load_daily` was never written anywhere)
- `finishWorkout` and `discardWorkout` both now await `recomputeLoadDaily`, closing the gap where Home would have only ever reflected running sessions

## Task Commits

Each task was committed atomically:

1. **Task 1: Promote the local-date helper to a shared module (Pitfall 4)** - `fa9d6b5` (feat)
2. **Task 2: recomputeLoadDaily - op-sqlite read + full-history upsert** - `7d9e9c4` (feat)
3. **Task 3: Retrofit finishWorkout + discardWorkout to recompute load_daily (Pitfall 1 + D-29)** - `548f59b` (feat)

_No TDD tasks in this plan — all three tasks were single-commit `feat` additions._

## Files Created/Modified
- `apps/mobile/lib/localDate.ts` - new shared `todayLocalDate`/`addDaysLocal` helpers
- `apps/mobile/app/(tabs)/log/index.tsx` - imports `todayLocalDate` from `@/lib/localDate`, inline duplicate removed
- `apps/mobile/lib/recomputeLoadDaily.ts` - new op-sqlite read + full-history `load_daily` upsert pipeline
- `apps/mobile/lib/finishWorkout.ts` - `finishWorkout`/`discardWorkout` both await `recomputeLoadDaily` after their write

## Decisions Made
- `onConflictDoUpdate`'s `set` uses each row's literal values (`row.dayHss`, `row.atl`, etc.) rather than the `excluded.*` SQL fragment RESEARCH's example sketched — this sidesteps RESEARCH's Open Question 1 / Assumption A1 (unverified `excluded.*` support against drizzle-orm 0.45.2 + op-sqlite) with a guaranteed-correct, still fully parameterized loop of single-row upserts, per PLAN.md Task 2's explicit resolution
- `recomputeLoadDaily` wraps its body in try/catch: `console.error` for diagnostics, then re-throws so callers can show their own generic user-facing message (matches the existing `T-1-02`/`T-03-08` error-handling convention)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- `recomputeLoadDaily` is ready for Plan 04-05's run-save flow to call after saving an endurance session, and for any future terminal workout write.
- `apps/mobile/lib/localDate.ts` is the single source of truth for local-date derivation; Plan 04-02's run form and any future date-picker code must import from here (Pitfall 4).
- `apps/mobile typecheck` confirmed no NEW errors introduced by this plan's three files — only the two pre-existing documented typed-route errors (`app/onboarding/review.tsx`, `components/ExternalLink.tsx`) remain, consistent with Phase 03's deferred-items.md.
- On-device UAT (phase gate, per PLAN.md's `<verification>` section) still needs to confirm: finishing a LIFT changes Home's ring/band; discarding a session removes its load from the trend. Flagged as `human_judgment: true` in this SUMMARY's coverage block (D3) since it requires a running app, not just source/grep verification.

---
*Phase: 04-run-logger-home-dashboard*
*Completed: 2026-07-10*

## Self-Check: PASSED

All created/modified files verified present on disk; all three task commit hashes (fa9d6b5, 7d9e9c4, 548f59b) verified in git log.
