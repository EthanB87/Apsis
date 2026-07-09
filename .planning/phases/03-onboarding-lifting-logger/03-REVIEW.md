---
phase: 03-onboarding-lifting-logger
reviewed: 2026-07-09T21:43:48Z
depth: standard
files_reviewed: 63
files_reviewed_list:
  - apps/mobile/app/(tabs)/log/_layout.tsx
  - apps/mobile/app/(tabs)/log/index.tsx
  - apps/mobile/app/(tabs)/log/session.tsx
  - apps/mobile/app/(tabs)/settings/_layout.tsx
  - apps/mobile/app/(tabs)/settings/index.tsx
  - apps/mobile/app/_layout.tsx
  - apps/mobile/app/onboarding/_layout.tsx
  - apps/mobile/app/onboarding/bodyweight.tsx
  - apps/mobile/app/onboarding/review.tsx
  - apps/mobile/app/onboarding/sex.tsx
  - apps/mobile/app/onboarding/threshold-hr.tsx
  - apps/mobile/app/onboarding/threshold-pace.tsx
  - apps/mobile/app/onboarding/units.tsx
  - apps/mobile/app/session/finish.tsx
  - apps/mobile/components/BootStates.tsx
  - apps/mobile/components/onboarding/ProfileReview.tsx
  - apps/mobile/components/onboarding/WizardStep.tsx
  - apps/mobile/components/session/ExerciseCard.tsx
  - apps/mobile/components/session/ExercisePickerSheet.tsx
  - apps/mobile/components/session/HSSBreakdownSheet.tsx
  - apps/mobile/components/session/LiveHssHeader.tsx
  - apps/mobile/components/session/RestTimerBanner.tsx
  - apps/mobile/components/session/SetRow.tsx
  - apps/mobile/hooks/useProfile.ts
  - apps/mobile/hooks/useProfileExists.ts
  - apps/mobile/hooks/useSaveProfile.ts
  - apps/mobile/lib/commitSet.ts
  - apps/mobile/lib/effectiveLoad.ts
  - apps/mobile/lib/finishWorkout.ts
  - apps/mobile/lib/notifications.ts
  - apps/mobile/lib/onboardingDraft.ts
  - apps/mobile/lib/profileVersion.ts
  - apps/mobile/lib/restTimer.ts
  - apps/mobile/lib/settingsStore.ts
  - apps/mobile/lib/thresholdEstimates.ts
  - apps/mobile/package.json
  - apps/mobile/stores/sessionStore.ts
  - apps/mobile/tsconfig.json
  - packages/db/drizzle/0001_long_firebrand.sql
  - packages/db/drizzle/meta/_journal.json
  - packages/db/drizzle/meta/0001_snapshot.json
  - packages/db/drizzle/migrations.js
  - packages/db/src/__tests__/previous-session-query.test.ts
  - packages/db/src/__tests__/seed.test.ts
  - packages/db/src/__tests__/soft-delete.test.ts
  - packages/db/src/index.ts
  - packages/db/src/queries.ts
  - packages/db/src/schema.ts
  - packages/db/src/seed.ts
  - packages/engine/src/__tests__/bodyweight.test.ts
  - packages/engine/src/__tests__/carry.test.ts
  - packages/engine/src/__tests__/session.test.ts
  - packages/engine/src/bodyweight.ts
  - packages/engine/src/carry.ts
  - packages/engine/src/config.ts
  - packages/engine/src/index.ts
  - packages/engine/src/session.ts
  - packages/shared/package.json
  - packages/shared/src/__tests__/units.test.ts
  - packages/shared/src/index.ts
  - packages/shared/src/units.ts
  - packages/shared/tsconfig.json
  - packages/shared/vitest.config.mts
findings:
  critical: 3
  warning: 8
  info: 9
  total: 20
status: issues_found
---

# Phase 03: Code Review Report

**Reviewed:** 2026-07-09T21:43:48Z
**Depth:** standard
**Files Reviewed:** 63
**Status:** issues_found

## Summary

Reviewed the Phase 03 onboarding + lifting-logger implementation: the onboarding wizard, profile hooks, the active-session logger (session store, set rows, commit pipeline, rest timer, breakdown sheet), the finish/discard flow, Settings, and the supporting engine (carry/bodyweight), db (schema/queries/seed/migration), and shared (units) package changes.

Security posture is solid: every DB access is a parameterized drizzle builder (verified — no raw `sql` templates carrying user values; the two `sql` usages in `queries.ts` and `seed.ts` reference columns/`count(*)` only), errors surface as hardcoded generic strings, soft-delete filtering is centralized in `activeWorkoutFilter` and applied on `previousSessionSet`, `recentExerciseIds`, and `openWorkout`, and engine purity holds (no clock/I-O in `packages/engine`; timestamps passed in).

However, three critical correctness defects were found: (1) the engine silently ignores `isWarmup` for carry/timed sets, so warmup sled/carry/plank sets inflate HSS — directly contradicting the documented warmup-exclusion contract that the UI relies on; (2) the set-row load input reformats the controlled value on every keystroke, making decimal entry impossible and turning "62.5" into a stored 625 kg set; (3) the D-14 resume prompt calls `router.push` while the root layout has never rendered a navigator, which expo-router rejects — the Resume/Finish-Now paths won't navigate. A cluster of warnings follows around unit-conversion drift, the migration/seed upgrade gap, and open-workout lifecycle gaps.

## Critical Issues

### CR-01: Engine ignores `isWarmup` on carry sets — warmup timed sets inflate HSS

**File:** `packages/engine/src/carry.ts:25-57` (also `packages/engine/src/session.ts:47-51`)
**Issue:** `CarrySet.isWarmup` exists in the type (`packages/shared/src/index.ts:35-41`) and is populated by every caller (`lib/commitSet.ts:98`, `app/session/finish.tsx:122`, `HSSBreakdownSheet.tsx:56`), but `carryStressDetailed` never reads it — a warmup sled push / farmer's carry / plank contributes its full CS to the session HSS. This contradicts the established strength-side behavior (`strengthStressDetailed` skips warmups at `strength.ts:39-41`) and the explicit contract documented in `SetRow.tsx:97-99` ("Warmups never warn — they're excluded from HSS entirely, same as the real recompute"). The SetRow warning suppression (`if (!draft.committed || draft.isWarmup) return []`) and finish-screen duration exclusion both assume warmup carries are excluded — the persisted `workout.hss` says otherwise. `carry.test.ts` has no warmup case, so nothing catches it.
**Fix:**
```ts
// packages/engine/src/carry.ts — top of carryStressDetailed, after mergeConfig:
if (seg.isWarmup) {
  return { cs: 0, warnings: [] };
}
```
Add a regression test: a warmup carry set yields `cs === 0` and a session containing only warmup carries has `hss === 0`.

### CR-02: SetRow load input reformats on every keystroke — decimal entry impossible, "62.5" becomes 625 kg

**File:** `apps/mobile/components/session/SetRow.tsx:202-213`
**Issue:** The load `TextInput` is fully controlled with `value={formatWeightValue(draft.loadFieldKg, units)}` and `onChangeText` immediately parses and stores a number. Typing `62.` parses to `62`, and the re-render renders `"62"` — the decimal point is silently dropped, so the next keystroke `5` produces `"625"`. The user who meant 62.5 kg commits a 625 kg set (a 10× effective-load / e1RM / HSS corruption), and there is no way to type any fractional kg value at all (2.5 kg plate increments are the norm; the ±2.5 stepper is the only workaround). The same pattern breaks fractional lb entry in imperial mode, where each keystroke additionally round-trips through `lbToKgExact`/`kgToDisplayLb` rounding.
**Fix:** Keep the raw text in local component state and only parse into the draft; format from the draft only when not focused/editing:
```tsx
const [loadText, setLoadText] = useState<string | null>(null);
// value:
value={loadText ?? (draft.isBlank ? '' : formatWeightValue(draft.loadFieldKg, units))}
onChangeText={(text) => {
  const clean = text.replace(/[^0-9.]/g, '');
  setLoadText(clean);
  patch({ loadFieldKg: parseWeightInput(clean, units), isBlank: false });
}}
onBlur={() => setLoadText(null)}
```
(The steppers should also call `setLoadText(null)` so the formatted value re-syncs.)

### CR-03: ResumePrompt navigates before any navigator has mounted — Resume / Finish Now are dispatched into a void

**File:** `apps/mobile/app/_layout.tsx:106-133`
**Issue:** During boot, `RootLayout` returns `LoadingScreen`, then `ResumePrompt`, and only renders the `<Stack>` after `openWorkoutRow` becomes `null`. `onResume`/`onFinishNow` call `setOpenWorkoutRow(null)` and then `router.push(...)` synchronously in the same handler — at that moment React has not re-rendered, so no navigator has ever mounted. This is exactly the pattern expo-router documents as an error ("Attempted to navigate before mounting the Root Layout component. Ensure the Root Layout component is rendering a Slot, or other navigator on the first render"): the push either throws or is dropped, leaving the user on the default tab route with the open workout neither resumed nor finished (and re-prompting on next launch). The same conditional-non-navigator-on-first-render shape also breaks the error/loading gates' compatibility with router readiness.
**Fix:** Always render the `<Stack>` and overlay the boot states, or defer navigation until the navigator exists:
```tsx
// Option A (preferred): render <Stack> unconditionally; show ResumePrompt as an
// absolutely-positioned overlay (or a Modal) above it, so router.push targets a
// mounted navigator.
// Option B: store the pending target and push from a useEffect that runs after
// openWorkoutRow === null has re-rendered the Stack:
const [pendingRoute, setPendingRoute] = useState<Href | null>(null);
useEffect(() => {
  if (openWorkoutRow === null && pendingRoute) {
    router.push(pendingRoute);
    setPendingRoute(null);
  }
}, [openWorkoutRow, pendingRoute]);
```

## Warnings

### WR-01: Migration 0001 never backfills seeded exercises — upgraded installs get NULL `entryMode`/`bwFactor` and score timed sets as 0

**File:** `packages/db/drizzle/0001_long_firebrand.sql:1-3` (with `packages/db/src/seed.ts:96-104`)
**Issue:** `0001` adds `bw_factor`/`entry_mode`/`rest_timer_sec` as nullable columns, and `seedExercises` is guarded by count-before-insert, so any device that ran the Phase 2 build keeps NULL for all seeded rows forever. The picker offers "Sled Push" from the **in-memory** `STARTER_EXERCISES` (entryMode `'timed'`), so `commitSet` writes `reps: 0, durationS: n` — but `recomputeSessionHss` (`lib/commitSet.ts:88-109`) reads `entryMode` from the **DB** row (NULL) and routes the set into the strength branch, where `e1rmKg ?? 0` triggers the skip-with-warning path: the set scores 0 HSS. Bodyweight movements likewise lose their `bwFactor` on rehydrate/recompute. Two sources of truth (in-memory seed array vs. DB rows) diverging is the root hazard.
**Fix:** Append parameterless backfill `UPDATE exercise SET entry_mode = ..., bw_factor = ... WHERE id = ...` statements to the migration (static seed values, no user input), or replace the count guard with a per-id upsert (`INSERT ... ON CONFLICT(id) DO UPDATE SET bw_factor=excluded.bw_factor, entry_mode=excluded.entry_mode`).

### WR-02: Settings field editors seed from rounded display values — saving without editing silently drifts stored metric values

**File:** `apps/mobile/app/(tabs)/settings/index.tsx:119-128, 141-147`
**Issue:** `openFieldEditor('bodyweightKg')` seeds the editor with `String(kgToDisplayLb(kg))` (rounded to whole lb) or `String(Math.round(kg))` (metric). `commitBodyweight` then converts that rounded display value back to kg (`lbToKgExact(parsed)`), and "Save Changes" writes it. A user who opens the editor and taps Set without changing anything mutates their stored bodyweight (e.g. 80 kg → 176 lb → 79.8325 kg; metric 82.4 kg → 82 kg). This violates the project rule that unit conversion is display-only with exact round-trip, and the drifted bodyweight feeds every future effective-load/carry computation. The units toggle (`handleUnitsChange`) also updates the draft optimistically with no rollback if the UPDATE fails.
**Fix:** Track whether the field was actually edited (dirty flag, or compare the parsed display value against the display rendering of the original) and only include changed fields in the `Save Changes` patch; alternatively store the original kg and short-circuit when the re-parsed value round-trips to the same display string.

### WR-03: Nothing prevents creating a second open workout — orphaned open sessions accumulate

**File:** `apps/mobile/app/(tabs)/log/index.tsx:43-63`
**Issue:** `handleStart` unconditionally inserts a new `workout` row. If the user navigates back from the session screen (stack back-swipe — the session screen has no gesture guard) and taps "Start Workout" again, a second open (`finishedAt IS NULL`) workout is created while the first stays open forever. `openWorkout()` uses `.limit(1)` with no ORDER BY, so subsequent launches show the resume prompt for an arbitrary open row, one launch at a time, and any committed sets on the abandoned workout linger with a non-null `hss` on an unfinished row.
**Fix:** Before inserting, run `openWorkout(db)`; if a row exists, prime the store via `rehydrateFromDb` and navigate to it instead of inserting (or finish/discard it explicitly). Also consider `orderBy(desc(workout.createdAt))` in `openWorkout`.

### WR-04: Pending rest notification is not cancelled when the session ends — stray "Rest complete" fires after Done/Discard

**File:** `apps/mobile/app/session/finish.tsx:154-181` (with `apps/mobile/stores/sessionStore.ts:401`)
**Issue:** `handleDone`/`handleConfirmDiscard` call `reset()`, which wipes `restNotificationId` to null without cancelling the scheduled OS notification. If the athlete commits a set and finishes the workout inside the rest window (common: last set → Finish), a "Rest complete — Time to get back to it." notification fires after the session is over. The store already has `cancelPendingNotification` and the schedule-race guard, so this is the one lifecycle exit that leaks.
**Fix:** In `reset()` (or immediately before calling it), capture `restNotificationId` and call `cancelRestNotification(id)`:
```ts
reset: () => {
  const { restNotificationId } = get();
  void cancelRestNotification(restNotificationId);
  set({ ...INITIAL_SESSION });
},
```

### WR-05: `formatLastSessionSummary` always renders kg — imperial users see metric "Last:" pre-fill summaries

**File:** `apps/mobile/stores/sessionStore.ts:127-137`
**Issue:** The last-session summary hardcodes `` `Last: ${rounded} kg × ${reps}` `` with no units conversion, even though the store holds `units` and every other display surface (SetRow, ProfileReview, Settings) converts via `kgToDisplayLb`. An imperial athlete who logged 225 lb sees "Last: 102.1 kg × 5" — breaking the D-12 display-conversion contract on the exact surface used to anchor the next set.
**Fix:** Pass `units` into `formatLastSessionSummary` and format via the shared helpers:
```ts
const display = units === 'imperial'
  ? `${kgToDisplayLb(displayLoad)} lb`
  : `${Math.round(displayLoad * 10) / 10} kg`;
```

### WR-06: `addSet` derives `setNumber` from array length — delete-then-add produces duplicate persisted set numbers

**File:** `apps/mobile/stores/sessionStore.ts:208-227` (with `removeSet` at 229-237)
**Issue:** `setNumber: card.sets.length + 1` after a mid-list delete reuses an existing number (sets 1,2,3 → delete 2 → next add gets 3, duplicating the committed set 3). Duplicates persist into `strength_set.setNumber`, and `rehydrateFromDb` orders by `setNumber` (`sessionStore.ts:355`), so resumed sessions render committed sets in a nondeterministic order relative to each other.
**Fix:** `setNumber: Math.max(0, ...card.sets.map((s) => s.setNumber)) + 1`.

### WR-07: Settings screen spins forever if the profile read fails — no error state on the load path

**File:** `apps/mobile/app/(tabs)/settings/index.tsx:98-106` (with `apps/mobile/hooks/useProfile.ts:65-89`)
**Issue:** `useProfile.load()` swallows select errors (log-only) and leaves `profile === null` with `loading === false`; the Settings gate `if (loading || draft == null || profile == null)` then renders an `ActivityIndicator` indefinitely with no message, no retry, and no way out. The error message state in the hook is only wired to `update()`, not `load()`.
**Fix:** Set an error state in the `load` catch and render the standard generic error string with a retry action in the Settings gate instead of the bare spinner.

### WR-08: Onboarding review "edit bodyweight" loses the entered value — field re-opens blank, unlike the threshold steps

**File:** `apps/mobile/app/onboarding/bodyweight.tsx:27` (with `apps/mobile/app/onboarding/review.tsx:20-35`)
**Issue:** Tapping "Bodyweight" on the review screen routes back to `bodyweight.tsx`, whose text state initializes to `''` and ignores the existing `draft.bodyweightKg`. The previously entered value is invisible, Continue is disabled until the user re-types it, and they must then re-walk units → threshold-hr → threshold-pace to get back to review. `threshold-hr.tsx:33-35` and `threshold-pace.tsx:42-55` both correctly seed their inputs from the draft — bodyweight is the inconsistent one, on the exact D-04 tap-to-edit path the review screen exists for.
**Fix:** Seed the state from the draft, converting for display like the settings editor does:
```ts
const bodyweightKg = useOnboardingDraft((s) => s.bodyweightKg);
const [text, setText] = useState(
  bodyweightKg != null
    ? units === 'imperial' ? String(kgToDisplayLb(bodyweightKg)) : String(Math.round(bodyweightKg * 10) / 10)
    : '',
);
```

## Info

### IN-01: `previousSessionSet` has no deterministic tie-break within the most recent workout

**File:** `packages/db/src/queries.ts:50-70`
**Issue:** `ORDER BY workout.finished_at DESC LIMIT 1` leaves which of that workout's several sets is returned unspecified — the "Last: …" pre-fill may show the first warmup instead of the top set.
**Fix:** Add `desc(strengthSet.setNumber)` as a secondary sort (and consider excluding `isWarmup` rows).

### IN-02: Profile UPDATEs never bump `updatedAt`

**File:** `apps/mobile/hooks/useProfile.ts:104`
**Issue:** `user_profile.updatedAt` only ever holds its insert default; edits leave it stale.
**Fix:** `set({ ...patch, updatedAt: new Date() })`.

### IN-03: `startedAt ?? new Date()` creates a fresh Date every render

**File:** `apps/mobile/app/(tabs)/log/session.tsx:94`
**Issue:** While the `createdAt` query is in flight, each render passes a new `Date` to `LiveHssHeader`, re-running its elapsed-timer effect and resetting the tick each render.
**Fix:** Memoize a fallback (`useState(() => new Date())`) or render the header only once `startedAt` resolves.

### IN-04: Selecting an already-added exercise silently does nothing

**File:** `apps/mobile/stores/sessionStore.ts:166` (with `ExercisePickerSheet.tsx:160`)
**Issue:** `addExercise` early-returns on duplicates; the sheet closes and nothing visibly happens — no scroll-to-card, no feedback.
**Fix:** On duplicate, still close the sheet but scroll to / highlight the existing card (or surface a toast).

### IN-05: A transient `useProfileExists` failure can route an existing user into onboarding and insert a duplicate profile row

**File:** `apps/mobile/hooks/useProfileExists.ts:41-44` (with `useSaveProfile.ts:50-56`)
**Issue:** The fail-closed `false` default is right for safety, but `useSaveProfile` is insert-only with no uniqueness guard, so completing onboarding again creates a second `user_profile` row; all `limit(1)` reads then pick an unspecified row.
**Fix:** Make the onboarding save an upsert (or delete-then-insert on the single-row table), or add a unique constraint/row-id convention.

### IN-06: Seconds rounding can render "60" in mm:ss seeds

**File:** `apps/mobile/app/onboarding/threshold-pace.tsx:53` and `apps/mobile/app/(tabs)/settings/index.tsx:128`
**Issue:** `String(Math.round(displaySec % 60))` yields `"60"` for e.g. 359.5 s → shows "5:60"; committing turns it into 6:00, but the display is invalid.
**Fix:** Round total seconds first (`const s = Math.round(displaySec); Math.floor(s/60)` / `s % 60`).

### IN-07: Three copies of the units preference can diverge mid-session

**File:** `apps/mobile/stores/sessionStore.ts:79` (with `lib/settingsStore.ts`, `hooks/useProfile.ts:107`)
**Issue:** `sessionStore.units` is snapshotted at `startSession`/`rehydrateFromDb`; changing units in Settings during an active session updates `settingsStore` and the DB but the session's SetRows keep formatting in the old units.
**Fix:** Have SetRow read units from `useSettingsStore` (single mirror) instead of the session snapshot, or sync the session store on profile update.

### IN-08: Finish screen shows a fabricated HSS of 0 when the summary query fails

**File:** `apps/mobile/app/session/finish.tsx:146`
**Issue:** On query failure `setHss(0)` renders "0" as if it were a real score, contradicting the honest-number voice; `hss == null` already renders "—".
**Fix:** Leave `hss` null (renders "—") and optionally show the generic error string.

### IN-09: SetRow warning recompute hardcodes `isLowerBody: false`

**File:** `apps/mobile/components/session/SetRow.tsx:120`
**Issue:** Harmless today (engine warnings don't depend on `isLowerBody`), but the per-set warning derivation will silently diverge from the real recompute if lower-body-dependent warnings are ever added. The component already receives the exercise via `ExerciseCard` — the bodyPart is available.
**Fix:** Pass `bodyPart` (or a precomputed `isLowerBody`) into `SetRow` and use it, keeping the "SAME per-set formula" claim true by construction.

---

_Reviewed: 2026-07-09T21:43:48Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
