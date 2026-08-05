# Phase 9: Beta feedback round 1 - Research

**Researched:** 2026-08-04
**Domain:** React Native / Expo SDK 56 UI fixes + a schema migration on an existing production app (no new frameworks — this is surgical work inside an established codebase)
**Confidence:** HIGH

## Summary

Phase 9 is not greenfield research — it is seven small, independent fixes against a codebase
whose every touched file was read this session. There is no new library to evaluate: every
mechanism needed (input-accessory keyboard bar, `KeyboardAvoidingView`, a drizzle migration,
a zustand store update, an `expo-notifications` cancel-before-reschedule fix) already has an
established precedent inside this repo. The job is to follow those precedents exactly, not
introduce new ones.

The two structurally significant items are (1) the units-preference split, which is a real
DB migration (`user_profile` gains three new enum columns, seeded from the existing `units`
column, then ~10 call sites re-key to the right bucket) and (2) the food-quantity chip row,
which needs new pure conversion helpers in `packages/shared/src/units.ts` (oz/lb/tsp/tbsp) —
extending the existing exact-round-trip discipline, not replacing it. Everything else (the
keyboard Done bar, delete-exercise, the rest-timer notification-leak fix, the onboarding
explainer) is UI work with an exact existing component to copy or a one-line root-cause fix.

**Primary recommendation:** Do the DB migration + shared conversion helpers first (items 2–3
depend on them and every UI plan needs the underlying types to exist); build the Done
accessory bar as a single new shared component before touching any of the six screens D-13
lists; fix the notification bug in an isolated one-line diff verified by a unit test on
`sessionStore.ts`; treat the units split's ~10 call-site re-key as a mechanical sweep with a
grep-verifiable acceptance criterion, matching the Phase 03 Spacing-token-rename precedent
already used in this codebase.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Units preference storage (3 columns) | Database / Storage | — | `user_profile` row, single source of truth; display-only conversion happens above it |
| Units display conversion (kg/lb, km/mi, g/oz) | Client (pure functions) | — | `packages/shared/src/units.ts` — zero I/O, matches existing kg/lb/km/mi convention |
| Units state fan-out to screens | Client (zustand) | — | `settingsStore.ts` mirrors the profile row's units columns for cheap cross-screen reads (existing pattern, extend not replace) |
| Food quantity entry + chip row | Client (React Native UI) | — | `FoodConfirmSheet` + 2 other screens; pure UI, storage stays grams |
| Keyboard-safe input (Done bar, scroll-into-view) | Client (React Native UI) | — | `InputAccessoryView` (iOS-only, RN core) + `KeyboardAvoidingView`, no native module needed |
| Rest-timer notification cancel/reschedule | Client (Zustand store + expo-notifications) | OS (Notification Center) | `sessionStore.ts` owns the state machine; `lib/notifications.ts` is the thin native wrapper |
| Exercise delete + committed-set cleanup | Client (Zustand store) | Database / Storage | UI state removal + SQLite `strength_set` delete + HSS recompute, mirrors existing `uncommitSet` |
| Onboarding explainer (HSS/readiness/trend cards) | Client (React Native UI) | — | Renders existing `HssRing`/`ReadinessLight`/`TrendChart` components with sample data, no new data layer |

## Standard Stack

No new packages this phase. Every mechanism is either React Native core, an already-installed
dependency, or a pure-function addition to an existing in-repo module.

### Core (already installed — versions confirmed from `apps/mobile/package.json` this session)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| expo | ~56.0.12 | App framework | CLAUDE.md-locked; unchanged this phase [VERIFIED: apps/mobile/package.json] |
| react-native | 0.85.3 | Runtime | Ships `InputAccessoryView` (iOS) and `KeyboardAvoidingView` — no new dep needed for D-11/D-14 [VERIFIED: apps/mobile/package.json] |
| drizzle-orm | 0.45.2 | ORM | Migration 0005 for the units split follows the exact 0004 pattern (`ALTER TABLE user_profile ADD ...`) [VERIFIED: packages/db/package.json:8] |
| drizzle-kit | (workspace-pinned, matches 0.31.10 per CLAUDE.md) | Migration generation | Generates `0005_*.sql` + updates `meta/_journal.json` idx 5 |
| @gorhom/bottom-sheet | ^5.2.14 | Bottom sheets | `FoodConfirmSheet` already uses `keyboardBehavior="extend"` / `keyboardBlurBehavior="none"` — D-12's stay-visible requirement is a sheet-config tuning problem, not a new dependency [VERIFIED: apps/mobile/components/FoodConfirmSheet.tsx:145-146] |
| react-native-gesture-handler | ~3.0.2 | Swipe-to-delete | `ExerciseCard.tsx` already uses `ReanimatedSwipeable` for per-set delete — the same primitive is available for D-20's exercise-level overflow action if a swipe is chosen, though D-20 specifies an explicit "···"/× button, not a gesture [VERIFIED: apps/mobile/components/session/ExerciseCard.tsx:19] |
| expo-notifications | ~56.0.20 | Rest-timer completion signal | No API change needed — D-21 fixes a call-site bug in `sessionStore.ts`, not the notification wrapper itself [VERIFIED: apps/mobile/package.json] |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| better-sqlite3 | ^11.10.0 (devDependency of @apsis/db only) | Migration round-trip proof | Reuse the exact Phase 07 harness (`nutrition-schema.test.ts`) for the units-split migration test — do not write a new harness [VERIFIED: packages/db/src/__tests__/nutrition-schema.test.ts:21-48, quoted below] |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `InputAccessoryView` (RN core, iOS-only) for the Done bar | `react-native-keyboard-controller`'s `KeyboardToolbar` | Not installed in this repo [VERIFIED: grep of apps/mobile for keyboard-controller returned no matches]; adding a new native module this late (build-10 EAS cycle) is exactly the risk BUILD.md/CLAUDE.md warns against — `InputAccessoryView` ships in RN core and needs zero native linking |
| `KeyboardAvoidingView` for D-14's session-screen fix | `react-native-keyboard-controller`'s `KeyboardAwareScrollView` | Same reasoning — `WizardStep.tsx` (onboarding) already uses `KeyboardAvoidingView` + `Platform.OS` behavior for exactly this problem; matching that in-repo precedent is lower-risk than a new dependency four weeks from submission |

**Installation:** None required — every mechanism above is either RN core or already in `package.json`.

**Version verification:** All versions above were read directly from `apps/mobile/package.json` and `packages/db/package.json` this session via `node -e "require(...)"` — not fetched from an external registry, since nothing new is installed. No `npm view` verification needed.

## Package Legitimacy Audit

**Not applicable — this phase installs zero new packages.** Confirmed via the 09-CONTEXT.md
code_context note ("No new native modules expected in this phase") and cross-checked here: every
mechanism (input-accessory bar, keyboard avoidance, notification cancel, DB migration) resolves to
an existing dependency or React Native core API.

**Packages removed due to [SLOP] verdict:** none (n/a — no packages evaluated)
**Packages flagged as suspicious [SUS]:** none (n/a — no packages evaluated)

## Architecture Patterns

### System Architecture Diagram

```
                    ┌─────────────────────────────────────────────┐
                    │        user_profile (SQLite, 1 row)          │
                    │  units (legacy, kept)                        │
                    │  lifts_units | bodyweight_units | run_units   │◄──── Migration 0005
                    │  (new, D-01) — seeded from `units` (D-04)     │      (blocking, this phase)
                    └───────────────────┬───────────────────────────┘
                                        │ read on load / write on change
                                        ▼
                    ┌─────────────────────────────────────────────┐
                    │   settingsStore.ts (zustand, display mirror)  │
                    │   units: Units → { liftsUnits, bwUnits,       │
                    │            runUnits }  (D-01 fan-out)         │
                    └───────────────────┬───────────────────────────┘
                                        │ consumed by ~10 screens (re-keyed to correct bucket)
              ┌─────────────────────────┼──────────────────────────────┐
              ▼                         ▼                              ▼
    ┌──────────────────┐    ┌──────────────────────┐      ┌───────────────────────┐
    │ Lifting screens    │    │ Bodyweight screens    │      │ Run/pace screens        │
    │ (session, finish,  │    │ (onboarding bw,        │      │ (log/run.tsx,           │
    │  ExerciseCard,      │    │  ProfileReview,        │      │  threshold-pace.tsx)    │
    │  settingsStore.lifts)│   │  settingsStore.bw)     │      │  settingsStore.run      │
    └──────────────────┘    └──────────────────────┘      └───────────────────────┘

    ┌───────────────────────────────────────────────────────────────────────────┐
    │  FoodConfirmSheet.tsx / nutrition/log.tsx custom-food / recipe-edit.tsx     │
    │  qty TEXT INPUT → parseQtyInput(unit) → grams  (D-05..D-10)                 │
    │       g · kg · oz · lb  (always)                                            │
    │       tsp · tbsp · serving  (conditional on food.servingGrams presence)     │
    │  storage: buildFoodLogRow() writes qtyGrams (unchanged — grams only)        │
    └───────────────────────────────────────────────────────────────────────────┘

    ┌───────────────────────────────────────────────────────────────────────────┐
    │  Decimal-pad TextInput (any screen) → InputAccessoryView "Done" bar         │
    │  (new shared component, D-13) rolled out app-wide, dismiss on tap           │
    └───────────────────────────────────────────────────────────────────────────┘

    ┌───────────────────────────────────────────────────────────────────────────┐
    │  sessionStore.startRestTimer(exerciseId)                                    │
    │    1. cancelRestNotification(get().restNotificationId)  ← NEW (D-21 fix)    │
    │    2. resolve duration → set restTimerEndsAt, restNotificationId: null      │
    │    3. scheduleRestNotification(endsAt) → set new restNotificationId         │
    └───────────────────────────────────────────────────────────────────────────┘

    ┌───────────────────────────────────────────────────────────────────────────┐
    │  Onboarding wizard: [Explainer (NEW, step 1)] → sex → units → bodyweight    │
    │    → threshold-hr → threshold-pace → review → healthkit                    │
    │  Explainer cards render HssRing / ReadinessLight / TrendChart with          │
    │  hardcoded sample data (no DB read) — same components Home already uses    │
    └───────────────────────────────────────────────────────────────────────────┘
```

### Recommended Task Grouping (not file structure — this phase touches existing files only)
```
Wave A (foundation, blocking):
  packages/shared/src/units.ts      — add oz/lb-food, tsp/tbsp conversion helpers
  packages/db/src/schema.ts          — add liftsUnits/bodyweightUnits/runUnits columns
  packages/db/drizzle/0005_*.sql     — migration + round-trip test (mirrors 0004 precedent)

Wave B (units split UI, depends on A):
  settingsStore.ts, onboarding/units.tsx, settings/index.tsx, useProfile.ts
  + ~10 consumer re-key sites (CONTEXT.md canonical_refs list)

Wave C (food units UI, depends on A):
  FoodConfirmSheet.tsx (chip row + qty parsing)
  nutrition/log.tsx (custom food + quick-add quantity surfaces)
  nutrition/recipe-edit.tsx (ingredient qty — NOT recipes.tsx, see Pitfall 5)

Wave D (keyboard fixes, independent of A/B/C):
  new shared DoneAccessoryBar component
  FoodConfirmSheet.tsx keyboard-safe layout (D-12)
  6 decimal-pad call sites app-wide (D-13)
  log/session.tsx keyboard-safety (D-14)

Wave E (lifting logger fixes, independent):
  sessionStore.ts: removeExercise() + startRestTimer() cancel-before-reschedule fix (D-21)
  ExerciseCard.tsx: overflow "···" affordance (D-20)

Wave F (onboarding explainer, depends on nothing but can land last):
  new onboarding/explainer.tsx (or similar) + Settings "How Apsis works" row
  reuses HssRing / ReadinessLight / TrendChart with sample data
```

### Pattern 1: Migration + call-site re-key (units split, D-01–D-04)
**What:** Add three new nullable enum columns to `user_profile`, backfill them from the
existing `units` column in the same migration, then re-key every consumer from the single
`units` value to the correct bucket.
**When to use:** Any time a single preference is being split into N independently-toggleable
preferences without losing existing user data.
**Example (schema addition — mirrors the existing `units` column exactly):**
```typescript
// packages/db/src/schema.ts — extend the existing userProfile table (schema.ts:28-53)
// Existing column stays for backward-compat / single source for the migration backfill:
units: text('units', { enum: ['metric', 'imperial'] }).default('metric'),
// NEW (D-01): three independent buckets, nullable until migration backfill runs
liftsUnits: text('lifts_units', { enum: ['metric', 'imperial'] }),
bodyweightUnits: text('bodyweight_units', { enum: ['metric', 'imperial'] }),
runUnits: text('run_units', { enum: ['metric', 'imperial'] }),
```
```sql
-- packages/db/drizzle/0005_*.sql — mirrors 0004's ALTER TABLE shape exactly
-- (0004 precedent, verbatim from packages/db/drizzle/0004_youthful_valkyrie.sql:65-67):
--   ALTER TABLE `user_profile` ADD `height_cm` real;--> statement-breakpoint
--   ALTER TABLE `user_profile` ADD `birth_year` integer;--> statement-breakpoint
--   ALTER TABLE `user_profile` ADD `goal_mode` text;
ALTER TABLE `user_profile` ADD `lifts_units` text;--> statement-breakpoint
ALTER TABLE `user_profile` ADD `bodyweight_units` text;--> statement-breakpoint
ALTER TABLE `user_profile` ADD `run_units` text;--> statement-breakpoint
-- D-04 silent backfill: seed from the existing single `units` value for every existing row
UPDATE `user_profile` SET `lifts_units` = `units`, `bodyweight_units` = `units`, `run_units` = `units`;
```
**Migration index:** the next migration MUST be tagged idx 5 in `packages/db/drizzle/meta/_journal.json` (current highest idx is 4, tag `0004_youthful_valkyrie`) [VERIFIED: packages/db/drizzle/meta/_journal.json:2-27, "idx": 4 is the last entry].

### Pattern 2: Round-trip migration proof (reuse, don't reinvent)
**What:** Apply every committed `.sql` file in journal order to an in-memory `better-sqlite3`
database, exactly mirroring what `useMigrations()` does on-device, then assert the new columns
exist and the backfill produced the expected values.
**When to use:** Every schema-changing migration in this codebase (established Phase 07
precedent — typecheck cannot prove a migration file is syntactically valid SQL).
**Example (the exact harness to extend, read directly this session):**
```typescript
// Source: packages/db/src/__tests__/nutrition-schema.test.ts:21-48 (verbatim this session)
import { readFileSync } from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { eq } from 'drizzle-orm';
import * as schema from '../schema';
// ...
/** Apply every committed migration .sql file in journal order — mirrors useMigrations(). */
function applyCommittedMigrations(sqlite: Database.Database): string[] {
  const journal = JSON.parse(
    readFileSync(path.join(DRIZZLE_DIR, 'meta/_journal.json'), 'utf-8')
  );
  const tags = [...journal.entries].sort((a, b) => a.idx - b.idx).map((e) => e.tag);
  for (const tag of tags) {
    const migrationSql = readFileSync(path.join(DRIZZLE_DIR, `${tag}.sql`), 'utf-8');
    for (const statement of migrationSql.split('--> statement-breakpoint')) {
      const trimmed = statement.trim();
      if (trimmed.length > 0) sqlite.exec(trimmed);
      // ... (continues; harness applies every statement in order)
    }
  }
  return tags;
}
```
The units-split migration test should live in a new `packages/db/src/__tests__/units-migration.test.ts` (or extend an existing schema test file) reusing `applyCommittedMigrations` verbatim, then assert: (1) the three new columns exist, (2) an inserted row with only the legacy `units` value backfills correctly after the `UPDATE` statement runs, (3) a row inserted directly with all three new values round-trips exactly.

### Pattern 3: Exact-round-trip unit conversion (extend, don't duplicate)
**What:** Every new oz/lb-food, tsp/tbsp conversion function must follow the exact discipline
already established for kg/lb and km/mi: storage stays metric (grams), conversions are
display-only, and whole-number round-trips are exact.
**When to use:** Any new display-unit conversion added to `packages/shared/src/units.ts`.
**Example (existing pattern to extend, verbatim this session):**
```typescript
// Source: packages/shared/src/units.ts:8-28 (verbatim — the pattern to replicate for oz/lb-food)
export const LB_PER_KG = 2.2046226218;
export function lbToKgExact(lb: number): number {
  return lb / LB_PER_KG;
}
export function kgToDisplayLb(kg: number): number {
  return Math.round(kg * LB_PER_KG);
}
```
New functions needed (Claude's discretion on exact rounding per D-CONTEXT "Display precision"):
`gramsToDisplayOz(g)`, `ozToGramsExact(oz)`, `gramsToDisplayLb(g)` (food-quantity lb, distinct
from `kgToDisplayLb` which operates on kg not g), `lbToGramsExact(lb)`. For tsp/tbsp/serving
(D-06/D-07), the conversion is NOT a fixed constant — it is `qty * (food.servingGrams / servingQtyImplied)`, gated entirely on the specific food's `servingGrams` being present (no fabricated density table, per D-06's explicit "macro honesty over convenience" constraint). This conversion function likely belongs in `logFood.ts` or a new `foodUnits.ts`, not `units.ts`, since it needs a `food`-shaped input rather than being a pure constant-factor conversion — recommend keeping `units.ts` scoped to fixed-factor conversions (g↔oz↔lb↔kg) and adding a separate `foodUnitOptions.ts`-style helper for the conditional tsp/tbsp/serving chip logic.

### Pattern 4: Input-accessory Done bar (D-11, D-13)
**What:** A shared component wrapping RN core's `InputAccessoryView` (iOS-only — Android's
decimal-pad already has no keyboard-blocking problem in the same way, per D-11's iOS-specific
framing) with a right-aligned "Done" button that dismisses the keyboard.
**When to use:** Every `decimal-pad`/`number-pad` `TextInput` app-wide (D-13's six call sites:
food sheet, quick-add, custom food, run form, onboarding bodyweight, lifting set fields).
**Example (RN core API — no new dependency):**
```tsx
import { InputAccessoryView, Keyboard, Platform, Pressable, Text } from 'react-native';

const INPUT_ACCESSORY_ID = 'apsis-decimal-done-bar';

export function DecimalPadDoneBar(): React.JSX.Element | null {
  if (Platform.OS !== 'ios') return null; // Android decimal-pad has a system dismiss affordance already
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
// Each TextInput opts in via: <TextInput inputAccessoryViewID={INPUT_ACCESSORY_ID} ... />
```
Note: `BottomSheetTextInput` (used inside `FoodConfirmSheet`, `@gorhom/bottom-sheet`) may not
forward `inputAccessoryViewID` the same way a plain RN `TextInput` does — verify this specific
interaction on-device early (flagged as an Open Question below), since `FoodConfirmSheet` is
the one screen where the Done bar AND the D-12 stay-visible requirement compound.

### Anti-Patterns to Avoid
- **Duplicating the round-trip migration test harness:** a second copy of `applyCommittedMigrations` in a new test file drifts from the Phase 07 original the moment either changes. Import/reuse the existing helper (or move it to a shared test-utils module) rather than pasting it.
- **Hand-rolling density-based tsp/tbsp conversion:** D-06 explicitly forbids a water-standard approximation (1 tsp ≈ 4.93g water) — every OFF/USDA food's actual `servingGrams` is the only legitimate source, and the unit must be hidden entirely when that data is absent.
- **Re-deriving `Units` fan-out per-screen:** `settingsStore.ts` exists precisely so screens don't re-query `user_profile` for a display-only signal — the three-way split should extend this store's shape, not bypass it with ad-hoc local state.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Keyboard-dismiss/Done affordance | A custom `Animated`-driven bar synced to keyboard height via `Keyboard.addListener` | RN core `InputAccessoryView` (iOS) | It IS the platform primitive for exactly this; a hand-rolled version reimplements iOS's own keyboard-attached-view behavior worse |
| Migration round-trip verification | A new in-memory SQLite harness | The existing `applyCommittedMigrations` helper in `nutrition-schema.test.ts` | Already proven correct against this exact journal format in Phase 07; duplicating it is pure risk for zero benefit |
| oz/lb/tsp/tbsp density conversion | A generic "cooking unit converter" library | Per-food `servingGrams`-gated arithmetic (already the schema's `food.servingGrams`/`servingName` fields) | A generic converter fabricates densities (1 tbsp flour ≠ 1 tbsp honey); D-06 already rejected this — the data model already supports the correct approach |

**Key insight:** every "don't hand-roll" risk in this phase is really "don't build a second version of something Phase 03/04/07 already built correctly." The dominant execution risk is drift between a new ad-hoc mechanism and an existing established one, not missing library research.

## Common Pitfalls

### Pitfall 1: The rest-timer notification bug's exact root cause is a one-line omission — don't over-fix it
**What goes wrong:** `startRestTimer` (sessionStore.ts:302-304) does `set({ restTimerEndsAt: endsAt, restNotificationId: null })` — it discards the OLD `restNotificationId` without cancelling it, then schedules a brand-new notification. Every earlier uncancelled notification stays scheduled and fires independently.
**Why it happens:** `addThirtySeconds` (line 316-325) and `skipRest` (line 328-332) both correctly call `cancelRestNotification(restNotificationId, ...)` BEFORE nulling the id — `startRestTimer` is the only one of the three call sites missing this line.
**How to avoid:** Capture the outgoing `restNotificationId` from `get()` before the `set({...})` call and `void cancelRestNotification(previousId, 'startRestTimer supersedes prior rest')` — mirror lines 320-321's exact pattern. This is a 1-2 line diff, not a redesign.
**Warning signs:** any fix that touches `resolveRestDuration`, `startRest`, or `scheduleRestNotification` is scope creep — the bug is entirely inside the four lines at sessionStore.ts:302-306.
**Exact code read this session (sessionStore.ts:286-314):**
```typescript
startRestTimer: async (exerciseId) => {
    const card = get().exercises.find((c) => c.exerciseId === exerciseId);
    let profileDefaultSec = FALLBACK_REST_DEFAULT_SEC;
    try {
      const rows = await db.select({ restTimerDefaultSec: userProfile.restTimerDefaultSec })
        .from(userProfile).limit(1);
      profileDefaultSec = rows[0]?.restTimerDefaultSec ?? FALLBACK_REST_DEFAULT_SEC;
    } catch (err: unknown) {
      console.error('[Apsis] startRestTimer profile query failed:', err);
    }
    const durationSec = resolveRestDuration(card?.restTimerSec ?? null, profileDefaultSec);
    const endsAt = startRest(durationSec);
    set({ restTimerEndsAt: endsAt, restNotificationId: null });  // <-- BUG: old id discarded, never cancelled
    const notificationId = await scheduleRestNotification(endsAt);
    if (get().restTimerEndsAt === endsAt) {
      set({ restNotificationId: notificationId });
    } else {
      void cancelRestNotification(notificationId, 'startRestTimer stale-schedule race guard');
    }
  },
```

### Pitfall 2: `recipes.tsx` is NOT the recipe-ingredient-quantity file — `recipe-edit.tsx` is
**What goes wrong:** 09-CONTEXT.md's canonical_refs lists `apps/mobile/app/(tabs)/nutrition/recipes.tsx` as a food-quantity-units surface (item D-10's scope). Reading it this session shows `recipes.tsx` only lists saved recipes and logs one serving via `FoodConfirmSheet` reuse (a `recipeToConfirmableFood` helper) — it has no ingredient quantity TextInput at all.
**Why it happens:** The actual per-ingredient `qtyGrams` TextInput with `keyboardType="decimal-pad"` lives in `apps/mobile/app/(tabs)/nutrition/recipe-edit.tsx` (confirmed via grep this session: `qtyText`, `qtyGrams`, `decimal-pad` all appear there, none in `recipes.tsx`).
**How to avoid:** Plan D-10's "recipe ingredients" chip-row surface against `recipe-edit.tsx`, not `recipes.tsx`. `recipes.tsx` only needs the FoodConfirmSheet's existing chip row (inherited for free once FoodConfirmSheet gets chips) since it reuses that sheet for logging.
**Warning signs:** any task that tries to add a chip row inside `recipes.tsx` will find no quantity input to attach it to.

### Pitfall 3: `BottomSheetTextInput` may not support `inputAccessoryViewID` the same way plain `TextInput` does
**What goes wrong:** `FoodConfirmSheet`'s quantity field is a `BottomSheetTextInput` (from `@gorhom/bottom-sheet`), not a plain RN `TextInput`. `InputAccessoryView`'s `nativeID`-matching mechanism relies on the underlying native `TextInput`'s `inputAccessoryViewID` prop being forwarded correctly through `@gorhom/bottom-sheet`'s wrapper.
**Why it happens:** `@gorhom/bottom-sheet` wraps its own keyboard-handling logic (`keyboardBehavior`, `keyboardBlurBehavior`) specifically because bottom sheets and the standard keyboard-avoidance stack interact unusually — the library may already consume or conflict with `InputAccessoryView`.
**How to avoid:** Verify `inputAccessoryViewID` on `BottomSheetTextInput` on-device early (Wave D), before building all six call sites assuming uniform behavior. If it doesn't forward correctly, D-13's shared component may need a `BottomSheetTextInput`-specific variant or the sheet's own `keyboardBehavior="extend"` config might already satisfy D-11/D-12 without needing an accessory bar inside the sheet specifically.
**Warning signs:** the Done bar renders on plain-TextInput screens (nutrition/log.tsx, settings/index.tsx, onboarding/bodyweight.tsx) but not inside FoodConfirmSheet.

### Pitfall 4: `useFocusEffect` vs `useEffect` — don't reintroduce the Phase 03 P10 stacked-screen bug
**What goes wrong:** `log/session.tsx` already had a documented bug (Phase 03 P10, referenced in STATE.md and in the file's own doc comment) where a plain `useEffect` on a store-writing screen fired on unfocused stacked screens too, causing an A↔B rehydration oscillation that wiped `restTimerEndsAt`/`restNotificationId`.
**Why it happens:** expo-router keeps prior stack screens mounted; any effect without a focus gate runs for every mounted instance, not just the visible one.
**How to avoid:** Any new effect added to `log/session.tsx` for D-14's keyboard-safety work (e.g., tracking focused-field position for scroll-into-view) MUST use `useFocusEffect`, matching the existing pattern at session.tsx:62-90, never a plain `useEffect` for anything that touches session store state.
**Warning signs:** rest-timer banner flickering or disappearing after adding the keyboard-safety code — that is this exact bug recurring.

### Pitfall 5: Deleting a committed exercise must clean up SQLite, not just in-memory state (mirrors `uncommitSet`)
**What goes wrong:** `sessionStore.ts` currently has `removeSet` (line 244-252), which is in-memory-only for uncommitted sets — but for COMMITTED sets, `ExerciseCard.tsx`'s `handleDelete` (line 59-73) explicitly calls `uncommitSet(db, workoutId, set.id, profileBodyweightKg)` FIRST (which deletes the `strength_set` row AND recomputes `workout.hss`), and only calls the in-memory `removeSet` after that DB call succeeds. A new `removeExercise` that only touches in-memory state (mirroring the wrong half of the existing pattern) would leave orphaned `strength_set` rows and a stale `workout.hss`.
**Why it happens:** D-20 explicitly calls out "must also remove those committed sets from the DB" — this is already flagged in CONTEXT.md, but the exact mechanism (delete-then-recompute, error-path keeps the in-memory row) needs to mirror `ExerciseCard.tsx:59-73` and `commitSet.ts:161-174`'s `uncommitSet`, not reinvent it.
**How to avoid:** `removeExercise` should loop the exercise's committed set ids through the same `uncommitSet`-style delete (or a new `uncommitSet`-like bulk variant scoped by `exerciseId` — `strengthSet.workoutId` + `strengthSet.exerciseId` filter, then a single `recomputeSessionHss` call, not N individual recomputes) and only remove the exercise from `sessionStore.exercises` after the DB operation succeeds — matching the "don't remove the row from the in-memory list if the DB delete failed" comment already in `ExerciseCard.tsx:65-70`.
**Warning signs:** a swipe-then-undo-then-swipe-again pattern in the DB test suite that leaves `strength_set` rows with no matching in-memory exercise.

### Pitfall 6: `useProfile.ts`'s `ProfileUpdateInput`/`ProfileValues` need the three new fields — a partial update will silently no-op them
**What goes wrong:** `ProfileUpdateInput` (useProfile.ts:41-57) and `ProfileValues` (useProfile.ts:31-39) are hand-typed interfaces that must be extended with `liftsUnits`/`bodyweightUnits`/`runUnits` — if a task only updates `schema.ts` and forgets this hook, `update({ liftsUnits: 'imperial' })` will fail TypeScript compilation (good — a fail-fast signal) but a task that widens `ProfileUpdateInput` with `Partial<typeof userProfile.$inferInsert>` instead of explicit fields could silently accept a typo'd column name that drizzle passes through at runtime.
**How to avoid:** Extend `ProfileUpdateInput`/`ProfileValues` explicitly (matching the existing `heightCm`/`birthYear`/`goalMode` precedent added for NUTR-15, useProfile.ts:52-56) — three new named optional fields, not a generic passthrough.

## Runtime State Inventory

> This phase is a schema migration (units split) plus a settings-store shape change — not a
> rename/rebrand, but the units-split migration and the settings-store fan-out both touch
> persisted/cached state, so this inventory is included for completeness.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | `user_profile.units` single column — every existing TestFlight beta tester's row has this value set (metric or imperial) from onboarding | Migration 0005 backfills `lifts_units`/`bodyweight_units`/`run_units` from the existing `units` value in the SAME migration transaction (D-04) — this is a data migration, not just a schema migration |
| Live service config | None — no external services reference `units` | None |
| OS-registered state | Scheduled `expo-notifications` rest-timer notifications (D-21's bug) may have stale entries already scheduled on beta testers' devices from build 9 | Not fixable retroactively (no way to enumerate/cancel arbitrary already-scheduled notifications from a future app version reliably across app restarts) — the fix only prevents NEW leaks; existing stale notifications on testers' devices will fire once and are harmless (no state corruption, just an extra buzz) |
| Secrets/env vars | None — no secret/env var references `units` or any Phase 9 item | None |
| Build artifacts | None — no package rename, no installed-package name change | None — build 10 is a normal EAS production build cycle, same as build 9 |

**Nothing found in category "Live service config", "Secrets/env vars", "Build artifacts":**
confirmed by reading `schema.ts`, `settingsStore.ts`, and grepping for `units` references across
`apps/mobile` — no n8n/Datadog/Tailscale/SOPS-style external references exist in this codebase
for this phase's scope.

## Code Examples

### D-01/D-04: Backfill migration pattern (verified against 0004 precedent)
```sql
-- Source: packages/db/drizzle/0004_youthful_valkyrie.sql:65-67 (verbatim, the shape to mirror)
ALTER TABLE `user_profile` ADD `height_cm` real;--> statement-breakpoint
ALTER TABLE `user_profile` ADD `birth_year` integer;--> statement-breakpoint
ALTER TABLE `user_profile` ADD `goal_mode` text;
```

### D-21: Correct cancel-then-reschedule pattern (verified, the exact pattern to mirror in the fix)
```typescript
// Source: apps/mobile/stores/sessionStore.ts:316-326 (verbatim — addThirtySeconds already does this correctly)
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
The fix for `startRestTimer` should capture `get().restNotificationId` before the `set({...})`
call at line 304 and call `void cancelRestNotification(previousId, 'startRestTimer supersedes prior rest')`
in the same position `addThirtySeconds` does at line 321.

### D-20: DB-cleanup-before-in-memory-removal pattern (verified, the pattern removeExercise must mirror)
```typescript
// Source: apps/mobile/components/session/ExerciseCard.tsx:59-73 (verbatim)
async function handleDelete(set: SetDraft): Promise<void> {
    if (set.committed && workoutId) {
      try {
        const result = await uncommitSet(db, workoutId, set.id, profileBodyweightKg);
        setLiveHss(result.hss, result.warnings);
      } catch (err: unknown) {
        console.error('[Apsis] uncommitSet (swipe-delete) failed:', err);
        return;
      }
    }
    removeSet(exercise.exerciseId, set.id);
  }
```

### D-18: Existing components the explainer cards reuse verbatim (props confirmed this session)
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
export interface ReadinessLightProps {
  band: ReadinessBand;
}

// Source: apps/mobile/components/home/TrendChart.tsx:46-69
export interface TrendChartPoint {
  day: number; hss: number; atl: number; ctl: number; tsb: number; dateLabel: string;
  [key: string]: number | string;
}
export interface TrendChartProps {
  data: TrendChartPoint[];
  calibratingDayN?: number;
}
```
The explainer's "real components with representative sample data" (D-18) can construct a
hardcoded `TrendChartPoint[]` array and pass `animate={false}` to `HssRing` — no new prop
needed on any of the three components for this phase.

## State of the Art

Not applicable in the conventional sense (no external ecosystem shift to track) — the
"state of the art" for this phase is entirely intra-repo: every mechanism has a most-recent,
already-correct precedent (Phase 07's migration harness, Phase 03 P10's focus-effect fix,
`addThirtySeconds`'s cancel pattern) that supersedes any earlier or partial version of the
same mechanism elsewhere in the codebase.

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|---------------|--------|
| Single `units` enum on `user_profile` | Three independent unit buckets (lifts/bodyweight/runs) | This phase (D-01) | ~10 call sites must re-key; `units` column itself is kept (not dropped) for the D-04 backfill source and as a safe rollback anchor |
| Plain `useEffect` for store-writing screen effects | `useFocusEffect` | Phase 03 P10 (already fixed) | Any NEW effect on `log/session.tsx` for this phase must follow the already-fixed pattern, not the pre-fix one |

**Deprecated/outdated:** None being removed this phase — `user_profile.units` stays as a
legacy/rollback anchor per the migration shape decision left to Claude's discretion in
CONTEXT.md, provided the D-04 seed-from-old-value behavior holds.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `InputAccessoryView` (RN core) correctly renders above a `@gorhom/bottom-sheet`'s `BottomSheetTextInput` without conflicting with the sheet's own `keyboardBehavior`/`keyboardBlurBehavior` config | Architecture Patterns Pattern 4, Pitfall 3 | If wrong, D-13's "one shared component, rolled out everywhere" claim breaks for the FoodConfirmSheet call site specifically — needs a sheet-specific fallback (e.g., relying on `keyboardBehavior="extend"` alone without an accessory bar inside the sheet) |
| A2 | Android's decimal-pad has no equivalent keyboard-blocking problem, so the Done bar can be iOS-only (`Platform.OS !== 'ios' → return null`) | Architecture Patterns Pattern 4 | If Android testers report the same quantity-hidden-by-keyboard issue, the Done bar (or at minimum the D-12 stay-visible layout fix) needs an Android branch too — 09-CONTEXT.md's D-11 phrasing ("iOS input-accessory bar") suggests this was already scoped iOS-only by the owner, but this session did not independently confirm Android's keyboard behavior on this specific screen |
| A3 | `recipe-edit.tsx` (not `recipes.tsx`) is the correct file for D-10's recipe-ingredient chip row | Common Pitfalls Pitfall 2 | Low risk — confirmed via direct grep this session (`qtyText`/`qtyGrams`/`decimal-pad` all present in recipe-edit.tsx, absent in recipes.tsx); flagged as a correction to CONTEXT.md's canonical_refs, not a genuine unknown |
| A4 | drizzle-kit's auto-generated migration tag for 0005 will not collide with the existing `0004_youthful_valkyrie` naming scheme | Architecture Patterns Pattern 1 | Negligible — drizzle-kit generates a random two-word tag per migration; if the planner hand-writes the SQL instead of running `drizzle-kit generate`, the journal entry must still be added manually with `idx: 5` |

**If this table is empty:** N/A — see table above; all four assumptions are LOW-risk and none blocks planning (each has a clear resolution path or fallback already noted).

## Open Questions

1. **Does `BottomSheetTextInput` forward `inputAccessoryViewID` to the underlying native `TextInput`?**
   - What we know: `@gorhom/bottom-sheet` v5.2.14 is installed; `FoodConfirmSheet` already configures `keyboardBehavior="extend"` and `keyboardBlurBehavior="none"` specifically to manage keyboard interaction inside the sheet.
   - What's unclear: whether adding `inputAccessoryViewID` to the sheet's `BottomSheetTextInput` for D-11's Done bar works identically to a plain screen's `TextInput`, or whether the sheet's own keyboard management supersedes/conflicts with it.
   - Recommendation: verify on-device early in Wave D (build the Done bar component + wire it into ONE plain-screen call site AND FoodConfirmSheet in the same task, on-device checkpoint before rolling out to the remaining 4 call sites).

2. **Exact rounding/display format for oz and lb food quantities (D-08's "Claude's Discretion" precision note)**
   - What we know: `kgToDisplayLbFractional` (0.1 lb precision) already exists as the load-entry precedent for lifting; food quantities may want a different precision (e.g., whole oz, or 1 decimal for lb).
   - What's unclear: the owner left this to Claude's discretion in CONTEXT.md, but no specific number was proposed this session.
   - Recommendation: match `kgToDisplayLbFractional`'s 0.1 precision for lb, and use whole-number oz (matching macro-tracking apps' typical granularity) — MyFitnessPal-class precedent is 1oz granularity — but this is a plan-time decision, not a research gap; flag for discuss-phase confirmation if the owner has a preference.

3. **Where does the "last-used unit per food" persist (D-09)?**
   - What we know: CONTEXT.md explicitly leaves this to Claude's discretion — "a column on `food` vs a small key-value store" — must survive app restarts.
   - What's unclear: `food` rows are shared/reusable across log entries (not per-user-session), so a column on `food` (e.g., `lastUsedUnit`) is defensible, but a separate lightweight table (or even AsyncStorage keyed by `foodId`) also works and avoids a schema migration for a low-stakes UX nicety.
   - Recommendation: a column on `food` (`last_used_unit text`) is simplest — it's already the table drizzle migrations touch this phase (schema.ts is already being edited for the units split), and it makes the value queryable in the same read as the food row itself (no second query/store needed at FoodConfirmSheet open time). Flag as a plan-time call, not a blocking unknown.

## Environment Availability

Skipped — this phase has no new external tool/service/runtime dependency. All work happens
inside the existing Expo/React Native/SQLite stack already running in this repo, and the
existing EAS build pipeline (used for build 9) is reused unchanged for build 10.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest 4.x (confirmed via existing `packages/db/src/__tests__/*.test.ts` and `apps/mobile` lib tests) [VERIFIED: packages/db/src/__tests__/nutrition-schema.test.ts read this session] |
| Config file | per-package `vitest.config.ts` (existing, unchanged) |
| Quick run command | `pnpm --filter @apsis/db test` / `pnpm --filter @apsis/shared test` / `pnpm --filter apps/mobile test` (per-package, matches STATE.md's "pnpm -r test... 259 tests: 21 shared + 95 engine + 63 db + 80 mobile" precedent) |
| Full suite command | `pnpm -r test` (root, matches Phase 06 P06 precedent in STATE.md) |

### Phase Requirements → Test Map

> This phase has no REQ-IDs in REQUIREMENTS.md (beta-feedback items, not v1.0 scope items —
> confirmed: REQUIREMENTS.md's traceability table has no Phase 09 row). The table below maps
> each CONTEXT.md decision (D-01..D-21) to its verification instead.

| Item | Behavior | Test Type | Automated Command | File Exists? |
|------|----------|-----------|--------------------|--------------|
| D-01/D-04 | Migration 0005 backfills 3 new columns from legacy `units` | unit (migration round-trip) | `pnpm --filter @apsis/db test units-migration` | ❌ Wave 0 — new test file, extends existing `nutrition-schema.test.ts` harness |
| D-01..D-03 | Existing `Units`-consuming pure functions (`packages/shared/src/units.ts`) still pass after adding oz/lb-food/tsp/tbsp helpers | unit | `pnpm --filter @apsis/shared test` | ✅ existing `units.ts` test file (extend, don't replace) |
| D-05..D-10 | `buildFoodLogRow`-adjacent quantity parsing (grams from oz/lb/tsp/tbsp/serving input) | unit | `pnpm --filter apps/mobile test logFood` (or a new `foodUnits.test.ts`) | ❌ Wave 0 — no existing test for the new conversion path |
| D-21 | `startRestTimer` cancels the prior notification before scheduling a new one | unit | `pnpm --filter apps/mobile test sessionStore` | ❌ Wave 0 — no existing `sessionStore.test.ts`; this is exactly the kind of pure-store-logic behavior vitest can cover by mocking `lib/notifications.ts`'s exports |
| D-20 | `removeExercise` deletes committed `strength_set` rows and recomputes HSS before removing in-memory state | unit + manual UAT | `pnpm --filter apps/mobile test sessionStore` (store logic) + on-device swipe/delete UAT | ❌ Wave 0 for the store-logic unit test |
| D-11..D-14 | Keyboard-safety (Done bar, stay-visible layout, session-screen scroll) | manual-only (on-device) | n/a — UI/keyboard interaction is not meaningfully unit-testable in this stack (matches the existing STATE.md-documented gap: "apps/mobile has no component test harness... expo-router focus/stack regressions... only catchable on-device") | n/a |
| D-15..D-19 | Onboarding explainer cards render/skip/revisit correctly | manual-only (on-device) | n/a — matches the existing UI-testing gap above | n/a |

### Sampling Rate
- **Per task commit:** the package-scoped quick command for whichever package the task touched (`@apsis/db`, `@apsis/shared`, or `apps/mobile`)
- **Per wave merge:** `pnpm -r test` (full suite) + `pnpm typecheck` (root, per the established Phase 03 P04/05 cross-package verification precedent)
- **Phase gate:** full suite green + an on-device UAT pass covering every keyboard/onboarding item (D-11..D-19), before build 10's EAS production build kicks off (re-running 06-06 Task 3's beta gate)

### Wave 0 Gaps
- [ ] `packages/db/src/__tests__/units-migration.test.ts` — covers D-01/D-04 (migration + backfill round-trip), reusing `applyCommittedMigrations` from `nutrition-schema.test.ts`
- [ ] `apps/mobile/lib/__tests__/sessionStore.test.ts` (or similar) — covers D-21 (notification cancel-before-reschedule) and D-20 (removeExercise DB cleanup), mocking `lib/notifications.ts`
- [ ] `apps/mobile/lib/__tests__/foodUnits.test.ts` (or extend `logFood.test.ts` if it exists) — covers D-05..D-09's grams↔oz/lb/tsp/tbsp/serving conversion math, especially the D-06 "no tsp/tbsp without a real servingGrams basis" gating rule
- [ ] Framework install: none — vitest is already configured in all three packages

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|----------------|---------|-------------------|
| V2 Authentication | No | Single-local-user offline app, no auth (established project-wide, schema.ts:16-18 confirms no per-user owner column anywhere) |
| V3 Session Management | No | No server sessions |
| V4 Access Control | No | No multi-user access boundaries |
| V5 Input Validation | Yes | `parseGramsInput`/`clampNonNegative` pattern (`logFood.ts:44-47`, `FoodConfirmSheet.tsx:80-83`) — every new oz/lb/tsp/tbsp text input MUST clamp to finite, non-negative values before conversion, exactly like the existing grams parser. A negative or NaN quantity in any unit must never reach `buildFoodLogRow`. |
| V6 Cryptography | No | No crypto surface touched this phase |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|----------------------|
| Malformed decimal-pad text input (e.g., "1.2.3", empty string, pasted non-numeric) producing NaN through a new oz/lb/tsp/tbsp conversion path | Tampering (data-integrity) | Extend the existing `parseGramsInput`/`clampNonNegative` discipline (regex-strip non-numeric chars on `onChangeText`, `Number.isFinite` + `>= 0` guard before any arithmetic) to every new unit's parser — this is already T-07-12's mitigation, reused not reinvented |
| A migration that silently drops data if applied out of order or partially | Tampering / Repudiation (data-integrity) | The round-trip proof test (Pattern 2) already catches this class of bug — every migration in this codebase has been gated behind it since Phase 07 |
| Sentry/crash reporting capturing a raw macro/quantity value from a new conversion path | Information Disclosure | `FoodConfirmSheet.tsx`'s existing doc comment (lines 20-22) already states "no kcal/macro value is ever attached to a Sentry breadcrumb" — new quantity-unit code must maintain this (NUTR-22 precedent); no new Sentry call sites should be added in this phase at all |

## Sources

### Primary (HIGH confidence — all read directly this session, in-repo)
- `packages/db/src/schema.ts` — user_profile/food/food_log/recipe/recipe_ingredient table definitions
- `packages/shared/src/units.ts` — existing kg/lb/km/mi conversion helpers and round-trip discipline
- `apps/mobile/stores/sessionStore.ts` — rest-timer notification logic, removeSet, the D-21 bug's exact location
- `apps/mobile/lib/notifications.ts` — expo-notifications wrapper (schedule/cancel)
- `apps/mobile/lib/commitSet.ts` — commitSet/uncommitSet persist-then-recompute pattern
- `apps/mobile/lib/logFood.ts` — buildFoodLogRow, clampNonNegative input-validation pattern
- `apps/mobile/components/FoodConfirmSheet.tsx` — existing quantity input, bottom-sheet keyboard config
- `apps/mobile/components/session/ExerciseCard.tsx` — swipe-to-delete + uncommitSet call pattern
- `apps/mobile/app/(tabs)/log/session.tsx` — plain ScrollView, useFocusEffect precedent (Phase 03 P10 fix)
- `apps/mobile/app/onboarding/units.tsx`, `apps/mobile/app/onboarding/_layout.tsx` — onboarding wizard structure
- `apps/mobile/app/(tabs)/settings/index.tsx` — units toggle, ProfileReview integration, HealthKit toggle pattern
- `apps/mobile/hooks/useProfile.ts` — ProfileValues/ProfileUpdateInput shape, settingsStore hydration
- `apps/mobile/lib/settingsStore.ts` — zustand units mirror
- `apps/mobile/app/(tabs)/nutrition/log.tsx` — custom food + quick-add screens, decimal-pad TextInput usage
- `apps/mobile/app/(tabs)/nutrition/recipe-edit.tsx` (NOT recipes.tsx — see Pitfall 2) — ingredient qtyGrams TextInput
- `apps/mobile/components/home/HssRing.tsx`, `ReadinessLight.tsx`, `TrendChart.tsx` — component prop shapes for D-18
- `packages/db/drizzle/0004_youthful_valkyrie.sql`, `packages/db/drizzle/meta/_journal.json` — migration file/journal shape precedent
- `packages/db/src/__tests__/nutrition-schema.test.ts` — the round-trip migration proof harness to reuse
- `apps/mobile/package.json`, `packages/db/package.json` — installed dependency versions (no new install needed)
- `.planning/phases/09-beta-feedback-round-1/09-CONTEXT.md` — the user decision set this research supports
- `.planning/STATE.md` — Phase 03 P10 rehydrate-loop lesson, prior migration/build precedents

### Secondary (MEDIUM confidence)
- None — no external documentation was needed for this phase; every mechanism resolved to an in-repo precedent.

### Tertiary (LOW confidence)
- None.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — zero new packages, every version read directly from installed `package.json` files
- Architecture: HIGH — every pattern is copied from code read directly this session, not inferred
- Pitfalls: HIGH — five of six pitfalls are exact bugs/gotchas already documented in this codebase's own comments/STATE.md history; the sixth (BottomSheetTextInput accessory-view forwarding) is flagged as an open question, not asserted as fact

**Research date:** 2026-08-04
**Valid until:** No expiry driver — this research is scoped entirely to the current state of this repo's own files, not an external ecosystem that moves independently. Re-verify only if the phase scope changes or if a plan discovers one of the referenced files has since been edited by other work.
