---
phase: 04-run-logger-home-dashboard
plan: 01
subsystem: database
tags: [drizzle, sqlite, vitest, engine-composition, load_daily, duration-parsing]

# Dependency graph
requires:
  - phase: 02-hss-engine
    provides: dailyHSS, computeLoadTrendSeries (@apsis/engine) — pure EWMA/readiness-band math this plan composes, never reimplements
  - phase: 03-onboarding-lifting-logger
    provides: workout/strength_set/load_daily schema, activeWorkoutFilter soft-delete convention, drizzle migration pipeline (0000/0001)
provides:
  - workout.note nullable column + committed 0002 migration
  - computeLoadDailyUpsertRows pure gap-filled recompute-row builder
  - last28DaysTrend / sessionCountsByDate / dayGroupedSessions query builders
  - parseDurationDigits smart h:mm:ss digit-entry parser
affects: [04-02, 04-03, 04-04, 04-05 (run form, load_daily recompute wiring, Home dashboard, History screen)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Pure recompute-row builders take `today` as a caller-supplied parameter, never read the wall clock — mirrors @apsis/engine's own purity rule"
    - "History/trend query builders accept a QueryableDB param and are tested via drizzle-orm/sqlite-proxy .toSQL() generation, never a live op-sqlite connection"

key-files:
  created:
    - packages/db/src/loadDaily.ts
    - packages/db/src/__tests__/load-daily.test.ts
    - packages/db/src/__tests__/history-queries.test.ts
    - packages/db/drizzle/0002_careful_sue_storm.sql
    - packages/db/drizzle/meta/0002_snapshot.json
    - packages/shared/src/duration.ts
    - packages/shared/src/__tests__/duration.test.ts
  modified:
    - packages/db/src/schema.ts
    - packages/db/src/queries.ts
    - packages/db/src/index.ts
    - packages/db/package.json
    - packages/db/drizzle/meta/_journal.json
    - packages/db/drizzle/migrations.js
    - packages/shared/src/index.ts

key-decisions:
  - "workout.note placed on the workout table (not endurance_segment), per RESEARCH Assumption A4, so CONDITIONING sessions with no segment still carry a note"
  - "@apsis/engine and @apsis/shared added as explicit packages/db dependencies (not just transitive via pnpm hoisting) since loadDaily.ts imports both directly"
  - "computeLoadDailyUpsertRows never reads the wall clock; today is always caller-supplied, matching the engine's existing purity convention"

patterns-established:
  - "Full-history contiguous gap-fill (RESEARCH Pattern 1): group sessions by localDate, walk every calendar day from first-ever session through today inclusive, feed the resulting array straight into dailyHSS + computeLoadTrendSeries"
  - "Smart digit-entry parser (RESEARCH Pattern 2): strip non-digits, keep last 6, right-to-left hh:mm:ss fill, never clamp mid-entry"

requirements-completed: [RUN-02, RUN-05, HOME-03, HOME-04, HOME-05, HOME-06]

coverage:
  - id: D1
    description: "workout.note nullable column added to schema.ts and a committed drizzle migration (0002) applies it via useMigrations on startup"
    requirement: "RUN-05"
    verification:
      - kind: unit
        ref: "manual: npx drizzle-kit generate (packages/db) — verified ALTER TABLE workout ADD note text in drizzle/0002_careful_sue_storm.sql; re-run reports no schema changes"
        status: pass
    human_judgment: false
  - id: D2
    description: "computeLoadDailyUpsertRows produces a calendar-contiguous, gap-filled load_daily row array with double-session penalty applied via @apsis/engine composition"
    requirement: "HOME-03"
    verification:
      - kind: unit
        ref: "packages/db/src/__tests__/load-daily.test.ts#computeLoadDailyUpsertRows"
        status: pass
    human_judgment: false
  - id: D3
    description: "last28DaysTrend, sessionCountsByDate, and dayGroupedSessions parameterized query builders feed Home/History without leaking soft-deleted workouts"
    requirement: "HOME-04"
    verification:
      - kind: unit
        ref: "packages/db/src/__tests__/history-queries.test.ts#sessionCountsByDate,last28DaysTrend,dayGroupedSessions"
        status: pass
    human_judgment: false
  - id: D4
    description: "parseDurationDigits implements right-to-left h:mm:ss digit entry for the run form's DURATION field"
    requirement: "RUN-02"
    verification:
      - kind: unit
        ref: "packages/shared/src/__tests__/duration.test.ts#parseDurationDigits"
        status: pass
    human_judgment: false

duration: 15min
completed: 2026-07-10
status: complete
---

# Phase 04 Plan 01: DB + Duration Foundation Summary

**workout.note migration, a pure gap-filled load_daily recompute-row builder composing @apsis/engine (never a hand-rolled EWMA), three history/trend query builders, and a smart h:mm:ss digit-entry parser — all covered by vitest in packages/db and packages/shared.**

## Performance

- **Duration:** ~15 min
- **Completed:** 2026-07-10
- **Tasks:** 3
- **Files modified:** 12 (5 new source/test files in packages/db, 2 new source/test files in packages/shared, 2 generated migration artifacts, 3 modified index/queries/package.json files)

## Accomplishments
- `workout.note` nullable text column added and committed migration `0002_careful_sue_storm.sql` generated (verified idempotent on a second `drizzle-kit generate` run)
- `computeLoadDailyUpsertRows` — pure, I/O-free full-history recompute builder that gap-fills rest days as explicit 0s and composes `@apsis/engine`'s `dailyHSS`/`computeLoadTrendSeries`
- `last28DaysTrend`, `sessionCountsByDate`, `dayGroupedSessions` parameterized query builders added to `packages/db/src/queries.ts`, all reusing the existing `activeWorkoutFilter` soft-delete convention
- `parseDurationDigits` — pure right-to-left h:mm:ss digit-entry parser added to `packages/shared`
- All new code covered by vitest: 5 new tests in `load-daily.test.ts`, `history-queries.test.ts`'s 3 describe blocks, and 6 tests in `duration.test.ts`

## Task Commits

Each task was committed atomically:

1. **Task 1: Add workout.note column and generate the committed migration** - `59f3fb6` (feat)
2. **Task 2: load_daily recompute-row builder + history query builders (+ engine dependency)** - `cfab265` (feat)
3. **Task 3: Smart duration-digit parser in packages/shared** - `d8178a6` (feat)

_No TDD tasks in this plan — all three tasks were single-commit `feat` additions with tests written alongside the implementation._

## Files Created/Modified
- `packages/db/src/schema.ts` - added `workout.note` nullable text column
- `packages/db/drizzle/0002_careful_sue_storm.sql` - generated ALTER TABLE workout ADD note migration
- `packages/db/drizzle/meta/0002_snapshot.json`, `packages/db/drizzle/meta/_journal.json`, `packages/db/drizzle/migrations.js` - drizzle-kit generated artifacts (append-only)
- `packages/db/src/loadDaily.ts` - pure `computeLoadDailyUpsertRows` + `LoadDailyUpsertRow` type
- `packages/db/src/queries.ts` - added `last28DaysTrend`, `sessionCountsByDate`, `dayGroupedSessions`
- `packages/db/src/index.ts` - re-exports for the new builders and `loadDaily.ts` exports
- `packages/db/package.json` - added `@apsis/engine` and `@apsis/shared` workspace dependencies
- `packages/db/src/__tests__/load-daily.test.ts` - gap-fill, double-session penalty, first-date anchoring, empty-input, trend-series parity tests
- `packages/db/src/__tests__/history-queries.test.ts` - `.toSQL()` filter/order/limit assertions for the three new builders
- `packages/shared/src/duration.ts` - `parseDurationDigits`
- `packages/shared/src/index.ts` - added `export * from './duration'`
- `packages/shared/src/__tests__/duration.test.ts` - RESEARCH examples plus empty/short/overflow/non-digit edge cases

## Decisions Made
- `workout.note` placed on the workout table (not `endurance_segment`), per RESEARCH Assumption A4, so CONDITIONING sessions with no endurance segment still carry a note
- `@apsis/engine` and `@apsis/shared` added as explicit `packages/db` dependencies (not left to transitive pnpm hoisting) since `loadDaily.ts` imports directly from both
- `computeLoadDailyUpsertRows` never reads the wall clock — `today` is always caller-supplied, consistent with the engine's own purity convention (no `Date.now()` inside pure logic)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- `computeLoadDailyUpsertRows` and the three history/trend query builders are ready for Plan 04-03 to wire into an op-sqlite read+upsert pipeline (`recomputeLoadDaily`), and for Plan 04-02/04-04 to consume via `dayGroupedSessions`/`last28DaysTrend` for the Home dashboard and History screen.
- `parseDurationDigits` is ready for the run form's DURATION field (Plan 04-02).
- `workout.note` is migrated and available for the run form's optional note field and any lifting-session note UI.
- Pre-existing typecheck errors (`apps/mobile/app/onboarding/review.tsx`, `apps/mobile/components/ExternalLink.tsx`, both router-typed-route issues logged in Phase 03's deferred-items.md) are unaffected by this plan — confirmed identical before/after via `git stash`.

---
*Phase: 04-run-logger-home-dashboard*
*Completed: 2026-07-10*

## Self-Check: PASSED

All created files verified present on disk; all three task commit hashes (59f3fb6, cfab265, d8178a6) verified in git log.
