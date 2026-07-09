---
phase: 03-onboarding-lifting-logger
plan: 02
subsystem: database
tags: [drizzle, sqlite, op-sqlite, schema-migration, query-builders]

# Dependency graph
requires:
  - phase: 01-foundation
    provides: six-table drizzle schema, op-sqlite client singleton, idempotent exercise seeder, useMigrations boot pipeline
  - phase: 02-hss-engine
    provides: pure-TS HSS engine consuming loadKg/reps/durationS shaped inputs
provides:
  - exercise.bwFactor / exercise.entryMode / exercise.restTimerSec columns, seeded per movement
  - workout.finishedAt (D-14 crash recovery) and workout.deletedAt (D-28 soft delete) columns
  - strength_set.addedLoadKg / strength_set.durationS columns for bodyweight + carry logging
  - user_profile.restTimerDefaultSec column, default 120s
  - queries.ts: activeWorkoutFilter, selectActiveWorkouts, previousSessionSet, openWorkout, softDeleteWorkout
  - committed drizzle migration 0001 applying all 8 new columns via the existing useMigrations pipeline
affects: [03-03, 03-04, 03-05, 03-06, 03-07, 03-08, 03-09]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Parameterized query-builder factories take `db: QueryableDB` as a parameter (typed as `BaseSQLiteDatabase<'async', any, any, any>`) so builders are testable via .toSQL() with drizzle-orm/sqlite-proxy, without ever opening the real op-sqlite JSI connection in vitest"
    - "Shared soft-delete filter (activeWorkoutFilter = isNull(workout.deletedAt)) exported once and reused by every workout read path"
    - "Nullable-column-only schema migrations (no non-constant default) generate plain ALTER TABLE ADD COLUMN via drizzle-kit's 'expo' driver — no table recreation"

key-files:
  created:
    - packages/db/src/queries.ts
    - packages/db/src/__tests__/previous-session-query.test.ts
    - packages/db/src/__tests__/soft-delete.test.ts
    - packages/db/drizzle/0001_long_firebrand.sql
    - packages/db/drizzle/meta/0001_snapshot.json
  modified:
    - packages/db/src/schema.ts
    - packages/db/src/seed.ts
    - packages/db/src/__tests__/seed.test.ts
    - packages/db/src/index.ts
    - packages/db/drizzle/meta/_journal.json
    - packages/db/drizzle/migrations.js

key-decisions:
  - "battle-rope and plank get entryMode 'timed' (bwFactor null) even though battle-rope's seed `type` field is 'endurance' — the PLAN.md task explicitly listed only run/ski-erg/rowing-erg/assault-bike as the Pitfall-5 endurance-null bucket, so battle-rope/plank are treated as Phase 3 loggable timed movements, not deferred to Phase 4 endurance logging"
  - "previousSessionSet joins strength_set -> workout and orders by workout.finishedAt desc (not createdAt) since the query already filters on finished, non-deleted workouts only"
  - "Query builders typed against drizzle-orm's BaseSQLiteDatabase base class (shared by OPSQLiteDatabase and sqlite-proxy's SqliteRemoteDatabase) rather than the concrete op-sqlite DB type, so the same builder code works against the real db in the app and a sqlite-proxy mock in tests without any conditional typing"

patterns-established:
  - "New reusable db query builders live in packages/db/src/queries.ts as plain exported functions taking (db, ...args) and returning a drizzle query object; callers call .toSQL() in tests or execute directly in app code"

requirements-completed: [LIFT-03, LIFT-07]

coverage:
  - id: D1
    description: "exercise table carries bwFactor/entryMode/restTimerSec per movement, seeded with literature-grounded values"
    requirement: "LIFT-03"
    verification:
      - kind: unit
        ref: "packages/db/src/__tests__/seed.test.ts#STARTER_EXERCISES bwFactor/entryMode (D-15/D-21)"
        status: pass
    human_judgment: false
  - id: D2
    description: "workout can be marked finished (finishedAt) and soft-deleted (deletedAt); soft-deleted workouts excluded from active-workout/pre-fill queries via a shared filter"
    requirement: "LIFT-07"
    verification:
      - kind: unit
        ref: "packages/db/src/__tests__/soft-delete.test.ts#soft-delete filtering (D-28)"
        status: pass
    human_judgment: false
  - id: D3
    description: "previousSessionSet query returns an exercise's most recent prior committed set for pre-fill"
    requirement: "LIFT-03"
    verification:
      - kind: unit
        ref: "packages/db/src/__tests__/previous-session-query.test.ts#previousSessionSet"
        status: pass
    human_judgment: false
  - id: D4
    description: "New migration 0001 generated, reviewed (8 ADD COLUMN statements, no table recreation), committed, and wired into the existing useMigrations boot pipeline"
    verification:
      - kind: unit
        ref: "pnpm --filter @apsis/db test (full suite green after migration generation)"
        status: pass
      - kind: other
        ref: "manual inspection of packages/db/drizzle/0001_long_firebrand.sql + tsc --noEmit clean for packages/db and apps/mobile"
        status: pass
    human_judgment: false

duration: 5min
completed: 2026-07-09
status: complete
---

# Phase 3 Plan 02: Schema Migration + Query Builders Summary

**Extended the drizzle schema with 8 new nullable columns (bodyweight factors, entry modes, rest timers, finish/soft-delete markers, added-load/duration for carries), seeded literature-anchored bwFactor/entryMode values across 43 exercises, added 5 reusable parameterized query builders for pre-fill/soft-delete/crash-recovery, and generated + committed the drizzle migration that ships all of it through the existing boot pipeline.**

## Performance

- **Duration:** 5 min
- **Started:** 2026-07-09T19:51:50Z
- **Completed:** 2026-07-09T19:56:30Z
- **Tasks:** 3
- **Files modified:** 11

## Accomplishments
- Schema now carries every column Phase 3's lifting logger needs: `exercise.bwFactor/entryMode/restTimerSec`, `workout.finishedAt/deletedAt`, `strength_set.addedLoadKg/durationS`, `user_profile.restTimerDefaultSec`
- All 43 seeded exercises carry correct bwFactor/entryMode values per the RESEARCH.md proposed table (13 bodyweight movements, 6 timed movements, endurance rows left null per Pitfall 5)
- `queries.ts` exposes `previousSessionSet` (LIFT-03 pre-fill), `activeWorkoutFilter`/`selectActiveWorkouts`/`openWorkout` (D-14/D-28), and `softDeleteWorkout` (D-28 discard) — all parameterized, no raw SQL interpolation
- Migration `0001_long_firebrand.sql` generated, inspected (8 ADD COLUMN statements only, no table recreation), and committed; boot pipeline (`useMigrations` + `src/migrations.ts` re-export) picks it up with zero code changes
- `pnpm --filter @apsis/db test` green (17 tests across 4 files); `tsc --noEmit` clean for both `packages/db` and `apps/mobile`

## Task Commits

Each task was committed atomically:

1. **Task 1: Extend schema + seed the new per-exercise metadata** - `c9252a5` (feat)
2. **Task 2: Reusable parameterized query builders (previous-session prefill + soft-delete filter)** - `d08021a` (feat)
3. **Task 3: [BLOCKING] Generate + commit the drizzle migration and confirm the boot pipeline applies it** - `79eab52` (feat)

**Plan metadata:** (pending — final docs commit)

## Files Created/Modified
- `packages/db/src/schema.ts` - Added 8 nullable columns across exercise/workout/strength_set/user_profile
- `packages/db/src/seed.ts` - Added bwFactor/entryMode to all 43 STARTER_EXERCISES entries
- `packages/db/src/__tests__/seed.test.ts` - New describe block asserting bwFactor/entryMode/endurance-null per movement
- `packages/db/src/queries.ts` - New: activeWorkoutFilter, selectActiveWorkouts, previousSessionSet, openWorkout, softDeleteWorkout
- `packages/db/src/__tests__/previous-session-query.test.ts` - New: SQL-generation assertions for previousSessionSet
- `packages/db/src/__tests__/soft-delete.test.ts` - New: SQL-generation assertions for soft-delete filtering
- `packages/db/src/index.ts` - Exports queries.ts public API
- `packages/db/drizzle/0001_long_firebrand.sql` - Generated migration, 8 ADD COLUMN statements
- `packages/db/drizzle/meta/0001_snapshot.json` - Generated drizzle-kit snapshot
- `packages/db/drizzle/meta/_journal.json` - Generated: new migration entry appended
- `packages/db/drizzle/migrations.js` - Generated: imports 0001 alongside 0000

## Decisions Made
- battle-rope and plank assigned entryMode 'timed' (bwFactor null) despite battle-rope's `type: 'endurance'` seed classification — the PLAN.md task text explicitly scoped the Pitfall-5 "leave endurance rows null" rule to only run/ski-erg/rowing-erg/assault-bike, so these two remain Phase 3 loggable timed movements
- `previousSessionSet` orders by `workout.finishedAt desc` (the query already filters `isNotNull(finishedAt)`, so this is equivalent to and simpler than ordering by `createdAt`)
- Query builders are typed against drizzle-orm's `BaseSQLiteDatabase<'async', any, any, any>` base class rather than the concrete `OPSQLiteDatabase` type, letting the same builder functions run against both the real op-sqlite-backed `db` in app code and a `drizzle-orm/sqlite-proxy` mock in vitest — no conditional/duplicate typing needed

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Schema and query-builder foundation ready for Plan 03+ (onboarding wizard, active-session screen, set entry UI) to build on
- `previousSessionSet`/`openWorkout`/`softDeleteWorkout`/`activeWorkoutFilter` are ready to be called from `apps/mobile` app code once the session store and screens land
- No blockers; migration applies on next app boot via the existing `useMigrations` pipeline with no further wiring required

---
*Phase: 03-onboarding-lifting-logger*
*Completed: 2026-07-09*

## Self-Check: PASSED

All created files verified present on disk; all 3 task commits (c9252a5, d08021a, 79eab52) verified present in git log.
