# Phase 9: Beta feedback round 1 - Pattern Map

**Mapped:** 2026-08-04
**Files analyzed:** 24 (modified) + 2 (new)
**Analogs found:** 26 / 26 (all in-repo — this phase introduces zero new libraries; every file has an exact intra-repo precedent per RESEARCH.md)

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `packages/db/src/schema.ts` (add 3 columns) | model | CRUD | same file, `units` column (schema.ts:28-53) | exact (self-extend) |
| `packages/db/drizzle/0005_*.sql` (new migration) | migration | batch | `packages/db/drizzle/0004_youthful_valkyrie.sql` | exact |
| `packages/db/src/__tests__/units-migration.test.ts` (new) | test | batch | `packages/db/src/__tests__/nutrition-schema.test.ts` | exact |
| `packages/shared/src/units.ts` (add oz/lb/tsp/tbsp helpers) | utility | transform | same file, `lbToKgExact`/`kgToDisplayLb` (lines 8-28) | exact (self-extend) |
| `apps/mobile/lib/foodUnits.ts` (new — conditional chip logic) | utility | transform | `apps/mobile/lib/logFood.ts` (`clampNonNegative`, `buildFoodLogRow`) | role-match |
| `apps/mobile/lib/settingsStore.ts` (units → 3 buckets) | store | event-driven | same file (full file read, 27 lines) | exact (self-extend) |
| `apps/mobile/hooks/useProfile.ts` (extend ProfileValues/ProfileUpdateInput) | hook | CRUD | same file, `heightCm`/`birthYear`/`goalMode` precedent (useProfile.ts:31-57) | exact (self-extend) |
| `apps/mobile/app/onboarding/units.tsx` (add Mixed path) | component | request-response | same file (single-choice step) | exact (self-extend) |
| `apps/mobile/app/(tabs)/settings/index.tsx` (3 unit rows + "How Apsis works" row) | component | request-response | same file (existing Units toggle row + HealthKit toggle pattern) | exact (self-extend) |
| `apps/mobile/app/(tabs)/index.tsx`, `app/(tabs)/log/run.tsx`, `app/session/finish.tsx`, `app/session/detail.tsx`, `app/session/share.tsx`, `app/onboarding/bodyweight.tsx`, `app/onboarding/threshold-pace.tsx`, `app/nutrition-setup/index.tsx`, `components/onboarding/ProfileReview.tsx`, `components/session/ExerciseCard.tsx` (units re-key) | component | request-response | each file's own existing `useSettingsStore((s) => s.units)` call site | exact (self-extend, mechanical sweep) |
| `apps/mobile/components/FoodConfirmSheet.tsx` (chip row + keyboard fix) | component | request-response | same file (meal-selector chip pattern + `keyboardBehavior="extend"` config) | exact (self-extend) |
| `apps/mobile/lib/logFood.ts` (`buildFoodLogRow` — no signature change, consumes new conversion) | service | transform | same file, `clampNonNegative` (lines 44-47) | exact (self-extend) |
| `apps/mobile/app/(tabs)/nutrition/log.tsx` (custom food + quick-add chip rows) | component | request-response | `FoodConfirmSheet.tsx` chip pattern | role-match |
| `apps/mobile/app/(tabs)/nutrition/recipe-edit.tsx` (ingredient qty chip row — NOT recipes.tsx, see Pitfall 2) | component | request-response | `FoodConfirmSheet.tsx` chip pattern | role-match |
| `apps/mobile/components/DecimalPadDoneBar.tsx` (new shared component) | component | request-response | RN core `InputAccessoryView` (no in-repo precedent — first use); `WizardStep.tsx`'s `KeyboardAvoidingView` for the Android/no-op fallback shape | new-pattern (RN core primitive) |
| `apps/mobile/app/(tabs)/log/session.tsx` (keyboard-safe ScrollView) | component | request-response | `apps/mobile/app/onboarding/WizardStep.tsx` (`KeyboardAvoidingView` + `Platform.OS` precedent) | role-match |
| `apps/mobile/stores/sessionStore.ts` (`removeExercise()` + `startRestTimer()` fix) | store | event-driven | same file, `removeSet` (244-252) + `addThirtySeconds`/`skipRest` (316-332) | exact (self-extend) |
| `apps/mobile/components/session/ExerciseCard.tsx` (overflow "···" affordance) | component | request-response | same file, `handleDelete` (59-73) + `DeleteAction` (35-45) | exact (self-extend) |
| `apps/mobile/lib/__tests__/sessionStore.test.ts` (new) | test | event-driven | `packages/db/src/__tests__/nutrition-schema.test.ts` (vitest structure, mocking pattern) | role-match |
| `apps/mobile/lib/__tests__/foodUnits.test.ts` (new) | test | transform | `packages/shared/src/units.ts` test file (existing, extend structure) | role-match |
| `apps/mobile/app/onboarding/explainer.tsx` (new — swipeable HSS/readiness/trend cards) | component | request-response | `apps/mobile/app/onboarding/_layout.tsx` + `WizardStep.tsx` (wizard step shape); `components/home/HssRing.tsx`/`ReadinessLight.tsx`/`TrendChart.tsx` (rendered content) | new-pattern (composes existing components) |
| `apps/mobile/app/onboarding/_layout.tsx` (insert explainer as step 1) | route | request-response | same file (existing step order array) | exact (self-extend) |

## Pattern Assignments

### `packages/db/src/schema.ts` + `packages/db/drizzle/0005_*.sql` (migration, batch)

**Analog:** `packages/db/drizzle/0004_youthful_valkyrie.sql`

**Schema addition pattern:**
```typescript
// packages/db/src/schema.ts — extend existing userProfile table (schema.ts:28-53)
units: text('units', { enum: ['metric', 'imperial'] }).default('metric'), // kept, legacy/rollback anchor
liftsUnits: text('lifts_units', { enum: ['metric', 'imperial'] }),
bodyweightUnits: text('bodyweight_units', { enum: ['metric', 'imperial'] }),
runUnits: text('run_units', { enum: ['metric', 'imperial'] }),
```

**Migration SQL pattern** (verbatim shape from 0004, lines 65-67):
```sql
ALTER TABLE `user_profile` ADD `lifts_units` text;--> statement-breakpoint
ALTER TABLE `user_profile` ADD `bodyweight_units` text;--> statement-breakpoint
ALTER TABLE `user_profile` ADD `run_units` text;--> statement-breakpoint
UPDATE `user_profile` SET `lifts_units` = `units`, `bodyweight_units` = `units`, `run_units` = `units`;
```
Journal: add entry `{ "idx": 5, "tag": "0005_<generated>" }` to `packages/db/drizzle/meta/_journal.json` (current highest idx is 4).

**Round-trip test pattern** — reuse `applyCommittedMigrations` verbatim from `packages/db/src/__tests__/nutrition-schema.test.ts:21-48`. Do not duplicate the harness; import it or extract to a shared test-utils module if it isn't already exported.

---

### `packages/shared/src/units.ts` (utility, transform)

**Analog:** same file, existing kg/lb pattern (lines 8-28)

**Core pattern to extend:**
```typescript
export const LB_PER_KG = 2.2046226218;
export function lbToKgExact(lb: number): number {
  return lb / LB_PER_KG;
}
export function kgToDisplayLb(kg: number): number {
  return Math.round(kg * LB_PER_KG);
}
```
New functions to add following this exact discipline (fixed-factor, exact round-trip, storage stays metric): `gramsToDisplayOz`, `ozToGramsExact`, `gramsToDisplayLb` (distinct from `kgToDisplayLb` — operates on grams not kg), `lbToGramsExact`. Keep `units.ts` scoped to fixed-factor conversions only.

### `apps/mobile/lib/foodUnits.ts` (new, utility, transform)

**Analog:** `apps/mobile/lib/logFood.ts` (`clampNonNegative`, input-validation discipline)

tsp/tbsp/serving conversions are NOT fixed-factor — gate entirely on `food.servingGrams` presence, no fabricated density table (D-06). This module takes a `food`-shaped input, unlike `units.ts`'s pure constants, so it belongs in `apps/mobile/lib/`, not `packages/shared/`.

---

### `apps/mobile/lib/settingsStore.ts` (store, event-driven)

**Full existing file (27 lines) — the exact shape to extend to three buckets:**
```typescript
import { create } from 'zustand';
import type { Units } from '@apsis/shared';

interface SettingsState {
  units: Units;
  setUnits: (units: Units) => void;
}

export const useSettingsStore = create<SettingsState>()((set) => ({
  units: 'metric',
  setUnits: (units) => set({ units }),
}));
```
Extend to `{ liftsUnits, bodyweightUnits, runUnits }` (drop or deprecate the single `units` field on the store — the DB column `units` stays for rollback per D-04, but the store's job is display fan-out to the three buckets). `useProfile.ts` hydrates this store on load/update exactly as it does today for the single `units` value.

---

### `apps/mobile/stores/sessionStore.ts` — `removeExercise()` (store, event-driven)

**Analog:** `removeSet` (in-memory removal) + `ExerciseCard.tsx`'s `handleDelete` (DB-cleanup-before-in-memory-removal, lines 59-73)

**Pattern to mirror (from ExerciseCard.tsx:59-73, the DB-first-then-memory discipline):**
```typescript
async function handleDelete(set: SetDraft): Promise<void> {
  if (set.committed && workoutId) {
    try {
      const result = await uncommitSet(db, workoutId, set.id, profileBodyweightKg);
      setLiveHss(result.hss, result.warnings);
    } catch (err: unknown) {
      console.error('[Apsis] uncommitSet (swipe-delete) failed:', err);
      return; // don't touch in-memory state if DB delete failed
    }
  }
  removeSet(exercise.exerciseId, set.id);
}
```
`removeExercise` must loop the exercise's committed set ids through an `uncommitSet`-style bulk delete (filtered by `strengthSet.workoutId` + `strengthSet.exerciseId`), call `recomputeSessionHss` once (not per-set), and only remove the exercise from `sessionStore.exercises` after the DB operation succeeds.

### `apps/mobile/stores/sessionStore.ts` — `startRestTimer()` fix (D-21)

**Analog:** `addThirtySeconds` (sessionStore.ts:316-326) — the correct cancel-then-reschedule pattern

**Exact pattern to mirror:**
```typescript
addThirtySeconds: () => {
    const { restTimerEndsAt, restNotificationId } = get();
    if (restTimerEndsAt == null) return;
    const nextEndsAt = restTimerEndsAt + 30_000;
    set({ restTimerEndsAt: nextEndsAt, restNotificationId: null });
    void cancelRestNotification(restNotificationId, '+30s reschedule (old id)');
    void scheduleRestNotification(nextEndsAt).then((id) => {
      if (get().restTimerEndsAt === nextEndsAt) set({ restNotificationId: id });
      else void cancelRestNotification(id, '+30s stale-schedule race guard');
    });
  },
```
**The bug** (sessionStore.ts:302-306, `startRestTimer`):
```typescript
set({ restTimerEndsAt: endsAt, restNotificationId: null });  // BUG: old id discarded, never cancelled
```
**The fix:** capture `get().restNotificationId` before this `set()` call and `void cancelRestNotification(previousId, 'startRestTimer supersedes prior rest')` in the same position `addThirtySeconds` does — a 1-2 line diff, not a redesign.

---

### `apps/mobile/components/session/ExerciseCard.tsx` — overflow affordance (D-20)

**Analog:** same file — `DeleteAction` component (lines 35-45) as the visual/interaction template for a new header-level "···" button

```typescript
function DeleteAction({ onPress }: { onPress: () => void }): React.JSX.Element {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel="Delete set"
      style={styles.deleteAction}>
      <Text style={styles.deleteActionLabel}>Delete</Text>
    </Pressable>
  );
}
```
Card header currently renders `exercise.name` + `lastSessionSummary` (lines 76-80) with no overflow control — add a `Pressable` with `accessibilityLabel="Remove exercise"` opening a confirmation (mirror the discard-session confirmation dialog pattern already used elsewhere in the session flow) before calling `sessionStore.removeExercise`.

---

### `apps/mobile/components/DecimalPadDoneBar.tsx` (new shared component, D-11/D-13)

**No exact in-repo analog — first use of `InputAccessoryView`.** Follow RN core API directly, gated `Platform.OS !== 'ios' → return null` (Android has no equivalent problem per A2).

```tsx
import { InputAccessoryView, Keyboard, Platform, Pressable, Text, View } from 'react-native';

const INPUT_ACCESSORY_ID = 'apsis-decimal-done-bar';

export function DecimalPadDoneBar(): React.JSX.Element | null {
  if (Platform.OS !== 'ios') return null;
  return (
    <InputAccessoryView nativeID={INPUT_ACCESSORY_ID}>
      <View style={styles.bar}>
        <Pressable onPress={() => Keyboard.dismiss()} accessibilityRole="button" accessibilityLabel="Done">
          <Text style={styles.doneLabel}>Done</Text>
        </Pressable>
      </View>
    </InputAccessoryView>
  );
}
// Each TextInput opts in: <TextInput inputAccessoryViewID={INPUT_ACCESSORY_ID} ... />
```
**Open risk (verify on-device early):** `FoodConfirmSheet`'s quantity field is `BottomSheetTextInput` (`@gorhom/bottom-sheet`), which may not forward `inputAccessoryViewID` the same way plain `TextInput` does — the sheet already configures `keyboardBehavior="extend"` / `keyboardBlurBehavior="none"` (FoodConfirmSheet.tsx:145-146), which may need to satisfy D-12's stay-visible requirement on its own without an accessory bar inside the sheet.

### `apps/mobile/app/(tabs)/log/session.tsx` (keyboard-safe ScrollView, D-14)

**Analog:** `apps/mobile/app/onboarding/WizardStep.tsx` (`KeyboardAvoidingView` + `Platform.OS` behavior — the existing in-repo precedent for the same problem)

**Critical guard (Pitfall 4):** any new effect added for focused-field-scroll-into-view tracking MUST use `useFocusEffect` (matching session.tsx:62-90's existing pattern), never a plain `useEffect` — a plain effect on this screen previously caused a documented Phase 03 P10 rehydration bug that wiped `restTimerEndsAt`/`restNotificationId`.

---

### `apps/mobile/app/onboarding/explainer.tsx` (new, D-15..D-19)

**Analog:** `apps/mobile/app/onboarding/_layout.tsx` + `WizardStep.tsx` (wizard step shape/insertion point); renders existing components with sample data:

```typescript
// Source: apps/mobile/components/home/HssRing.tsx:57-67
export interface HssRingProps {
  size: number;
  hss: number;
  band: ReadinessBand;
  calibratingDayN?: number;
  animate?: boolean; // pass false for the explainer card's sample render (no count-up)
  onPress?: () => void;
}
// Source: apps/mobile/components/home/ReadinessLight.tsx:35-37
export interface ReadinessLightProps { band: ReadinessBand; }
// Source: apps/mobile/components/home/TrendChart.tsx:46-69
export interface TrendChartPoint {
  day: number; hss: number; atl: number; ctl: number; tsb: number; dateLabel: string;
  [key: string]: number | string;
}
export interface TrendChartProps { data: TrendChartPoint[]; calibratingDayN?: number; }
```
Construct a hardcoded `TrendChartPoint[]` sample array; pass `animate={false}` to `HssRing`. No DB read, no new props needed on any of the three components. Insert as step 1 in `onboarding/_layout.tsx`'s step order, ahead of `sex`. Add a "How Apsis works" row in `settings/index.tsx` reopening the same component with `router.push`.

---

## Shared Patterns

### Input validation for new unit-conversion parsers (D-05..D-10, V5 ASVS)
**Source:** `apps/mobile/lib/logFood.ts:44-47` (`clampNonNegative`), `FoodConfirmSheet.tsx:80-83`
**Apply to:** every new oz/lb/tsp/tbsp text input across `FoodConfirmSheet.tsx`, `nutrition/log.tsx`, `nutrition/recipe-edit.tsx` — regex-strip non-numeric chars on `onChangeText`, `Number.isFinite` + `>= 0` guard before any arithmetic, same discipline as the existing grams parser. A negative/NaN quantity must never reach `buildFoodLogRow`.

### DB-cleanup-before-in-memory-removal (D-20)
**Source:** `apps/mobile/components/session/ExerciseCard.tsx:59-73` (`handleDelete`), `apps/mobile/lib/commitSet.ts:161-174` (`uncommitSet`)
**Apply to:** `sessionStore.ts`'s new `removeExercise` — DB delete + HSS recompute must complete (and succeed) before the in-memory list changes; on error, keep the in-memory state and surface the failure, never silently drift from the SQLite source of truth.

### Cancel-before-reschedule for OS notifications (D-21)
**Source:** `apps/mobile/stores/sessionStore.ts:316-332` (`addThirtySeconds`, `skipRest`)
**Apply to:** `startRestTimer` — capture and cancel the outgoing `restNotificationId` before scheduling the new one. This is a paired invariant (Phase 03 P10 lesson in STATE.md) — do not touch `resolveRestDuration`/`startRest`/`scheduleRestNotification` while fixing this.

### `useFocusEffect` over plain `useEffect` on stacked screens (Phase 03 P10 precedent)
**Source:** `apps/mobile/app/(tabs)/log/session.tsx:62-90`
**Apply to:** any new effect added to `session.tsx` for D-14's keyboard-safety work — expo-router keeps prior stack screens mounted, so an ungated effect fires on unfocused instances too.

### Round-trip migration proof harness (Phase 07 precedent, reuse don't duplicate)
**Source:** `packages/db/src/__tests__/nutrition-schema.test.ts:21-48` (`applyCommittedMigrations`)
**Apply to:** `units-migration.test.ts` — apply every committed `.sql` in journal order to an in-memory `better-sqlite3` DB, assert new columns exist and the D-04 backfill produced correct values.

### Zustand mirror-of-DB-row store shape
**Source:** `apps/mobile/lib/settingsStore.ts` (full file, 27 lines)
**Apply to:** the three-bucket `settingsStore` extension — store never writes to DB directly, only mirrors; `useProfile.ts` remains the single hydration point (matching `heightCm`/`birthYear`/`goalMode` precedent, useProfile.ts:31-57).

## No Analog Found

| File | Role | Data Flow | Reason |
|---|---|---|---|
| `apps/mobile/components/DecimalPadDoneBar.tsx` | component | request-response | First use of `InputAccessoryView` in this repo — no existing accessory-bar component to copy structurally, though `WizardStep.tsx`'s `KeyboardAvoidingView`/`Platform.OS` gating pattern informs the Android no-op branch |
| `apps/mobile/app/onboarding/explainer.tsx` | component | request-response | First swipeable-card onboarding step — no existing paginated/swipe-dot component in the wizard; composes three existing home-screen components (`HssRing`, `ReadinessLight`, `TrendChart`) with sample data instead of a live DB read |

## Metadata

**Analog search scope:** `apps/mobile/{app,components,lib,stores,hooks,constants}`, `packages/{db,shared}/src`
**Files scanned this session:** 24 (all read directly per RESEARCH.md's Primary Sources list, plus `settingsStore.ts` and `ExerciseCard.tsx` opening section re-verified this pass)
**Pattern extraction date:** 2026-08-04
