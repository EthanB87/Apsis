---
phase: 03-onboarding-lifting-logger
fixed_at: 2026-07-09T22:00:41Z
review_path: .planning/phases/03-onboarding-lifting-logger/03-REVIEW.md
iteration: 1
findings_in_scope: 11
fixed: 11
skipped: 0
status: all_fixed
---

# Phase 03: Code Review Fix Report

**Fixed at:** 2026-07-09T22:00:41Z
**Source review:** .planning/phases/03-onboarding-lifting-logger/03-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 11 (3 Critical, 8 Warning; fix_scope = critical_warning, 9 Info findings out of scope)
- Fixed: 11
- Skipped: 0

All fixes were verified by re-read plus `pnpm run typecheck` (root `tsc --build`) before each
commit; touched packages were tested (`@apsis/engine` 81/81, `@apsis/db` 17/17,
`@apsis/shared` 7/7 — all passing). UI/lifecycle fixes (CR-02, CR-03, WR-03) change runtime
behavior that only an on-device session can fully exercise — flagged below for human
verification during UAT.

## Fixed Issues

### CR-01: Engine ignores `isWarmup` on carry sets — warmup timed sets inflate HSS

**Files modified:** `packages/engine/src/carry.ts`, `packages/engine/src/__tests__/carry.test.ts`
**Commit:** 3359055
**Applied fix:** `carryStressDetailed` now returns `{ cs: 0, warnings: [] }` for `isWarmup`
sets, mirroring the strength-side warmup skip. Added four regression tests: warmup carry
yields cs 0 with no warnings (including with out-of-range inputs), a session of only warmup
carries has hss 0, and mixed warmup + working carries count only the working set.

### CR-02: SetRow load input reformats on every keystroke — decimal entry impossible

**Files modified:** `apps/mobile/components/session/SetRow.tsx`
**Commit:** 2b1d595
**Applied fix:** Added local `loadText` state so the load `TextInput` shows the raw typed
text while editing (draft still receives the parsed kg on every change). `onBlur` and both
weight steppers reset `loadText` to null so the formatted value re-syncs.
**Status:** fixed: requires human verification (typing "62.5" on a device keypad should
commit 62.5, not 625; fractional lb entry in imperial mode should also work).

### CR-03: ResumePrompt navigates before any navigator has mounted

**Files modified:** `apps/mobile/app/_layout.tsx`
**Commit:** 4458be6
**Applied fix:** Review's Option B — Resume/Finish-Now handlers now store the target in a
`pendingRoute` state (typed `Href`) and a `useEffect` performs `router.push` only after the
`openWorkoutRow === null` re-render has mounted the `<Stack>`.
**Status:** fixed: requires human verification (kill the app mid-session, relaunch, tap
Resume and Finish Now — both should navigate instead of landing on the default tab).

## Warnings Fixed

### WR-01: Migration 0001 never backfills seeded exercises — NULL `entryMode`/`bwFactor` on upgrades

**Files modified:** `packages/db/src/seed.ts`
**Commit:** 384090c
**Applied fix:** Replaced the count-before-insert guard with a per-id upsert
(`INSERT ... ON CONFLICT(id) DO UPDATE SET bw_factor = excluded.bw_factor,
entry_mode = excluded.entry_mode`), run on every launch. Chose the review's upsert
alternative over appending UPDATEs to migration 0001, since editing an already-applied
migration would miss devices that already ran the Phase 3 build; the upsert heals every
install generation and removes the two-sources-of-truth divergence. `restTimerSec`
(user-adjustable) is deliberately not overwritten. The `excluded.*` sql fragments are
static column identifiers only — no user input (T-1-01 preserved).

### WR-02: Settings field editors seed from rounded display values — saving without editing drifts stored metric values

**Files modified:** `apps/mobile/app/(tabs)/settings/index.tsx`
**Commit:** ce324c4
**Applied fix:** Extracted `bodyweightDisplayText`/`paceDisplayTexts` helpers used by both
the editor seeding and the commit handlers; `commitBodyweight`/`commitThresholdPace` now
short-circuit (keep the exact stored metric value) when the text still matches the seeded
display rendering. Also added rollback to `handleUnitsChange`: the optimistic draft units
revert if the UPDATE fails (uses `update()`'s boolean return).

### WR-03: Nothing prevents creating a second open workout

**Files modified:** `apps/mobile/app/(tabs)/log/index.tsx`, `packages/db/src/queries.ts`
**Commit:** 3d5f758
**Applied fix:** `handleStart` now queries `openWorkout(db)` first; if an open row exists it
primes the store via `rehydrateFromDb` and navigates to that session instead of inserting.
`openWorkout` also gained `orderBy(desc(workout.createdAt))` so any legacy multi-open state
resolves deterministically to the most recent row.
**Status:** fixed: requires human verification (back-swipe out of an active session, tap
Start Workout again — should return to the same session, not create a new one).

### WR-04: Pending rest notification not cancelled when the session ends

**Files modified:** `apps/mobile/stores/sessionStore.ts`
**Commit:** 77d780f
**Applied fix:** `reset()` now captures `restNotificationId` and calls
`cancelRestNotification(id)` before wiping state, closing the one lifecycle exit
(Done/Discard inside the rest window) that leaked a scheduled OS notification.

### WR-05: `formatLastSessionSummary` always renders kg for imperial users

**Files modified:** `apps/mobile/stores/sessionStore.ts`
**Commit:** 28fcc6b
**Applied fix:** `formatLastSessionSummary` takes a `units` parameter and formats via
`kgToDisplayLb` for imperial (`"Last: 225 lb × 5"`) or rounded kg for metric; `addExercise`
passes `get().units`.

### WR-06: `addSet` derives `setNumber` from array length — delete-then-add duplicates persisted numbers

**Files modified:** `apps/mobile/stores/sessionStore.ts`
**Commit:** 13842ce
**Applied fix:** `setNumber: Math.max(0, ...card.sets.map((s) => s.setNumber)) + 1` — the
next number always exceeds every existing one, so mid-list deletes can no longer cause
duplicate persisted `strength_set.setNumber` values.

### WR-07: Settings screen spins forever if the profile read fails

**Files modified:** `apps/mobile/hooks/useProfile.ts`, `apps/mobile/app/(tabs)/settings/index.tsx`
**Commit:** 1c86f52
**Applied fix:** `useProfile.load()` now sets a generic `loadErrorMessage`
("Couldn't load your profile. Try again.") in its catch, and the hook exposes
`loadErrorMessage` + `reload`. The Settings gate renders that string with a Retry button
(44pt target) instead of the indefinite spinner when the load failed. Raw errors remain
console-only (T-03-08).

### WR-08: Onboarding review "edit bodyweight" loses the entered value

**Files modified:** `apps/mobile/app/onboarding/bodyweight.tsx`
**Commit:** f2f7ceb
**Applied fix:** The input now seeds from `draft.bodyweightKg` (display-rounded, per the
review's suggested conversion), matching the threshold-hr/threshold-pace steps. Additionally,
`handleNext` keeps the exact stored kg when the seeded text was left unedited, so re-walking
the wizard doesn't round-trip-drift the stored metric value (same guard as the WR-02 fix).

## Skipped Issues

None — all in-scope findings were fixed.

## Verification Notes

- `pnpm run typecheck` (root `tsc --build`, covers apps/mobile + all packages): clean after
  every commit.
- `pnpm --filter @apsis/engine test`: 81/81 passing (includes 4 new CR-01 regression tests).
- `pnpm --filter @apsis/db test`: 17/17 passing.
- `pnpm --filter @apsis/shared test`: 7/7 passing.
- Human verification recommended for CR-02, CR-03, WR-03 (device-only UI/navigation
  behavior) during phase UAT.

---

_Fixed: 2026-07-09T22:00:41Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
