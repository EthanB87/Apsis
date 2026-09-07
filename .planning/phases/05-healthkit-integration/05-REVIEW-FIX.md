---
phase: 05-healthkit-integration
fixed_at: 2026-07-12T03:54:23Z
review_path: .planning/phases/05-healthkit-integration/05-REVIEW.md
iteration: 1
findings_in_scope: 13
fixed: 13
skipped: 0
status: all_fixed
---

# Phase 05: Code Review Fix Report

**Fixed at:** 2026-07-12T03:54:23Z
**Source review:** .planning/phases/05-healthkit-integration/05-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 13 (3 Critical, 10 Warning; scope = critical_warning, 5 Info findings excluded)
- Fixed: 13
- Skipped: 0

All fixes were applied in an isolated git worktree, verified with `pnpm run typecheck`
(clean, zero errors) and `pnpm -r --if-present test` (165 tests passing: shared 21,
engine 81, db 33, mobile 30) after each change, committed atomically per finding, and
fast-forwarded onto `master`.

## Fixed Issues

### CR-01: Dedupe misclassifies written-back manual runs as imports

**Files modified:** `packages/db/src/queries.ts`, `apps/mobile/lib/healthkitImport.ts`, `apps/mobile/app/(tabs)/log/run.tsx`, `packages/db/src/__tests__/dedupe-candidate-query.test.ts`
**Commit:** 6adae75
**Status:** fixed: requires human verification (logic fix — syntax/tests pass, but the dedupe semantics should be confirmed on-device with a written-back manual run + matching watch sample)
**Applied fix:** Added `source: workout.source` to `candidatesForDedupe`'s select. The import engine's D-06/D-07 manual-duplicate tolerance check now filters `c.source === 'manual'` instead of `c.healthkitUuid == null` (manual rows carry Apsis's write-back uuid once HK is connected). run.tsx's D-09 hint now filters `c.source === 'healthkit'`. Added a regression test asserting `"workout"."source"` is selected.

### CR-02: Manual bodyweight edits never stamp `bodyweightSetAt` (D-17 broken)

**Files modified:** `apps/mobile/hooks/useProfile.ts`, `apps/mobile/hooks/useSaveProfile.ts`, `apps/mobile/app/(tabs)/settings/index.tsx`
**Commit:** 2b70769
**Status:** fixed: requires human verification (logic fix — most-recent-wins resolution should be confirmed against a real HK body-mass sample)
**Applied fix:** Extended `ProfileUpdateInput` with `bodyweightSetAt?: Date`. Settings' `handleSaveChanges` stamps `patch.bodyweightSetAt = new Date()` only when the bodyweight value actually changed (`draft.bodyweightKg !== profile?.bodyweightKg`, preserving the WR-02 no-drift behavior). The onboarding insert (`useSaveProfile.save`) now stamps `bodyweightSetAt: new Date()`.

### CR-03: Failed initial sync retries unwindowed — imports entire HealthKit history

**Files modified:** `apps/mobile/lib/healthkitImport.ts`
**Commit:** f193c8c
**Status:** fixed: requires human verification (logic fix — retry-after-failed-initial-import path should be exercised on-device)
**Applied fix:** The 90-day `dateStart` window is now applied whenever `anchor == null` (not only when `options.initial === true`), so the natural D-25 retry of a failed initial import — which arrives with `initial: false` and no persisted anchor — remains bounded by the D-01 window.

### WR-01: Per-sample import writes are not transactional

**Files modified:** `apps/mobile/lib/healthkitImport.ts`
**Commit:** 238a4a4
**Applied fix:** The per-sample `workout` insert + `endurance_segment` insert + `hss` update now run inside `database.transaction(async (tx) => { ... })`, so a mid-sequence failure can no longer leave a segment-less orphan row that evades the dedupe tombstone and re-imports as a duplicate. (The suggested optional UNIQUE index on `workout.healthkit_uuid` was NOT added — a schema/migration change was judged out of proportion for this fix pass; the transaction closes the identified failure path.)

### WR-02: Cold launch never triggers a sync

**Files modified:** `apps/mobile/hooks/useForegroundHealthKitSync.ts`
**Commit:** f1a83ed
**Applied fix:** Extracted the guarded sync body into `triggerSync()` inside the existing `useEffect` and invoked it once on mount (in addition to the `AppState` `'active'` listener), reusing the same in-flight/debounce guards.

### WR-03: Initial and foreground syncs can run concurrently

**Files modified:** `apps/mobile/lib/healthkitImport.ts`
**Commit:** 9f5990c
**Applied fix:** Moved the concurrency guard into `runHealthKitSync` itself via a module-level in-flight promise: if a sync is already running (from any entry point — onboarding, Settings, or the foreground hook), the existing promise is returned instead of starting a second overlapping sync. The internal body was renamed `executeHealthKitSync`; the hook's own ref guard remains as a harmless first layer.

### WR-04: `deletedSamples` ignored — Health deletions persist in Apsis forever

**Files modified:** `apps/mobile/lib/healthkitImport.ts`
**Commit:** 85e8faf
**Applied fix:** `deletedSamples` is now destructured from `queryWorkoutSamplesWithAnchor` and each entry soft-deletes the matching row via `UPDATE workout SET deleted_at WHERE healthkit_uuid = ? AND source = 'healthkit' AND deleted_at IS NULL` (parameterized drizzle builders), before the single batch `recomputeLoadDaily`. The soft-deleted row keeps its uuid, so the existing deletedAt-blind tombstone check prevents re-import.

### WR-05: run.tsx dupe hint misfires on written-back manual runs and deleted imports

**Files modified:** `packages/db/src/queries.ts`, `apps/mobile/app/(tabs)/log/run.tsx`, `packages/db/src/__tests__/dedupe-candidate-query.test.ts`
**Commit:** 29f82ae
**Applied fix:** Added `deletedAt: workout.deletedAt` to `candidatesForDedupe`'s select (WHERE clause stays deletedAt-blind per tombstone semantics). The D-09 hint now gates on `c.source === 'healthkit' && c.deletedAt == null`. Updated the Pitfall 9 test to assert deleted_at is absent from the WHERE clause specifically (it is now legitimately present in the SELECT list), and added a test asserting `"workout"."deleted_at"` is selected. (The manual-run misclassification half was fixed in CR-01's commit.)

### WR-06: History error copy promises pull-to-refresh that is not implemented

**Files modified:** `apps/mobile/app/(tabs)/history/index.tsx`
**Commit:** fdb59af
**Applied fix:** Added `refreshing` state and a `handleRefresh` callback wrapping `loadHistory`, wired via `onRefresh`/`refreshing` on the `SectionList`, making the "Pull down to try again" copy true.

### WR-07: Re-entrant `finishWorkout` writes duplicate HealthKit samples

**Files modified:** `apps/mobile/lib/finishWorkout.ts`
**Commit:** 2769d2c
**Applied fix:** `finishWorkout` now selects `healthkitUuid` alongside `createdAt`/`hss` and skips the `writeBackLift` tail when the uuid is already non-null, making the write-back idempotent across re-invocations (finish-screen "Done" re-tap, crash-resume "Finish Now" after a normal finish).

### WR-08: Back-dated runs written to Health with today's timestamps

**Files modified:** `apps/mobile/lib/runEntry.ts`
**Commit:** ba8a8fe
**Applied fix:** When `input.localDate` differs from the save moment's local date, the HK sample's `startedAt` is anchored to noon local on the logged `localDate` instead of `now - durationS`, so back-dated entries land on the correct calendar day in the user's Health record. Same-day entries keep the existing back-computed start.

### WR-09: review.tsx `router.push` lets a back-swipe insert a second `user_profile` row

**Files modified:** `apps/mobile/app/onboarding/review.tsx`, `apps/mobile/hooks/useSaveProfile.ts`
**Commit:** 4467d60
**Applied fix:** review.tsx now `router.replace`s (not pushes) to `/onboarding/healthkit`, and `useSaveProfile.save` is defensive: it checks for an existing `user_profile` row and UPDATEs it in place (parameterized `eq` on id) instead of INSERTing a duplicate singleton row.

### WR-10: Import notice never appears when sync completes on the focused TODAY tab

**Files modified:** `apps/mobile/app/(tabs)/index.tsx`
**Commit:** 2b28633
**Applied fix:** Replaced the `getState()` snapshot with the reactive zustand hook selectors (`lastImportedCount`/`lastSyncedAt`) as the focus effect's dependencies, so a sync completing while TODAY is already focused re-runs the effect and shows the notice. `importNoticeForBatch`'s once-per-batch gate (keyed on `syncedAt`) is retained, so each batch still shows exactly once and a later refocus with no new batch clears the transient notice — matching the original D-10 semantics.

## Skipped Issues

None — all 13 in-scope findings were fixed.

(Info findings IN-01 through IN-05 were out of scope for this pass — `fix_scope: critical_warning`.)

---

_Fixed: 2026-07-12T03:54:23Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
