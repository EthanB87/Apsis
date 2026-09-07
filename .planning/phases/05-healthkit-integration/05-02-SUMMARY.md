---
phase: 05-healthkit-integration
plan: 02
subsystem: database
tags: [drizzle, sqlite, schema, migration, dedupe, healthkit]

# Dependency graph
requires:
  - phase: 05-healthkit-integration
    provides: 05-01's install/config-plugin/EAS build groundwork (Nitro modules, HealthKit entitlement)
provides:
  - workout.source / workout.healthkitUuid columns (provenance + echo-exclusion/write-back tracking)
  - user_profile.bodyweightSetAt / healthkitConnected / healthkitLastSyncAt / healthkitAnchor columns
  - candidatesForDedupe query builder (tombstone-inclusive same-day/same-activity-type lookup)
  - 0003 bundled drizzle migration materializing all six columns in the device DB
affects: [05-03 (mapping/dedupe logic), 05-04 (import), 05-05 (bodyweight sync), 05-06 (write-back), 05-07/08/09 (UI/settings/onboarding)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Tombstone-inclusive query pattern: candidatesForDedupe deliberately omits activeWorkoutFilter so soft-deleted imported rows still block re-import (Pitfall 9)"

key-files:
  created:
    - packages/db/src/__tests__/dedupe-candidate-query.test.ts
    - packages/db/drizzle/0003_normal_hairball.sql
    - packages/db/drizzle/meta/0003_snapshot.json
  modified:
    - packages/db/src/schema.ts
    - packages/db/src/queries.ts
    - packages/db/src/index.ts
    - packages/db/drizzle/meta/_journal.json
    - packages/db/drizzle/migrations.js

key-decisions:
  - "candidatesForDedupe's activityType param is typed as the literal enduranceSegment.activityType union ('run'|'erg'|'conditioning'|'sled'|'other') rather than a generic string, to satisfy drizzle's typed eq() overload under tsc --build"

patterns-established:
  - "Dedupe/tombstone lookups on workout.healthkitUuid must never apply activeWorkoutFilter — documented inline in candidatesForDedupe as a deliberate exception to the otherwise-universal soft-delete filter convention"

requirements-completed: [HK-02, HK-03, HK-04]

coverage:
  - id: D1
    description: "workout table gains source ('manual'|'healthkit', D-08) and healthkitUuid (D-11/D-14) columns, each with a decision-ID comment matching the existing finishedAt/deletedAt convention"
    requirement: "HK-04"
    verification:
      - kind: unit
        ref: "grep -n \"healthkit_uuid\" / \"source'\" packages/db/src/schema.ts — both present in workout table"
        status: pass
    human_judgment: false
  - id: D2
    description: "user_profile gains bodyweightSetAt (D-17), healthkitConnected (D-19/D-21), healthkitLastSyncAt (D-24), healthkitAnchor (D-02) columns"
    requirement: "HK-02"
    verification:
      - kind: unit
        ref: "grep -n \"bodyweight_set_at|healthkit_connected|healthkit_last_sync_at|healthkit_anchor\" packages/db/src/schema.ts — all four present"
        status: pass
    human_judgment: false
  - id: D3
    description: "candidatesForDedupe query builder is tombstone-inclusive (no deleted_at filter), filters localDate+activityType, and is exported from @apsis/db"
    requirement: "HK-03"
    verification:
      - kind: unit
        ref: "packages/db/src/__tests__/dedupe-candidate-query.test.ts (4 tests: no deleted_at, local_date+activity_type filter, parameterized binding, durationS/healthkitUuid select)"
        status: pass
    human_judgment: false
  - id: D4
    description: "dayGroupedSessions select includes workout.source for the History provenance chip"
    requirement: "HK-04"
    verification:
      - kind: unit
        ref: "packages/db/src/__tests__/history-queries.test.ts (existing suite, still green) + code inspection of queries.ts dayGroupedSessions select list"
        status: pass
    human_judgment: false
  - id: D5
    description: "0003 migration generated via drizzle-kit, adds all six columns as ALTER TABLE statements, wired into journal.json and migrations.js so it ships/runs at startup"
    requirement: "HK-02"
    verification:
      - kind: unit
        ref: "ls packages/db/drizzle/0003_*.sql + grep healthkit_uuid/bodyweight_set_at in the generated file"
        status: pass
    human_judgment: false

duration: 13min
completed: 2026-07-11
status: complete
---

# Phase 05 Plan 02: Schema Extension + Dedupe Query Builder Summary

**Extended `@apsis/db` schema with HealthKit provenance/sync-state columns, a tombstone-inclusive `candidatesForDedupe` query builder, and a generated `0003` drizzle migration that materializes all six columns for the device DB.**

## Performance

- **Duration:** 13 min
- **Started:** 2026-07-11T22:38:00Z
- **Completed:** 2026-07-11T22:51:29Z
- **Tasks:** 2
- **Files modified:** 9

## Accomplishments
- `workout.source`/`workout.healthkitUuid` and `user_profile.bodyweightSetAt`/`healthkitConnected`/`healthkitLastSyncAt`/`healthkitAnchor` columns added to schema.ts with decision-ID comments matching the existing convention
- `candidatesForDedupe(db, localDate, activityType)` added to queries.ts and exported from `@apsis/db`'s barrel — deliberately tombstone-inclusive (no `deletedAt` filter) per Pitfall 9
- `dayGroupedSessions` now selects `source` so History can render the provenance chip (D-08)
- Generated and bundled the `0003_normal_hairball.sql` migration (never hand-written) with all six `ALTER TABLE` statements; `journal.json` and `migrations.js` updated so it ships via babel-plugin-inline-import and runs at app startup

## Task Commits

Each task was committed atomically:

1. **Task 1: Extend schema + dedupe query builder** - `2bc5574` (feat)
2. **Task 2: Generate + bundle the drizzle migration** - `043f74c` (feat)

## Files Created/Modified
- `packages/db/src/schema.ts` - Added workout.source/healthkitUuid and four user_profile HK columns
- `packages/db/src/queries.ts` - Added candidatesForDedupe builder; dayGroupedSessions selects source
- `packages/db/src/index.ts` - Exported candidatesForDedupe from the @apsis/db barrel
- `packages/db/src/__tests__/dedupe-candidate-query.test.ts` - New vitest suite (tombstone-inclusive, parameterized binding, column selection)
- `packages/db/drizzle/0003_normal_hairball.sql` - Generated migration (6 ALTER TABLE statements)
- `packages/db/drizzle/meta/0003_snapshot.json` - Generated drizzle-kit snapshot
- `packages/db/drizzle/meta/_journal.json` - Migration journal entry for 0003
- `packages/db/drizzle/migrations.js` - Auto-generated importer, now imports m0003

## Decisions Made
- Typed `candidatesForDedupe`'s `activityType` parameter as the literal `enduranceSegment.activityType` union (`'run' | 'erg' | 'conditioning' | 'sled' | 'other'`) instead of `string` — drizzle's `eq()` overload resolution requires the exact enum type for typed SQLite text-enum columns; a plain `string` param fails `tsc --build` with a "No overload matches this call" error.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed activityType parameter type to satisfy drizzle's typed eq() overload**
- **Found during:** Task 1 (typecheck verification after implementing candidatesForDedupe)
- **Issue:** RESEARCH.md's Code Example typed `candidatesForDedupe`'s `activityType` param as `string`, but `enduranceSegment.activityType` is a drizzle typed enum column (`'run'|'erg'|'conditioning'|'sled'|'other'`); passing a generic `string` to `eq()` fails `tsc --build` (root `pnpm run typecheck`) with "No overload matches this call."
- **Fix:** Narrowed the parameter type to the literal union matching the schema's enum values.
- **Files modified:** packages/db/src/queries.ts
- **Verification:** `pnpm run typecheck` from repo root — the queries.ts error is gone; only the two pre-existing deferred router.push errors (documented in STATE.md, out of scope) remain.
- **Committed in:** 2bc5574 (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 bug fix)
**Impact on plan:** Necessary for correctness under the project's strict typecheck gate. No scope creep.

## Issues Encountered
None beyond the type-narrowing fix documented above.

## User Setup Required
None - no external service configuration required. (The HealthKit entitlement/Apple Developer capability flagged in 05-RESEARCH.md is scoped to a different plan's install/build task, not this one.)

## Next Phase Readiness
- Schema, query builder, and migration are in place for 05-03 (pure mapping/dedupe logic) and 05-04 (import) to consume directly.
- Root `pnpm run typecheck` is clean of any new errors introduced by this plan (two pre-existing deferred errors remain, unrelated to this plan's files).
- `pnpm --filter @apsis/db test` (via `pnpm vitest run` in packages/db) passes 7 files / 31 tests, including the new 4-test dedupe-candidate-query suite.

---
*Phase: 05-healthkit-integration*
*Completed: 2026-07-11*

## Self-Check: PASSED

All created files verified present on disk; all task/summary commit hashes (2bc5574, 043f74c, 1d6dfe4) verified in git log.
