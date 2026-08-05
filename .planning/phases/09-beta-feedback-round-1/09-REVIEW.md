---
phase: 09-beta-feedback-round-1
reviewed: 2026-08-04T00:00:00Z
depth: standard
files_reviewed: 39
files_reviewed_list:
  - apps/mobile/app/(tabs)/index.tsx
  - apps/mobile/app/(tabs)/log/run.tsx
  - apps/mobile/app/(tabs)/log/session.tsx
  - apps/mobile/app/(tabs)/nutrition/log.tsx
  - apps/mobile/app/(tabs)/nutrition/recipe-edit.tsx
  - apps/mobile/app/(tabs)/settings/index.tsx
  - apps/mobile/app/explainer.tsx
  - apps/mobile/app/nutrition-setup/index.tsx
  - apps/mobile/app/onboarding/_layout.tsx
  - apps/mobile/app/onboarding/bodyweight.tsx
  - apps/mobile/app/onboarding/explainer.tsx
  - apps/mobile/app/onboarding/review.tsx
  - apps/mobile/app/onboarding/threshold-pace.tsx
  - apps/mobile/app/onboarding/units.tsx
  - apps/mobile/app/session/detail.tsx
  - apps/mobile/app/session/finish.tsx
  - apps/mobile/app/session/share.tsx
  - apps/mobile/components/DecimalPadDoneBar.tsx
  - apps/mobile/components/FoodConfirmSheet.tsx
  - apps/mobile/components/onboarding/ExplainerCards.tsx
  - apps/mobile/components/onboarding/ProfileReview.tsx
  - apps/mobile/components/session/ExerciseCard.tsx
  - apps/mobile/components/session/SetRow.tsx
  - apps/mobile/hooks/useProfile.ts
  - apps/mobile/hooks/useSaveProfile.ts
  - apps/mobile/lib/__tests__/foodUnits.test.ts
  - apps/mobile/lib/__tests__/sessionStore.test.ts
  - apps/mobile/lib/commitSet.ts
  - apps/mobile/lib/foodUnits.ts
  - apps/mobile/lib/onboardingDraft.ts
  - apps/mobile/lib/settingsStore.ts
  - apps/mobile/stores/sessionStore.ts
  - packages/db/drizzle/0005_clean_champions.sql
  - packages/db/drizzle/meta/_journal.json
  - packages/db/drizzle/meta/0005_snapshot.json
  - packages/db/drizzle/migrations.js
  - packages/db/src/__tests__/migrationHarness.ts
  - packages/db/src/__tests__/nutrition-schema.test.ts
  - packages/db/src/__tests__/units-migration.test.ts
  - packages/db/src/schema.ts
  - packages/shared/src/__tests__/units.test.ts
  - packages/shared/src/units.ts
findings:
  critical: 1
  warning: 2
  info: 1
  total: 4
status: issues_found
---

# Phase 09: Code Review Report

**Reviewed:** 2026-08-04
**Depth:** standard
**Files Reviewed:** 39 (some counted once though touched by multiple concerns)
**Status:** issues_found

## Summary

Reviewed the units-preference split (single `units` → `liftsUnits`/`bodyweightUnits`/`runUnits`
with SQLite migration 0005 + silent backfill), food-quantity unit conversion helpers, the
lifting-logger rest-timer/removeExercise fixes, the shared `DecimalPadDoneBar`, and the
onboarding explainer cards.

The migration (0005), the backfill/round-trip tests (`units-migration.test.ts`), the
`foodUnits.ts` conversion module and its tests, the rest-timer cancel-before-reschedule fix in
`sessionStore.ts`, and the DB-first `removeExercise` bulk-delete + recompute path are all solid
and match their documented contracts.

The one significant defect is that the units split was not fully swept into the **Settings**
screen's profile editor: `Settings` still seeds and drives its `ProfileReview`/bodyweight/
threshold-pace editing UI from the legacy single `profile.units` value instead of the new
`bodyweightUnits`/`runUnits` buckets the same screen's own "Units" section writes
independently. This can silently misconvert a manually-entered bodyweight (an ~2.2x error) and
makes the Profile section's "Units" row an apparently-dead control once a user has used the
per-domain rows below it. A related, lower-severity version of the same omission exists on the
onboarding review screen (display-only, since the actual save path already passes the correct
per-bucket values).

## Critical Issues

### CR-01: Settings screen's Profile editor still resolves bodyweight/pace units from the legacy `profile.units` field, not the split buckets it just wrote

**File:** `apps/mobile/app/(tabs)/settings/index.tsx:154, 206, 213, 413-420, 592, 654`
**Issue:**
Phase 09's D-03 goal is that Lifts/Bodyweight/Runs persist and display **independently**. The
three `UnitsRow` controls in the "Units" section (lines 422-442) correctly read/write
`profile.liftsUnits` / `profile.bodyweightUnits` / `profile.runUnits` directly. However, the
"Profile" section above it renders `<ProfileReview values={draft} .../>` (lines 413-420) without
passing `bodyweightUnits`/`runUnits` props, and `draft` itself is seeded only from the legacy
column:

```ts
// line 149-156
setDraft({
  sex: profile.sex,
  bodyweightKg: profile.bodyweightKg,
  thresholdHr: profile.thresholdHr,
  thresholdPaceSecPerKm: profile.thresholdPaceSecPerKm,
  units: profile.units,   // <-- legacy single column, never bodyweightUnits/runUnits
});
```

`ProfileReview` does have a fallback (`values.bodyweightUnits ?? values.units`), but since
Settings never supplies `bodyweightUnits`/`runUnits`, that fallback always resolves to the stale
legacy value. The same legacy `draft.units` variable also drives the bodyweight and
threshold-pace **edit modals** directly:

```ts
// line 206
const isImperial = draft.units === 'imperial';
...
// commitBodyweight (line 237-251)
const kg = isImperial ? lbToKgExact(parsed) : parsed;   // wrong conversion basis
```

Consequences:
1. **Data corruption risk.** If a user sets `Bodyweight` = Imperial via the three-row Units
   section (independently of `Lifts`, exactly the scenario D-02/D-03 exist to support) while
   the legacy `units` stays Metric (it's never touched by `handleBucketUnitsChange`), the
   bodyweight edit modal still labels the field "kg" and converts a typed number as kg. A user
   who types their weight believing the field is in lb (because they set Bodyweight=Imperial)
   gets a value stored ~2.2x too high, corrupting every downstream bodyweight-dependent
   calculation (effective load for bodyweight movements, HSS, BMR/macro targets).
2. **Broken/dead control.** The "Units" row rendered by `ProfileReview` (its `field: 'units'`
   row, mirrored via `openFieldEditor`'s `field === 'units'` branch at line 210-215) toggles
   only the legacy `profile.units` column via `handleUnitsChange` (line 276-286). Toggling it
   has **no visible effect** anywhere else in the app (lift KG/LB headers, run pace/distance,
   nutrition height field all read the three split buckets), so a user who taps it will
   reasonably conclude the control is broken — while it also does nothing to fix the mismatch
   described in (1).

**Fix:**
```tsx
<ProfileReview
  values={{ ...draft, bodyweightUnits: profile.bodyweightUnits, runUnits: profile.runUnits }}
  ...
/>
```
And replace every `isImperial = draft.units === 'imperial'` use that drives bodyweight display/
entry with `profile.bodyweightUnits === 'imperial'`, and every one driving threshold-pace
display/entry with `profile.runUnits === 'imperial'`. Once those buckets are the source of
truth, either remove the legacy "Units" row from `ProfileReview` entirely for this caller (it
now fully duplicates the "Lifts" row) or make it read-only/derived, so there is exactly one
control per unit domain.

## Warnings

### WR-01: Onboarding review screen omits `bodyweightUnits`/`runUnits` when rendering `ProfileReview`, mislabeling bodyweight/pace under Mixed units

**File:** `apps/mobile/app/onboarding/review.tsx:73-83`
**Issue:** The review screen's `ProfileReview` call passes only `units: draft.liftsUnits` and
no `bodyweightUnits`/`runUnits`:

```tsx
<ProfileReview
  values={{
    sex: draft.sex,
    bodyweightKg: draft.bodyweightKg,
    thresholdHr: draft.thresholdHr,
    thresholdPaceSecPerKm: draft.thresholdPaceSecPerKm,
    units: draft.liftsUnits,
  }}
  ...
/>
```
The accompanying comment ("single-choice sets all three buckets equal") only accounts for the
fast Metric/Imperial path. In the Mixed path (`onboarding/units.tsx`), `liftsUnits`,
`bodyweightUnits`, and `runUnits` can legitimately diverge — that is the entire point of D-02.
When they do, the review screen's Bodyweight and Threshold-pace rows will display/convert using
`liftsUnits` instead of the bucket the user actually picked for that domain (e.g. a user who
chose imperial bodyweight but metric runs will see their threshold pace rendered in `/km` on
this screen, or their bodyweight in the wrong unit label).

This is display-only — `handleSubmit` (line 51-58) correctly passes `liftsUnits`,
`bodyweightUnits`, and `runUnits` independently to `save()`, so the persisted data is correct.
Only the pre-save review rendering is wrong, which could still make a user distrust or
second-guess a value that is actually fine (or fail to notice one that is actually wrong).

**Fix:** Pass `bodyweightUnits: draft.bodyweightUnits, runUnits: draft.runUnits` alongside
`units: draft.liftsUnits` in the `values` object, matching the props `ProfileReview` already
supports.

### WR-02: `formatEnduranceMeta` is hand-duplicated across three files with no shared source

**File:** `apps/mobile/app/(tabs)/index.tsx:110-142`, `apps/mobile/app/session/finish.tsx:86-119` (`formatEnduranceSummary`), `apps/mobile/app/session/detail.tsx:86-118`
**Issue:** The per-activity-type endurance summary formatting (run/erg distance+pace+duration
vs. conditioning duration+HR) is implemented three times, byte-for-byte identical in logic,
across `(tabs)/index.tsx`, `session/finish.tsx`, and `session/detail.tsx`. Each copy is
individually correct and each carries a comment acknowledging the duplication is deliberate
("outside this plan's declared file scope"), but three independent copies of unit-conversion
logic (imperial/metric, `/500M` erg splits, etc.) is exactly the kind of surface where a future
edit to one copy silently drifts from the other two — precisely the "Don't Hand-Roll" principle
these files' own comments elsewhere invoke for engine math.
**Fix:** Extract to a shared helper (e.g. `apps/mobile/lib/enduranceMeta.ts`) in a follow-up
pass; not blocking for this phase given the explicit file-scope constraint documented in each
copy, but worth tracking so it doesn't accumulate a fourth copy.

## Info

### IN-01: Redundant/legacy `units` field kept live in `ProfileUpdateInput` and `ProfileReview` alongside the new split buckets

**File:** `apps/mobile/hooks/useProfile.ts:56`, `apps/mobile/components/onboarding/ProfileReview.tsx:27, 104`
**Issue:** `ProfileUpdateInput.units` and `ProfileReviewValues.units` remain live, editable
fields distinct from `liftsUnits`/`bodyweightUnits`/`runUnits`. The schema comment
(`packages/db/src/schema.ts:38`) states the legacy `units` column "is no longer read for display
once the 09-05 consumer sweep completes" — but CR-01 shows Settings still both reads and writes
it as a user-facing control. Once CR-01 is fixed, consider whether `units` should remain writable
from the UI at all, or become purely an internal migration anchor.
**Fix:** After CR-01's fix, audit whether the legacy `units` row/toggle should be removed from
user-facing surfaces entirely (kept only as the migration-time backfill source), to avoid
reintroducing this class of bug.

---

_Reviewed: 2026-08-04_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
