---
phase: 06-polish-app-store-submission
plan: 03
subsystem: database
tags: [seed-data, exercise-catalog, drizzle, hss, bwFactor, tdd]

# Dependency graph
requires:
  - phase: 02-hss-engine
    provides: strength/bodyweight e1RM scoring (packages/engine/src/bodyweight.ts) that consumes bwFactor
  - phase: 03-lifting
    provides: computeEffectiveLoad (apps/mobile/lib/effectiveLoad.ts) that applies bwFactor at commit time
provides:
  - STARTER_EXERCISES expanded from 43 to 152 curated movements (barbell/DB/KB lifts and variations, machines, cable work, Olympic lifts, HYROX/tactical movements, cardio, core)
  - D-14 fix: ab-wheel and hanging-leg-raise now have curated non-null bwFactor (0.25, 0.35) instead of null, so they score honest non-zero HSS at 0 entered external load
  - Extended seed.test.ts fixture maps (BODYWEIGHT_FACTORS, TIMED_IDS, ENDURANCE_IDS) covering the full 152-entry catalog
affects: [07-testflight-submission]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Exercise catalog additions grouped under existing STARTER_EXERCISES section comments (lower/upper/Olympic/HYROX/tactical/cardio/core), matching the established in-place-additive pattern"
    - "Bodyweight-moved entries always non-null bwFactor + entryMode 'reps'; timed entries always bwFactor null regardless of body-moved status; pure-cardio endurance entries always bwFactor null + entryMode null"

key-files:
  created: []
  modified:
    - packages/db/src/seed.ts
    - packages/db/src/__tests__/seed.test.ts

key-decisions:
  - "D-14 bwFactor curation: ab-wheel 0.25 (kneeling rollout, most bodyweight still supported by knees/feet), hanging-leg-raise 0.35 (full hang, longer lever through hip flexors/core) — Claude's-discretion biomechanics estimates per D-14, asserted by fixed test fixtures"
  - "New timed movements (bear-crawl, sandbag-carry, mountain-climber, side-plank, etc.) always get bwFactor: null even when bodyweight-moved, per the plan's explicit 'every new timed movement is entryMode timed/bwFactor null' rule and the existing TIMED_IDS test invariant"
  - "24 new bodyweight-moved entries curated with bwFactor in (0,1] following push-up-style semantics (load field = added external weight only); 67 new externally-loaded entries use bwFactor: null; 6 new pure-cardio entries use bwFactor: null + entryMode: null"

patterns-established:
  - "Exercise catalog growth is purely additive to STARTER_EXERCISES + fixture-map extension in seed.test.ts — no schema/migration changes, backfilled automatically via the existing onConflictDoUpdate upsert"

requirements-completed: [REL-01]

coverage:
  - id: D1
    description: "STARTER_EXERCISES expanded from 43 to 152 curated movements (>= 150 target), all unique ids, no duplicates"
    requirement: "REL-01"
    verification:
      - kind: unit
        ref: "packages/db/src/__tests__/seed.test.ts#has >= 150 entries"
        status: pass
      - kind: unit
        ref: "packages/db/src/__tests__/seed.test.ts#all ids are unique (no duplicates)"
        status: pass
    human_judgment: false
  - id: D2
    description: "ab-wheel and hanging-leg-raise (D-14) have curated non-null bwFactor and entryMode 'reps', fixing the ~0 HSS bug at 0 entered external load"
    requirement: "REL-01"
    verification:
      - kind: unit
        ref: "packages/db/src/__tests__/seed.test.ts#every bodyweight movement has its literature-anchored bwFactor and entryMode \"reps\""
        status: pass
    human_judgment: false
  - id: D3
    description: "Every new bodyweight-moved entry follows push-up-style semantics; every new timed movement is entryMode timed/bwFactor null; every new pure-cardio entry is entryMode null/bwFactor null"
    requirement: "REL-01"
    verification:
      - kind: unit
        ref: "packages/db/src/__tests__/seed.test.ts#every timed movement has entryMode \"timed\" and bwFactor null"
        status: pass
      - kind: unit
        ref: "packages/db/src/__tests__/seed.test.ts#every endurance-type seed row has bwFactor null and entryMode null (Pitfall 5)"
        status: pass
    human_judgment: false
  - id: D4
    description: "The change requires no migration — rides the existing idempotent per-id upsert; schema.ts and seedExercises() upsert body unmodified"
    requirement: "REL-01"
    verification:
      - kind: other
        ref: "git diff --stat packages/db/src/schema.ts (empty) + git status --short packages/db/drizzle/ (no new file)"
        status: pass
    human_judgment: false

# Metrics
duration: 12min
completed: 2026-07-12
status: complete
---

# Phase 6 Plan 3: Exercise Catalog Expansion Summary

**Expanded STARTER_EXERCISES from 43 to 152 curated HYROX/tactical/strength/conditioning movements and fixed the ab-wheel/hanging-leg-raise D-14 zero-HSS bug — zero migration, fully backfilled via the existing idempotent upsert.**

## Performance

- **Duration:** 12 min
- **Started:** 2026-07-12T15:23:00Z
- **Completed:** 2026-07-12T15:35:18Z
- **Tasks:** 2 (TDD: RED + GREEN)
- **Files modified:** 2

## Accomplishments
- Extended `packages/db/src/__tests__/seed.test.ts` fixture maps (BODYWEIGHT_FACTORS, TIMED_IDS, ENDURANCE_IDS) and raised the count assertion to `>= 150`, confirmed RED against the pre-existing 43-entry array
- Expanded `STARTER_EXERCISES` in `packages/db/src/seed.ts` from 43 to 152 curated, unique entries: 25 new lower-body movements, 41 new upper-body movements (including 13 machine/cable/isolation additions), 7 Olympic/power lifts, 10 new HYROX-specific movements, 8 new tactical/strongman movements, 6 new pure-cardio conditioning movements, and 12 new core movements
- Fixed D-14: `ab-wheel` (bwFactor 0.25) and `hanging-leg-raise` (bwFactor 0.35) now score honest non-zero HSS at 0 entered external load, instead of the previous `bwFactor: null` bug
- Confirmed GREEN: full `@apsis/db` test suite (33 tests) and full workspace test suite (`pnpm -r test`, 172 tests across shared/engine/db/mobile) pass
- Verified no schema/migration surface was touched: `packages/db/src/schema.ts` unmodified, no new file under `packages/db/drizzle/`, `seedExercises()` upsert body byte-identical

## Task Commits

Each task was committed atomically:

1. **Task 1: Extend seed tests for ~150 entries + D-14 fix (RED)** - `0f8498e` (test)
2. **Task 2: Expand STARTER_EXERCISES to ~150 + D-14 bwFactor fix (GREEN)** - `d34d101` (feat)

_TDD plan: test (RED) → feat (GREEN); no REFACTOR commit needed — the additive array pattern required no cleanup._

## Files Created/Modified
- `packages/db/src/seed.ts` - STARTER_EXERCISES expanded 43 → 152 entries; ab-wheel/hanging-leg-raise D-14 bwFactor fix; header comments updated (>= 40 → ~150)
- `packages/db/src/__tests__/seed.test.ts` - count assertion raised to >= 150; BODYWEIGHT_FACTORS/TIMED_IDS/ENDURANCE_IDS extended to cover all new D-13 entries plus the D-14 fix

## Decisions Made
- **D-14 bwFactor values:** ab-wheel 0.25, hanging-leg-raise 0.35 — biomechanics-informed estimates reflecting that a kneeling ab-wheel rollout still has significant ground support (knees/feet) versus a full dead-hang leg raise where the entire body weight is suspended through a longer lever arm via the hip flexors/core. Both exceed the RESEARCH.md illustrative placeholders (0.30/0.20) after this deeper biomechanical comparison; Claude's discretion per D-14, values match the Task 1 test fixtures.
- **New bodyweight-moved entries (24 total):** curated bwFactor values ranged 0.15 (crunch, dead-bug, bird-dog — minimal core-only lever) up to 1.0 (muscle-up — full bodyweight + explosive transition), following the same push-up-style semantics established for all existing bodyweight movements (load field = added external weight only, computeEffectiveLoad adds the bodyweight contribution).
- **Timed-movement invariant:** every new timed entry (bear-crawl, mountain-climber, side-plank, sandbag-carry, etc.) uses `bwFactor: null` even where the movement is clearly bodyweight-moved (e.g. bear-crawl), per the plan's explicit rule and the pre-existing `TIMED_IDS` test invariant that all timed movements have `bwFactor: null` — this keeps the existing test's semantics consistent rather than introducing a new bodyweight+timed category.
- **Exercise naming/categorization** cross-referenced general HYROX/strength-training conventions for names and body-part/type classification only; no public dataset's bwFactor values were copied (per D-13, no public dataset carries Apsis's HSS-specific bodyweight-load semantics).

## Deviations from Plan

None - plan executed exactly as written. The full ~150-entry design (109 new entries reaching 152 total) was planned upfront before Task 1 so the RED-phase test fixtures and GREEN-phase seed data stayed consistent, as the plan required ("Keep the values in the fixture maps consistent with the values you will write into seed.ts in Task 2").

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required. This is a pure data-layer change that ships via the existing app-launch seed upsert.

## Next Phase Readiness
- The exercise catalog is ready for the July 15 beta build with a full ~150-entry library and the D-14 zero-HSS bug fixed.
- No blockers for continuing Phase 6 (remaining plans: Sentry crash reporting was already completed in 06-02; icon/metadata/screenshots, privacy policy, and EAS build/submit pipeline remain).
- Wave 1 dependency graph: this plan had no `depends_on` and does not block other Phase 6 plans — it is independent data-layer content work that can land in the same EAS build cycle as 06-02's Sentry install per the phase's build-order guidance (RESEARCH.md: "land Sentry + catalog fixes in ONE EAS build cycle").

---
*Phase: 06-polish-app-store-submission*
*Completed: 2026-07-12*

## Self-Check: PASSED

- FOUND: packages/db/src/seed.ts
- FOUND: packages/db/src/__tests__/seed.test.ts
- FOUND: .planning/phases/06-polish-app-store-submission/06-03-SUMMARY.md
- FOUND commit: 0f8498e (test RED)
- FOUND commit: d34d101 (feat GREEN)
- Re-ran plan-level `<verification>`: `pnpm --filter @apsis/db test` green (33/33), STARTER_EXERCISES.length === 152, ab-wheel/hanging-leg-raise non-null bwFactor asserted, no new file under packages/db/drizzle/
