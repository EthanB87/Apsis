---
phase: 05-healthkit-integration
plan: 03
subsystem: healthkit
tags: [healthkit, vitest, drizzle, pure-function, authorization, sync-state]

requires:
  - phase: 05-healthkit-integration (05-01)
    provides: "@kingstinct/react-native-healthkit@14.0.2 + react-native-nitro-modules installed and config-plugin wired"
  - phase: 05-healthkit-integration (05-02)
    provides: "workout.source/healthkitUuid + user_profile.bodyweightSetAt/healthkitConnected/healthkitLastSyncAt/healthkitAnchor schema columns, candidatesForDedupe query builder"
provides:
  - "Pure, vitest-tested HK decision logic: activity-type mapping, dedupe tolerance, bodyweight recency, HSS write-back metadata shaping, hostile-numeric clamping"
  - "Centralized HealthKit authorization identifier sets + a never-throw request wrapper"
  - "Single drizzle-backed, never-throw accessor for the four HK sync-state columns"
affects: [05-05 (import engine), 05-06 (write-back engine), 05-07 (onboarding/settings UI wiring foreground sync)]

tech-stack:
  added: []
  patterns:
    - "Local numeric constant mirror of a native library's TypeScript enum, used when importing the real enum value transitively pulls in a native module and breaks vitest"
    - "Plain async functions (not hooks) for sync-state CRUD, reused by both import/write-back services and a future AppState-driven hook"

key-files:
  created:
    - apps/mobile/lib/healthkitMapping.ts
    - apps/mobile/lib/__tests__/healthkitMapping.test.ts
    - apps/mobile/lib/healthkitAuth.ts
    - apps/mobile/lib/healthkitSyncState.ts
  modified: []

key-decisions:
  - "mapHKActivityType keys off a locally-declared HK_ACTIVITY_TYPE numeric constant table (not an import of the library's WorkoutActivityType enum) because importing any value from @kingstinct/react-native-healthkit transitively requires('react-native') inside its commonjs build, which throws under plain Node/vitest -- documented in the file header and verified empirically before writing code"
  - "healthkitAuth.ts imports the real library's requestAuthorization/WorkoutTypeIdentifier directly (unlike healthkitMapping.ts) since it is the impure wrapper, not a vitest-tested pure module -- no purity constraint applies to it"
  - "healthkitSyncState.ts read/write helpers are plain async functions taking a DB parameter, not hooks, matching the plan's requirement that healthkitImport.ts and useForegroundHealthKitSync.ts (later plans) can call them directly"

requirements-completed: [HK-01, HK-02, HK-03, HK-04]

coverage:
  - id: D1
    description: "mapHKActivityType maps HK workout activity types to run/erg/conditioning/null per the locked D-04/D-05 allowlist"
    requirement: HK-01
    verification:
      - kind: unit
        ref: "apps/mobile/lib/__tests__/healthkitMapping.test.ts#mapHKActivityType (D-04)"
        status: pass
    human_judgment: false
  - id: D2
    description: "isDuplicateOfExisting flags candidates within the +/-15% duration tolerance (D-06), including exact boundary cases"
    requirement: HK-03
    verification:
      - kind: unit
        ref: "apps/mobile/lib/__tests__/healthkitMapping.test.ts#isDuplicateOfExisting (D-06)"
        status: pass
    human_judgment: false
  - id: D3
    description: "bodyweightSampleIsNewer resolves the D-17 most-recent-wins conflict, including the null-profile and same-instant edge cases"
    requirement: HK-02
    verification:
      - kind: unit
        ref: "apps/mobile/lib/__tests__/healthkitMapping.test.ts#bodyweightSampleIsNewer (D-17)"
        status: pass
    human_judgment: false
  - id: D4
    description: "buildHSSMetadata produces a calorie-free, single-key (ApsisHSS) write-back metadata payload (D-13)"
    requirement: HK-04
    verification:
      - kind: unit
        ref: "apps/mobile/lib/__tests__/healthkitMapping.test.ts#buildHSSMetadata (D-13)"
        status: pass
    human_judgment: false
  - id: D5
    description: "sanitizeHKNumeric clamps/discards hostile HK numerics (negative distance, NaN/Infinity duration, above-max) and never throws (V5/T-05-02)"
    verification:
      - kind: unit
        ref: "apps/mobile/lib/__tests__/healthkitMapping.test.ts#sanitizeHKNumeric (V5/T-05-02)"
        status: pass
    human_judgment: false
  - id: D6
    description: "healthkitAuth.ts centralizes HK_READ_TYPES (workout+HR+bodyweight) and HK_WRITE_TYPES (workout-only, D-18) and requests both once via requestHealthKitAuthorization"
    requirement: HK-01
    verification:
      - kind: other
        ref: "grep -q HKQuantityTypeIdentifierBodyMass && grep -q HK_WRITE_TYPES lib/healthkitAuth.ts"
        status: pass
    human_judgment: false
  - id: D7
    description: "healthkitSyncState.ts's getSyncState/setSyncState cover all four sync columns via parameterized drizzle builders and never throw on write failure (D-25)"
    verification:
      - kind: other
        ref: "grep getSyncState/setSyncState/healthkitAnchor lib/healthkitSyncState.ts"
        status: pass
    human_judgment: false

duration: 10min
completed: 2026-07-11
status: complete
---

# Phase 05 Plan 03: HealthKit Pure Logic + Auth + Sync State Summary

**Pure vitest-tested HK decision logic (type mapping, dedupe, bodyweight recency, HSS metadata, numeric clamping) plus centralized authorization and drizzle-backed sync-state accessors, ready for the import/write-back engines to compose.**

## Performance

- **Duration:** ~10 min
- **Started:** 2026-07-11T23:05:24Z
- **Completed:** 2026-07-11T23:13:54Z
- **Tasks:** 3
- **Files modified:** 4 (all new)

## Accomplishments
- `healthkitMapping.ts`: zero-I/O pure module covering activity-type mapping (D-04/D-05), duration-tolerance dedupe (D-06), bodyweight recency (D-17), calorie-free HSS metadata shaping (D-13), and clamp-and-warn numeric sanitization (V5/T-05-02) — 21 vitest tests, all green
- `healthkitAuth.ts`: single source-of-truth `HK_READ_TYPES`/`HK_WRITE_TYPES` identifier sets (D-18) and a never-throw `requestHealthKitAuthorization()` wrapper requesting both once (Pitfall 5)
- `healthkitSyncState.ts`: `getSyncState`/`setSyncState` plain async functions covering `healthkitConnected`/`healthkitAnchor`/`healthkitLastSyncAt`/`bodyweightSetAt` on the single `user_profile` row, parameterized `eq`-on-id only, write failures caught and logged (never thrown, D-25)

## Task Commits

Each task was committed atomically (Task 1 as a TDD RED/GREEN pair):

1. **Task 1: Pure healthkitMapping.ts + vitest tests** — `9b53671` (test, RED) → `45b63ce` (feat, GREEN)
2. **Task 2: healthkitAuth.ts** — `86dfccc` (feat)
3. **Task 3: healthkitSyncState.ts** — `5b81eaf` (feat)

**Plan metadata:** (this commit)

## Files Created/Modified
- `apps/mobile/lib/healthkitMapping.ts` — pure activity-type mapping, dedupe, bodyweight recency, HSS metadata builder, numeric sanitizer
- `apps/mobile/lib/__tests__/healthkitMapping.test.ts` — 21 vitest cases covering all five pure functions
- `apps/mobile/lib/healthkitAuth.ts` — `HK_READ_TYPES`, `HK_WRITE_TYPES`, `requestHealthKitAuthorization`
- `apps/mobile/lib/healthkitSyncState.ts` — `getSyncState`, `setSyncState`, `HealthKitSyncState`/`HealthKitSyncStatePatch` types

## Decisions Made
- Empirically verified (via a throwaway Node `require` of the shipped commonjs build) that importing any value from `@kingstinct/react-native-healthkit` transitively `require('react-native')`, which throws under plain Node — confirmed the plan's anticipated fallback was necessary rather than optional, and declared `HK_ACTIVITY_TYPE` as a local numeric mirror of the real `WorkoutActivityType` enum (values read directly from the shipped `.d.ts`) instead.
- `healthkitAuth.ts` imports the real library's `requestAuthorization`/`WorkoutTypeIdentifier` directly since it's the impure wrapper (not vitest-scoped) — no purity constraint applies there, unlike `healthkitMapping.ts`.
- Kept comments describing the purity contract phrased as "the workspace db package" rather than the literal string `@apsis/db`, since the plan's grep-based purity acceptance criterion (`grep -n "@apsis/db" ...` returns nothing) checks the literal string anywhere in the file, including comments.

## Deviations from Plan

None - plan executed exactly as written. The `HK_ACTIVITY_TYPE` local-constant fallback was explicitly anticipated in the plan's `<action>` text ("if importing the enum VALUE breaks vitest ... instead key the mapping off a locally-declared numeric/string constant table") and confirmed necessary by direct testing, not treated as a deviation.

## Issues Encountered
None — all three tasks' automated verification commands passed on first implementation. Root `pnpm run typecheck` shows only the two pre-existing deferred errors (`app/onboarding/review.tsx`, `components/ExternalLink.tsx`) already documented in STATE.md/03 deferred-items.md; no new typecheck errors introduced by this plan.

## User Setup Required

None - no external service configuration required. (The phase-level EAS dev build / Apple Developer HealthKit entitlement gate remains tracked against 05-01's in-flight checkpoint, not this plan.)

## Next Phase Readiness
- All three artifacts (`healthkitMapping.ts`, `healthkitAuth.ts`, `healthkitSyncState.ts`) are ready for `healthkitImport.ts` (05-05) and `healthkitWriteback.ts` (05-06) to compose without any further pure-logic/auth/sync-state work.
- On-device verification of the actual HealthKit permission sheet and sync reads/writes remains blocked on the pending EAS dev build (provisioning-profile fix) noted in 05-01 — this plan's scope was fully coverable by unit tests/grep per its own verification section, so it is not blocked by that.

---
*Phase: 05-healthkit-integration*
*Completed: 2026-07-11*

## Self-Check: PASSED

All created files verified present on disk; all task/summary commits (9b53671, 45b63ce, 86dfccc, 5b81eaf, 9fb83de) verified present in git log.
