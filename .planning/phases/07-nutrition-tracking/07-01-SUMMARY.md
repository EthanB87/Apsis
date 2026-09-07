---
phase: 07-nutrition-tracking
plan: 01
subsystem: database
tags: [drizzle, sqlite, migration, nutrition, better-sqlite3, requirements]

# Dependency graph
requires:
  - phase: 01-foundation
    provides: "packages/db workspace, drizzle schema/migration pipeline (drizzle-kit expo driver, inline-import .sql bundling)"
  - phase: 04-home-trends
    provides: "load_daily table + schema conventions (named indexes, enum columns, timestamp defaults)"
provides:
  - "5 nutrition tables (food, food_log, recipe, recipe_ingredient, nutrition_target) live via committed 0004 migration"
  - "user_profile.height_cm / birth_year / goal_mode nullable columns for adaptive targets (NUTR-15)"
  - "drizzle exports: food, foodLog, recipe, recipeIngredient, nutritionTarget"
  - "NUTR-01..NUTR-22 granular requirement set + Phase 07 traceability rows in REQUIREMENTS.md"
  - "Real-SQLite migration round-trip test harness (better-sqlite3, journal-order apply) — first in the repo"
affects: [07-nutrition-tracking plans 02-10, nutrition queries, adaptive targets, verify-work]

# Tech tracking
tech-stack:
  added: ["better-sqlite3@^11.10.0 (devDependency of @apsis/db only — never in the mobile bundle)", "@types/better-sqlite3@^7.6.13"]
  patterns: ["migration round-trip proof: apply committed drizzle .sql files in journal order to in-memory better-sqlite3 with foreign_keys=ON, assert via drizzle query builders"]

key-files:
  created:
    - packages/db/drizzle/0004_youthful_valkyrie.sql
    - packages/db/drizzle/meta/0004_snapshot.json
    - packages/db/src/__tests__/nutrition-schema.test.ts
  modified:
    - packages/db/src/schema.ts
    - packages/db/drizzle/migrations.js
    - packages/db/drizzle/meta/_journal.json
    - packages/db/package.json
    - pnpm-lock.yaml
    - .planning/REQUIREMENTS.md

key-decisions:
  - "better-sqlite3 pinned to ^11.10.0 (not 12.x): v12 dropped Node 20 ABI-115 prebuilds, forcing node-gyp compilation this Windows host cannot do; v11.10.0 ships a node-v115-win32-x64 prebuilt binary — installed with zero compilation after user legitimacy approval"
  - "Round-trip test applies ALL committed migrations (0000..0004) in journal order, not just 0004 — proves the full on-device chain including 0004 against the pre-existing schema"
  - "Test enables PRAGMA foreign_keys=ON to make cascade assertions real (SQLite defaults FK enforcement off)"
  - "No per-user owner column on any new table (RESEARCH Pitfall 4) — matches single-local-user convention"

patterns-established:
  - "Migration proof pattern: typecheck never proves the DB is migrated; a committed-SQL round-trip test does (schema_push_requirement)"
  - "food_log macros denormalized (kcal/p/c/f frozen at log time) — editing a food never rewrites logged history"

requirements-completed: [NUTR-01, NUTR-07, NUTR-15]

coverage:
  - id: D1
    description: "5 nutrition tables (food, food_log, recipe, recipe_ingredient, nutrition_target) created by committed 0004 migration"
    requirement: NUTR-01
    verification:
      - kind: integration
        ref: "packages/db/src/__tests__/nutrition-schema.test.ts#the committed journal includes 0004 and every migration applies cleanly"
        status: pass
      - kind: integration
        ref: "packages/db/src/__tests__/nutrition-schema.test.ts#round-trips a food row (+ food_log/recipe/recipe_ingredient/nutrition_target round-trips)"
        status: pass
    human_judgment: false
  - id: D2
    description: "recipe_ingredient cascades on recipe delete; foodId FK does NOT cascade"
    requirement: NUTR-01
    verification:
      - kind: integration
        ref: "packages/db/src/__tests__/nutrition-schema.test.ts#deleting a recipe cascades to its recipe_ingredient rows"
        status: pass
      - kind: integration
        ref: "packages/db/src/__tests__/nutrition-schema.test.ts#deleting a food referenced by an ingredient is rejected"
        status: pass
    human_judgment: false
  - id: D3
    description: "user_profile gains nullable height_cm, birth_year, goal_mode (existing rows keep NULL)"
    requirement: NUTR-15
    verification:
      - kind: integration
        ref: "packages/db/src/__tests__/nutrition-schema.test.ts#user_profile accepts NULL for height_cm, birth_year, and goal_mode"
        status: pass
    human_judgment: false
  - id: D4
    description: "NUTR-01..NUTR-22 granular requirements + 22 Phase 07 traceability rows in REQUIREMENTS.md; stale v1.1 placeholder removed"
    requirement: NUTR-01
    verification:
      - kind: other
        ref: "grep -cE '^\\- \\[ \\] \\*\\*NUTR-' .planning/REQUIREMENTS.md == 22 (Task 1 acceptance criteria, verified by prior executor)"
        status: pass
    human_judgment: false

# Metrics
duration: 37min
completed: 2026-07-13
status: complete
---

# Phase 07 Plan 01: Nutrition Data Foundation Summary

**5 nutrition tables + 3 adaptive-target profile columns shipped via committed drizzle 0004 migration, proven real by a better-sqlite3 round-trip test that applies the full journal chain and verifies cascade semantics**

## Performance

- **Duration:** 37 min (16:12 → 16:49 local, spanning two executor sessions + one package-legitimacy checkpoint)
- **Started:** 2026-07-13T20:12:28Z
- **Completed:** 2026-07-13T20:49:35Z
- **Tasks:** 3
- **Files modified:** 9

## Accomplishments

- `food`, `food_log`, `recipe`, `recipe_ingredient`, `nutrition_target` tables defined in schema.ts following existing conventions (enum columns, named indexes, unixepoch timestamp defaults, no per-user owner column) and created on-device via committed `0004_youthful_valkyrie.sql`
- `user_profile` extended with nullable `height_cm`, `birth_year`, `goal_mode` for Mifflin-St Jeor BMR / adaptive targets (NUTR-15) — existing rows keep NULL
- First real-SQLite test in the repo: applies the committed migration .sql files in journal order to an in-memory better-sqlite3 db with FK enforcement on, round-trips one row per new table, and proves `recipe → recipe_ingredient` cascade + no-cascade on `foodId` + NULLable profile columns
- NUTR-01..NUTR-22 formalized in REQUIREMENTS.md with 22 Phase 07 traceability rows; stale v1.1 placeholder removed

## Task Commits

Each task was committed atomically:

1. **Task 1: Add granular NUTR-01..22 requirements + traceability** - `89e4453` (docs)
2. **Task 2: Extend schema.ts with 5 nutrition tables + 3 profile fields** - `1877917` (feat)
3. **Task 3: Generate 0004 migration + round-trip proof test** - `02edc5d` (feat)

## Files Created/Modified

- `packages/db/src/schema.ts` - 5 new sqliteTable exports + 3 userProfile columns; module doc updated to eleven-table schema
- `packages/db/drizzle/0004_youthful_valkyrie.sql` - generated migration: 5 CREATE TABLE + 2 indexes + 3 ALTER TABLE user_profile ADD
- `packages/db/drizzle/migrations.js` / `meta/_journal.json` / `meta/0004_snapshot.json` - regenerated by drizzle-kit (append-only, never hand-edited)
- `packages/db/src/__tests__/nutrition-schema.test.ts` - 8-test round-trip suite (migration apply, per-table round-trips, cascade, FK rejection, NULL profile columns)
- `packages/db/package.json` / `pnpm-lock.yaml` - better-sqlite3@^11.10.0 + @types as devDependencies of @apsis/db only
- `.planning/REQUIREMENTS.md` - NUTR-01..22 requirement set + traceability rows

## Decisions Made

- **better-sqlite3 pinned ^11.10.0, not latest 12.x** — v12 dropped Node 20 (ABI 115) prebuilt binaries; this host lacks a VC++ toolset so node-gyp compilation fails. v11.10.0 ships a `node-v115-win32-x64` prebuild and installed with zero compilation. Dev-only dependency of packages/db; never enters the mobile bundle (op-sqlite remains the on-device driver).
- **Test applies the full migration chain (0000..0004) in journal order** rather than just 0004 — mirrors exactly what `useMigrations()` executes on-device and proves 0004 applies cleanly against the real prior schema.
- **`PRAGMA foreign_keys = ON` in the test harness** — SQLite defaults FK enforcement off; without it the cascade assertions would vacuously pass.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] better-sqlite3 v12.x native install failure → pinned to ^11.10.0**
- **Found during:** Task 3 (round-trip test infrastructure)
- **Issue:** `pnpm add -D better-sqlite3` resolved to 12.11.1, which has no Node 20 prebuilds; node-gyp compilation failed (no VC++ toolset / Windows SDK on host)
- **Fix:** Surfaced as checkpoint per user instruction (not silently downgraded); orchestrator/user approved pinning `better-sqlite3@^11.10.0`, which ships a node-v115-win32-x64 prebuilt binary — installed and verified loading with zero compilation
- **Files modified:** packages/db/package.json, pnpm-lock.yaml
- **Verification:** `node -e "require('better-sqlite3')(':memory:')"` prints ok; full test suite green
- **Committed in:** `02edc5d` (Task 3 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking, resolved via human-verified package pin per package-install checkpoint policy)
**Impact on plan:** None on scope — the test is exactly as specified. The pin is dev-only and invisible to the app bundle.

## Issues Encountered

- Task 3 execution spanned a package-legitimacy checkpoint (better-sqlite3 install approval) and a native-toolchain failure checkpoint (v12 node-gyp); both resolved without modifying the host toolchain. Documented above.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Data foundation complete: every other Phase 07 plan can now read/write the 5 nutrition tables and the 3 profile fields with a committed, test-proven migration behind them
- Ready for 07-02 (Wave 1 sibling plans / Wave 2 per phase plan ordering)
- Note for downstream: the on-device DB gets these tables only after the next app launch runs `useMigrations` — no EAS build needed (SQL is bundled via inline-import), but UAT requires an app restart

## Self-Check: PASSED

- `packages/db/drizzle/0004_youthful_valkyrie.sql` — FOUND
- `packages/db/drizzle/meta/0004_snapshot.json` — FOUND
- `packages/db/src/__tests__/nutrition-schema.test.ts` — FOUND
- Commit `89e4453` — FOUND
- Commit `1877917` — FOUND
- Commit `02edc5d` — FOUND
- `pnpm --filter @apsis/db test` — 42/42 pass
- root `pnpm typecheck` — clean

---
*Phase: 07-nutrition-tracking*
*Completed: 2026-07-13*
