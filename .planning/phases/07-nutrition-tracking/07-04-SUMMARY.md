---
phase: 07-nutrition-tracking
plan: 04
subsystem: nutrition
tags: [drizzle, expo-router, vitest, staged-draft, profile-gate]

# Dependency graph
requires:
  - phase: 07-nutrition-tracking (Plan 01)
    provides: user_profile.heightCm/birthYear/goalMode columns (nullable)
  - phase: 07-nutrition-tracking (Plan 02)
    provides: "@apsis/shared NutritionProfile/MacroTargetResult/DayType types"
provides:
  - "buildNutritionProfile/isNutritionProfileComplete pure assembler (never coerces NULL to 0)"
  - "useNutritionProfile hook: { profile, complete, loading } re-checked on useProfileVersion bump"
  - "Nutrition Setup standalone screen collecting height/birth year/goal mode via one batched UPDATE"
affects: [07-05, 07-06, 07-nutrition-tab]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Pure lib module + impure hook split (mirrors runEntryLogic.ts) for a profile-gate assembler"
    - "Standalone non-onboarding gate screen for retrofitting new profile fields onto existing installs"

key-files:
  created:
    - apps/mobile/lib/nutritionProfile.ts
    - apps/mobile/lib/__tests__/nutritionProfile.test.ts
    - apps/mobile/hooks/useNutritionProfile.ts
    - apps/mobile/app/nutrition-setup/index.tsx
    - apps/mobile/app/nutrition-setup/_layout.tsx
  modified:
    - apps/mobile/hooks/useProfile.ts

key-decisions:
  - "buildNutritionProfile returns null (not a 0-coerced profile) when any of sex/bodyweightKg/heightCm/birthYear/goalMode is missing — Pitfall 3/T-07-07"
  - "currentYear computed in the hook layer (useNutritionProfile), never inside the pure lib module — matches engine purity convention"
  - "Extended useProfile.ts's ProfileUpdateInput with heightCm/birthYear/goalMode (Rule 2 deviation, outside declared files) so nutrition-setup can reuse the existing update-in-place hook for its single batched UPDATE, per the plan's explicit instruction"
  - "Height entry branches on the profile's stored units: metric shows one cm field, imperial shows feet+inches (mirrors the pace min:sec two-field pattern in Settings); always converted to metric cm before the UPDATE"
  - "goalMode segmented control uses bone active-fill (not volt) since Save is already the one volt-filled CTA on the screen (DESIGN-SYSTEM.md one-volt-per-screen rule)"
  - "Save navigates back via router.back() when possible, else router.replace('/(tabs)') — the nutrition tab route itself doesn't exist yet (Plan 05) so it can't be a typed-route target here"

patterns-established:
  - "Pattern: retrofitting new required profile fields onto an already-onboarded install base uses a standalone gated prompt screen (not a new onboarding wizard step), following ONB-03's 'never show wrong numbers until complete' shape applied to a field subset"

requirements-completed: [NUTR-15, NUTR-20]

coverage:
  - id: D1
    description: "Pure NutritionProfile assembler + completeness gate never coerces a missing field to 0"
    requirement: NUTR-15
    verification:
      - kind: unit
        ref: "apps/mobile/lib/__tests__/nutritionProfile.test.ts#buildNutritionProfile"
        status: pass
    human_judgment: false
  - id: D2
    description: "useNutritionProfile hook returns a typed profile + complete flag, re-checking after profile-version bumps"
    requirement: NUTR-20
    verification: []
    human_judgment: true
    rationale: "Live re-check behavior against a real op-sqlite DB after a write requires on-device/simulator verification — no test harness exercises hooks against the native DB layer (documented apps/mobile gap, STATE.md)."
  - id: D3
    description: "Nutrition Setup screen collects height/birth year/goal mode via one batched UPDATE and bumps the profile-version gate"
    requirement: NUTR-15
    verification:
      - kind: other
        ref: "pnpm --filter @apsis/mobile exec tsc --noEmit (clean) + grep -cE 'height_cm|heightCm|birthYear|goalMode|goal_mode' (21 hits)"
        status: pass
    human_judgment: true
    rationale: "Visual/UX adequacy (DESIGN-SYSTEM.md compliance, keyboard behavior, feet/inches entry feel) needs a human on-device pass; deferred to phase UAT per the plan's own verification block."

# Metrics
duration: 12min
completed: 2026-07-13
status: complete
---

# Phase 07 Plan 04: Nutrition Setup Gate Summary

**Pure NutritionProfile assembler (never NULL→0 coerced) plus a standalone staged-draft Nutrition Setup screen so already-onboarded users can supply height/birth year/goal mode before any adaptive target renders.**

## Performance

- **Duration:** 12 min
- **Started:** 2026-07-13T21:13:20Z
- **Completed:** 2026-07-13T21:25:18Z
- **Tasks:** 2
- **Files modified:** 6 (5 created, 1 modified)

## Accomplishments

- `buildNutritionProfile`/`isNutritionProfileComplete` (apps/mobile/lib/nutritionProfile.ts): pure, vitest-testable, zero database/native imports, derives `age` from a passed-in `currentYear`, never coerces a missing field to `0`
- `useNutritionProfile` hook: reads the singleton `user_profile` row, re-runs on `useProfileVersion` bumps, returns `{ profile, complete, loading }`
- Nutrition Setup standalone screen (`apps/mobile/app/nutrition-setup/`): collects height (units-aware cm or feet+inches entry), birth year (bounds-validated), and goal mode (cut/maintain/bulk segmented control), commits all three in one `useProfile().update()` call, bumps the profile-version signal on success

## Task Commits

1. **Task 1: Pure NutritionProfile assembler + completeness gate + hook** - `8cf8f70` (feat)
2. **Task 2: Nutrition Setup staged-draft screen** - `b9109bf` (feat)

**Plan metadata:** pending (this commit)

## Files Created/Modified

- `apps/mobile/lib/nutritionProfile.ts` - pure assembler + completeness gate
- `apps/mobile/lib/__tests__/nutritionProfile.test.ts` - 7 tests (complete row, each missing field)
- `apps/mobile/hooks/useNutritionProfile.ts` - gate hook wired to `useProfileVersion`
- `apps/mobile/app/nutrition-setup/index.tsx` - staged-draft setup screen
- `apps/mobile/app/nutrition-setup/_layout.tsx` - Stack registration
- `apps/mobile/hooks/useProfile.ts` - extended `ProfileUpdateInput` with `heightCm`/`birthYear`/`goalMode`

## Decisions Made

See `key-decisions` in frontmatter — most notably: `buildNutritionProfile` fails closed to `null` rather than fabricating a `0` value from a missing field, and the setup screen reuses (rather than duplicates) `useProfile`'s update-in-place path by extending its patch type.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Extended `useProfile.ts`'s `ProfileUpdateInput` with `heightCm`/`birthYear`/`goalMode`**
- **Found during:** Task 2 (Nutrition Setup screen)
- **Issue:** The plan directs reusing "the existing update-in-place profile hook" for a single batched UPDATE of the three new fields, but `useProfile.ts`'s `ProfileUpdateInput` interface (a file outside this plan's declared `files_modified`) only covered the original onboarding fields (sex/bodyweight/thresholds/units/rest timer) — passing `heightCm`/`birthYear`/`goalMode` into `update()` would not typecheck.
- **Fix:** Added three optional fields to `ProfileUpdateInput` with a doc comment noting the Phase 07 addition; the underlying `db.update(userProfile).set(patch)` call needed no changes since drizzle already types against the full table schema.
- **Files modified:** `apps/mobile/hooks/useProfile.ts`
- **Verification:** `pnpm --filter @apsis/mobile exec tsc --noEmit` clean; root `pnpm run typecheck` clean; full mobile vitest suite green (44/44).
- **Committed in:** `b9109bf` (Task 2 commit)

**2. [Rule 1 - Bug] Reworded two doc-comment sentences that tripped their own acceptance-criteria greps**
- **Found during:** Task 1 and Task 2 self-check
- **Issue:** `nutritionProfile.ts`'s module doc comment literally contained the substring `@apsis/db` (while explaining the module has *zero* such imports), and `nutrition-setup/index.tsx`'s doc comment literally contained `workout`/`load_daily` (while explaining the screen never touches them) — both false-positived their own `<acceptance_criteria>` substring greps.
- **Fix:** Reworded both comments to convey the same intent without the literal matched substrings (e.g. "zero database-client... imports", "never any logged training tables").
- **Files modified:** `apps/mobile/lib/nutritionProfile.ts`, `apps/mobile/app/nutrition-setup/index.tsx`
- **Verification:** Re-ran both greps after the edit — 0 matches each, as required; re-ran `tsc --noEmit` and the vitest suite — both still clean/green.
- **Committed in:** `8cf8f70` (Task 1), `b9109bf` (Task 2)

---

**Total deviations:** 2 auto-fixed (1 missing critical, 1 bug)
**Impact on plan:** Both necessary for the plan's own acceptance criteria to pass as literally specified. No scope creep — no new tables, no new screens beyond what the plan described.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `useNutritionProfile` and the Nutrition Setup screen are ready for Plan 05 to wire into the
  nutrition tab: on `complete === false`, route to `/nutrition-setup`; on `complete === true`,
  feed `profile` into `dailyMacroTarget`/`computeNutritionTargetRow` from Plan 02/03.
- Manual on-device verification (existing NULL-field profile routes to setup; completing it
  clears the gate without relaunch) is deferred to phase UAT per this plan's own `<verification>`
  block — the nutrition tab that would trigger the gate doesn't exist until Plan 05.

---
*Phase: 07-nutrition-tracking*
*Completed: 2026-07-13*
