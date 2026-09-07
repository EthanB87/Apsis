---
phase: 05-healthkit-integration
reviewed: 2026-07-12T03:22:20Z
depth: standard
files_reviewed: 30
files_reviewed_list:
  - apps/mobile/app.json
  - apps/mobile/app/(tabs)/_layout.tsx
  - apps/mobile/app/(tabs)/history/index.tsx
  - apps/mobile/app/(tabs)/index.tsx
  - apps/mobile/app/(tabs)/log/run.tsx
  - apps/mobile/app/(tabs)/settings/index.tsx
  - apps/mobile/app/onboarding/healthkit.tsx
  - apps/mobile/app/onboarding/review.tsx
  - apps/mobile/app/session/detail.tsx
  - apps/mobile/components/SourceChip.tsx
  - apps/mobile/components/history/DayRow.tsx
  - apps/mobile/hooks/useForegroundHealthKitSync.ts
  - apps/mobile/hooks/useSaveProfile.ts
  - apps/mobile/lib/__tests__/healthkitMapping.test.ts
  - apps/mobile/lib/finishWorkout.ts
  - apps/mobile/lib/healthkitAuth.ts
  - apps/mobile/lib/healthkitImport.ts
  - apps/mobile/lib/healthkitMapping.ts
  - apps/mobile/lib/healthkitSyncState.ts
  - apps/mobile/lib/healthkitWriteback.ts
  - apps/mobile/lib/runEntry.ts
  - apps/mobile/package.json
  - packages/db/drizzle/0003_normal_hairball.sql
  - packages/db/drizzle/meta/0003_snapshot.json
  - packages/db/drizzle/meta/_journal.json
  - packages/db/drizzle/migrations.js
  - packages/db/src/__tests__/dedupe-candidate-query.test.ts
  - packages/db/src/index.ts
  - packages/db/src/queries.ts
  - packages/db/src/schema.ts
findings:
  critical: 3
  warning: 10
  info: 5
  total: 18
status: issues_found
---

# Phase 05: Code Review Report

**Reviewed:** 2026-07-12T03:22:20Z
**Depth:** standard
**Files Reviewed:** 30
**Status:** issues_found

## Summary

Reviewed the Phase 05 HealthKit integration: import engine (anchored batch sync, dedupe, bodyweight), write-back, sync state, auth wrapper, foreground sync hook, onboarding step, Settings section, provenance UI (SourceChip/DayRow/detail), the D-09 dupe hint in run.tsx, and the schema/migration additions. Library API usage was cross-checked against the installed `@kingstinct/react-native-healthkit@14.0.2` typings and native Swift sources — the API shapes the code relies on (`limit: 0` = fetch-all, `AuthDataTypes {toRead, toShare}`, `FilterForSamples {uuid}` / `NOT: [{sources}]`, meters/seconds units for `totalDistance`/`duration`, `WorkoutTotals.distance` in meters, `AnyMap` as a plain record, the `WorkoutActivityType` numeric values mirrored in `healthkitMapping.ts`) all check out.

The engine-purity, parameterized-query, and clamp-and-warn disciplines are consistently applied and well documented. However, three critical logic defects were found, all in the dedupe/conflict-resolution core that the phase exists to get right: (1) the manual-duplicate dedupe check misclassifies written-back manual runs as imports, which double-counts HSS for exactly the watch-wearing athlete this feature targets; (2) D-17 most-recent-wins bodyweight resolution is broken because manual edits never stamp `bodyweightSetAt`; and (3) a failed initial sync retries without the 90-day window, importing the user's entire HealthKit history. Ten warnings cover transactionality, sync concurrency, deleted-sample handling, and several UI/flow gaps.

## Critical Issues

### CR-01: Dedupe misclassifies written-back manual runs as imports — duplicate sessions double-count HSS

**File:** `apps/mobile/lib/healthkitImport.ts:199-201`, `packages/db/src/queries.ts:190-200`, `apps/mobile/app/(tabs)/log/run.tsx:143-145`
**Issue:** The D-06/D-07 "manual wins" duplicate check filters candidates with `c.healthkitUuid == null` to isolate manual rows. But manual rows do NOT keep a null `healthkitUuid`: after a successful HK write-back, `saveRun` (runEntry.ts:129-133) and `finishWorkout` (finishWorkout.ts:58-63) store Apsis's own write-back sample uuid on the manual `workout` row (schema.ts:85-87 documents exactly this). So whenever HealthKit is connected — which is the only time the import runs at all — every manually logged run is excluded from the manual-duplicate tolerance check. Scenario: athlete wears an Apple Watch during a run and also logs it manually in Apsis (the primary dedupe scenario per D-06). The watch sample is not Apsis-sourced (echo filter passes it), its uuid matches no tombstone, and the tolerance check skips the manual row because its `healthkitUuid` is the write-back uuid → the watch run imports as a second session → day HSS double-counts. This silently corrupts the product's single honest training-load number.
**Fix:** Add `source: workout.source` to `candidatesForDedupe`'s select in `packages/db/src/queries.ts`, then classify by provenance, not uuid nullability:
```ts
// healthkitImport.ts
const isManualDuplicate = candidates
  .filter((c) => c.source === 'manual')
  .some((c) => isDuplicateOfExisting(durationS, c.durationS));
```
and in run.tsx's D-09 hint use `c.source === 'healthkit'` instead of `c.healthkitUuid != null`. Add a regression test in `dedupe-candidate-query.test.ts` asserting `source` is selected.

### CR-02: Manual bodyweight edits never stamp `bodyweightSetAt` — old HK samples silently overwrite fresh manual edits (D-17 broken)

**File:** `apps/mobile/app/(tabs)/settings/index.tsx:318-326`, `apps/mobile/hooks/useProfile.ts:105-126`, `apps/mobile/hooks/useSaveProfile.ts:50-60`, `apps/mobile/lib/healthkitImport.ts:257-276`
**Issue:** D-17's most-recent-wins conflict resolution compares the HK sample's `startDate` against `user_profile.bodyweightSetAt`. Only the import path (healthkitImport.ts:272) ever writes `bodyweightSetAt`. Neither the onboarding insert (`useSaveProfile.save`) nor a Settings bodyweight edit (`handleSaveChanges` → `useProfile.update`, whose `ProfileUpdateInput` doesn't even carry the field) stamps it. Consequences: (a) fresh install, user enters bodyweight in onboarding, connects HK → `bodyweightSetAt` is null → `bodyweightSampleIsNewer(x, null)` returns true → a months-old body-mass sample overwrites the value the user typed minutes ago; (b) user edits bodyweight in Settings after a prior import → `bodyweightSetAt` still holds the OLD sample's timestamp → any HK sample newer than that old sample (but older than the manual edit) overwrites the manual edit on the next silent foreground sync. The manual side of "most-recent-wins" can never win. Bodyweight feeds the strength stress engine, so this silently skews HSS.
**Fix:** Stamp the edit time whenever bodyweight is written manually:
```ts
// useProfile.ts — extend ProfileUpdateInput with bodyweightSetAt?: Date
// settings/index.tsx handleSaveChanges:
if (draft.bodyweightKg != null) {
  patch.bodyweightKg = draft.bodyweightKg;
  patch.bodyweightSetAt = new Date();
}
// useSaveProfile.ts insert: bodyweightSetAt: new Date()
```
(Only stamp when the value actually changed, to preserve the WR-02 no-drift behavior.)

### CR-03: Failed/incomplete initial sync retries with no anchor AND no date window — imports the user's entire HealthKit history

**File:** `apps/mobile/lib/healthkitImport.ts:126-143`, `apps/mobile/hooks/useForegroundHealthKitSync.ts:69-81`
**Issue:** The 90-day window (`dateStart`) is applied only when `options.initial === true`. The documented retry path for a failed initial import is "the next foreground sync retries naturally" (D-25) — but that retry calls `runHealthKitSync(db, { initial: false })`, and since the anchor was never persisted (`setSyncState` only runs on the success path), `anchor` resolves to `undefined` and `dateStart` stays `undefined`. The resulting query is `{ limit: 0, anchor: undefined, filter: { NOT: [sources] } }` — fetch ALL workouts ever recorded, unbounded. For a long-time watch user that is years of workouts: it violates the D-01 90-day boundary, floods `workout`/`load_daily` with ancient sessions, and permanently distorts ATL/CTL/TSB and the readiness band. The same happens if the user backgrounds the app while the fire-and-forget initial import from onboarding/Settings is still running (anchor not yet saved).
**Fix:** Enforce the window whenever there is no anchor, regardless of `options.initial`:
```ts
const anchor = options.initial ? undefined : (syncState?.healthkitAnchor ?? undefined);
let dateStart: Date | undefined;
if (anchor == null) {
  dateStart = new Date();
  dateStart.setDate(dateStart.getDate() - INITIAL_IMPORT_WINDOW_DAYS);
}
```

## Warnings

### WR-01: Per-sample import writes are not transactional — a mid-sequence failure creates orphan/duplicate sessions

**File:** `apps/mobile/lib/healthkitImport.ts:222-249`
**Issue:** Each sample performs three separate awaited writes (insert `workout` → insert `endurance_segment` → update `workout.hss`) with no transaction. If the segment insert or hss update fails: the anchor is not advanced (good), but a `workout` row with `finishedAt` set and `hss = 0` persists. It shows up in History/`recomputeLoadDaily` as a junk 0-HSS session, and — worse — it is invisible to `candidatesForDedupe` (inner join on `endurance_segment`), so its uuid does not tombstone: the next sync re-imports the same sample, producing a duplicate.
**Fix:** Wrap the three writes per sample in `database.transaction(async (tx) => { ... })`. Additionally consider a UNIQUE index on `workout.healthkit_uuid` as a DB-level backstop against uuid re-insertion.

### WR-02: Cold launch never triggers a sync — first import waits for a background/foreground cycle

**File:** `apps/mobile/hooks/useForegroundHealthKitSync.ts:60-84`
**Issue:** The hook only reacts to `AppState` `'change'` events. On a fresh app launch, AppState is already `'active'` and no change event fires, so no sync runs until the user backgrounds and re-foregrounds the app. A user who force-quits nightly and opens Apsis once per day would effectively never delta-sync on the session where they actually look at TODAY.
**Fix:** Run the same guarded sync body once on mount (inside the existing `useEffect`), reusing the in-flight/debounce guards.

### WR-03: Initial sync and foreground sync can run concurrently — dedupe reads race inserts

**File:** `apps/mobile/hooks/useForegroundHealthKitSync.ts:56-67`, `apps/mobile/app/onboarding/healthkit.tsx:49`, `apps/mobile/app/(tabs)/settings/index.tsx:293`
**Issue:** The `inFlightRef` guard only covers syncs the hook itself starts. The fire-and-forget initial imports launched from onboarding and Settings are invisible to it, so a foreground `'active'` event during a long 90-day initial import starts a second concurrent `runHealthKitSync`. Both loops read `candidatesForDedupe` before the other's inserts commit, so the same sample can pass dedupe in both and insert twice. (Compounded by CR-03: the concurrent foreground sync also runs unwindowed.)
**Fix:** Move the in-flight guard into `runHealthKitSync` itself (module-level promise/mutex): if a sync is already running, return/await the existing one.

### WR-04: `deletedSamples` from the anchored query is ignored — workouts deleted in Apple Health persist in Apsis forever

**File:** `apps/mobile/lib/healthkitImport.ts:135-143`
**Issue:** `queryWorkoutSamplesWithAnchor` returns `{ workouts, deletedSamples, newAnchor }` (verified in installed typings). The code destructures only `workouts` and `newAnchor`. If a user deletes a mis-recorded workout in the Health app (e.g. a phantom 3-hour "run"), the already-imported Apsis session keeps counting toward HSS/readiness, and because the anchor advances past the deletion event, the deletion is permanently unobservable. If this is a deliberate scope cut, it should be documented as a decision; today it silently contradicts the "one honest training-load number" value.
**Fix:** For each `deletedSamples` entry, soft-delete the matching `workout` row where `healthkitUuid = deleted.uuid AND source = 'healthkit'`, then recompute (the existing tombstone behavior keeps it from re-importing).

### WR-05: run.tsx import-dupe hint misfires on written-back manual runs and on deleted imports

**File:** `apps/mobile/app/(tabs)/log/run.tsx:134-152`
**Issue:** Two false-positive paths for the "An imported run already covers this — saving will count both" notice: (a) `c.healthkitUuid != null` matches the user's own earlier manual run once it has been written back to Health (same misclassification as CR-01); (b) `candidatesForDedupe` deliberately includes soft-deleted rows (tombstone semantics), so a previously swipe-deleted import still triggers the hint even though it contributes nothing to the training load — the "will count both" claim is false in both cases.
**Fix:** After the CR-01 fix adds `source` (and, additionally, `deletedAt` or a boolean) to the candidate select, gate the hint on `c.source === 'healthkit' && c.deletedAt == null`.

### WR-06: History error message promises pull-to-refresh that is not implemented

**File:** `apps/mobile/app/(tabs)/history/index.tsx:61, 216-256`
**Issue:** `LOAD_ERROR_MESSAGE` is "Couldn't load your history. Pull down to try again." but the `SectionList` has no `refreshControl`/`onRefresh`. After a load failure the user has no recovery affordance except leaving and re-entering the tab; the copy actively instructs a gesture that does nothing.
**Fix:** Add `onRefresh={loadHistory}` + `refreshing` state (or change the copy to match an actual retry affordance).

### WR-07: Re-entrant `finishWorkout` writes duplicate HealthKit samples and orphans earlier write-backs

**File:** `apps/mobile/lib/finishWorkout.ts:46-68`
**Issue:** The header calls repeat invocation a "harmless re-set" of `finishedAt`, but the HK tail is not idempotent: every call fires another `writeBackLift`, creating a new HK workout sample each time and overwriting `workout.healthkitUuid` with the newest uuid. Earlier duplicates remain in Health with no stored reference, so `discardWorkout`'s delete-sync can only ever remove the last one. Both entry paths (finish-screen "Done" re-tapped, crash-resume "Finish Now" after a normal finish) can re-invoke it.
**Fix:** Select `healthkitUuid` alongside `createdAt`/`hss` and skip the write-back when it is already non-null:
```ts
if (row?.createdAt != null && row.healthkitUuid == null) { ... }
```

### WR-08: Back-dated runs are written to Health with today's timestamps

**File:** `apps/mobile/lib/runEntry.ts:95-129`
**Issue:** run.tsx's date picker allows logging a run for a past `localDate`, but the write-back computes `startedAt = new Date(saveTime) - durationS`, ignoring `input.localDate`. A run logged for last Tuesday appears in Apple Health as having happened today — wrong data written into the user's health record, and inconsistent with the Apsis row it mirrors.
**Fix:** When `input.localDate` differs from today, anchor `startedAt` to that date (e.g. noon local on `localDate` minus nothing, or skip write-back for back-dated entries and document the choice).

### WR-09: review.tsx `router.push` lets the user swipe back and insert a second `user_profile` row

**File:** `apps/mobile/app/onboarding/review.tsx:61-63`, `apps/mobile/hooks/useSaveProfile.ts:50-60`
**Issue:** After a successful insert-only `save()`, the screen `push`es (not `replace`s) to `/onboarding/healthkit`. The HealthKit step has no back-disabling options, so an iOS back-swipe returns to review, where tapping "Save & Start Training" runs the INSERT again — a second `user_profile` row. Every reader (`useProfile`, `getSyncState`, `fetchThresholds`) uses `.limit(1)` with no ORDER BY, so which profile row wins is undefined; sync state and thresholds can split across two rows.
**Fix:** Use `router.replace('/onboarding/healthkit')`, and make `save()` defensive: check for an existing row and update instead of insert (or add a unique constraint strategy for the singleton row).

### WR-10: Import notice never appears on the natural path (sync completes while TODAY is already focused)

**File:** `apps/mobile/app/(tabs)/index.tsx:364-369`, `apps/mobile/hooks/useForegroundHealthKitSync.ts`
**Issue:** The D-10 notice is read via `getState()` inside a `useFocusEffect`. The common sequence is: app foregrounded on the TODAY tab → focus effect already ran (store still null) → sync completes seconds later and updates the store → no new focus event fires (React Navigation focus does not re-fire on AppState changes). The notice only appears if the user later leaves the tab and comes back — the "quiet transient import count" is invisible at exactly the moment it is relevant.
**Fix:** Subscribe reactively (the zustand hook selector) and keep the once-per-batch gate in `importNoticeForBatch`, which already dedupes by `syncedAt`; or add a store subscription inside the focus effect's lifetime.

## Info

### IN-01: Settings HK state is loaded once on mount — stale LAST SYNC / connected state

**File:** `apps/mobile/app/(tabs)/settings/index.tsx:149-161`
**Issue:** `getSyncState` runs in a bare mount-time `useEffect`. Tab screens stay mounted, so the "LAST SYNC ..." line and `hkEverConnected` never refresh after a foreground sync or after the fire-and-forget connect import completes — despite the project's own Pitfall 5 lesson (cited in history/index.tsx) about preferring `useFocusEffect` for DB reads.
**Fix:** Re-read sync state in a `useFocusEffect`, and refresh after `handleConnectHealthKit`'s sync resolves.

### IN-02: HK_ACTIVITY_TYPE mirror can drift silently; tests are tautological; caret version range widens the risk

**File:** `apps/mobile/lib/healthkitMapping.ts:33-49`, `apps/mobile/lib/__tests__/healthkitMapping.test.ts:22-58`, `apps/mobile/package.json:12`
**Issue:** The numeric enum mirror matches the installed `@kingstinct/react-native-healthkit@14.0.2` typings (verified this review), but the tests assert `mapHKActivityType(HK_ACTIVITY_TYPE.x)` — the mirror against itself — so drift from the real enum would never fail a test. `"^14.0.2"` permits minor upgrades that the header explicitly warns must be re-verified manually.
**Fix:** Add a compile-time guard using a type-only import (type-only imports do not execute the module, so vitest is unaffected): `import type { WorkoutActivityType } from '@kingstinct/react-native-healthkit'` and assert `HK_ACTIVITY_TYPE.running satisfies WorkoutActivityType.running`-style checks, or pin the exact version.

### IN-03: Tech-stack document drift — CLAUDE.md pins @kingstinct/react-native-healthkit ~8.2.0, installed is ^14.0.2

**File:** `apps/mobile/package.json:12`
**Issue:** The project's locked stack doc recommends `~8.2.0`; the app ships `^14.0.2` (a Nitro-modules rewrite with a different API surface, plus the `react-native-nitro-modules` dependency). The code targets 14.x correctly, but the stack document is now misleading for future work.
**Fix:** Update the stack section of `.claude/CLAUDE.md` to reflect 14.x and the nitro-modules requirement.

### IN-04: Clamped-to-bound durations import junk sessions

**File:** `apps/mobile/lib/healthkitImport.ts:154-166`
**Issue:** `sanitizeHKNumeric` clamps a negative duration to 0 and a >48h duration to exactly 48h, and the sample then imports as a real session (a 0-second workout renders as a 0-HSS row in TODAY/History; a 48h clamp still yields an enormous ES). Discarding is arguably safer than clamping for duration specifically, since a clamped duration is known-wrong data.
**Fix:** Treat out-of-bounds durations like null/NaN (skip the sample with a warning) instead of clamping.

### IN-05: History swipe-delete failure is silent to the user

**File:** `apps/mobile/app/(tabs)/history/index.tsx:193-205`
**Issue:** If `discardWorkout` throws, the error is logged, the confirm modal closes, and the list reloads with the session still present — no user-facing indication the delete failed. The user's most likely interpretation is a UI glitch, and they must guess to retry.
**Fix:** Set the existing `errorMessage` state (generic copy) when the catch branch runs.

---

_Reviewed: 2026-07-12T03:22:20Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
