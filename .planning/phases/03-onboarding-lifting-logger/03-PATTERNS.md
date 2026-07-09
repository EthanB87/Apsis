# Phase 3: Onboarding & Lifting Logger - Pattern Map

**Mapped:** 2026-07-09
**Files analyzed:** 24
**Analogs found:** 20 / 24

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `packages/engine/src/bodyweight.ts` (D-18) | service (pure fn) | transform | `packages/engine/src/strength.ts` | exact |
| `packages/engine/src/carry.ts` (D-20) | service (pure fn) | transform | `packages/engine/src/endurance.ts` | exact |
| `packages/engine/src/config.ts` (extend: `kCarry` etc.) | config | transform | `packages/engine/src/config.ts` (self, edit) | exact |
| `packages/engine/src/index.ts` (extend barrel) | config | transform | `packages/engine/src/index.ts` (self, edit) | exact |
| `packages/shared/src/index.ts` (extend types: CarrySet, BW fields) | model | transform | `packages/shared/src/index.ts` (self, edit) | exact |
| `packages/db/src/schema.ts` (extend: `exercise.bwFactor/entryMode`, `workout.finishedAt/deletedAt`) | model/migration | CRUD | `packages/db/src/schema.ts` (self, edit) | exact |
| `packages/db/src/seed.ts` (extend `STARTER_EXERCISES` with factors/modes) | model | batch | `packages/db/src/seed.ts` (self, edit) | exact |
| `packages/db/migrations/000X_*.sql` (generated) | migration | batch | `packages/db/drizzle/0000_*.sql` (existing, generated) | exact |
| `apps/mobile/app/_layout.tsx` (add profile-exists gate) | provider/route | request-response | `apps/mobile/app/_layout.tsx` (self, edit) | exact |
| `apps/mobile/app/onboarding/_layout.tsx` | route | request-response | `apps/mobile/app/(tabs)/_layout.tsx` | role-match |
| `apps/mobile/app/onboarding/sex.tsx` | component/route | request-response | `apps/mobile/app/(tabs)/index.tsx` | role-match |
| `apps/mobile/app/onboarding/bodyweight.tsx` | component/route | request-response | `apps/mobile/app/(tabs)/index.tsx` | role-match |
| `apps/mobile/app/onboarding/threshold-hr.tsx` | component/route | request-response | `apps/mobile/app/(tabs)/index.tsx` | role-match |
| `apps/mobile/app/onboarding/threshold-pace.tsx` | component/route | request-response | `apps/mobile/app/(tabs)/index.tsx` | role-match |
| `apps/mobile/app/onboarding/review.tsx` | component/route | CRUD | `apps/mobile/app/(tabs)/index.tsx` | no analog (new CRUD form) |
| `apps/mobile/app/(tabs)/_layout.tsx` (replace: Home/Log/Settings) | route | request-response | `apps/mobile/app/(tabs)/_layout.tsx` (self, edit) | exact |
| `apps/mobile/app/(tabs)/index.tsx` (replace: Home placeholder) | component | request-response | `apps/mobile/app/(tabs)/index.tsx` (self, edit) | exact |
| `apps/mobile/app/(tabs)/log/index.tsx` | component/route | request-response | `apps/mobile/app/(tabs)/index.tsx` | role-match |
| `apps/mobile/app/(tabs)/log/session.tsx` | component/route | event-driven | none (no session/store precedent) | no analog |
| `apps/mobile/app/(tabs)/settings/index.tsx` | component/route | CRUD | `apps/mobile/app/onboarding/review.tsx` (planned) | role-match (sibling) |
| `apps/mobile/app/session/finish.tsx` | component/route | request-response | none | no analog |
| `apps/mobile/components/session/ExercisePickerSheet.tsx` | component | request-response | none (`@gorhom/bottom-sheet` new dep) | no analog |
| `apps/mobile/components/session/SetRow.tsx` | component | event-driven | none | no analog |
| `apps/mobile/components/session/RestTimerBanner.tsx` | component | event-driven | none | no analog |
| `apps/mobile/components/session/HSSBreakdownSheet.tsx` | component | transform | none | no analog |
| `apps/mobile/components/BootStates.tsx` (extend: auto-resume prompt) | component | request-response | `apps/mobile/components/BootStates.tsx` (self, edit) | exact |
| `apps/mobile/stores/sessionStore.ts` | store | event-driven | none (zustand not yet used in repo) | no analog — use RESEARCH Pattern 2 |
| `apps/mobile/lib/units.ts` | utility | transform | none (pure fn, follow engine style) | role-match (engine `clamp.ts`) |
| `apps/mobile/lib/effectiveLoad.ts` | utility | transform | `packages/engine/src/strength.ts` (formula shape) | role-match |

## Pattern Assignments

### `packages/engine/src/bodyweight.ts` (service, transform) — D-18

**Analog:** `packages/engine/src/strength.ts` (whole file, 80 lines) and `packages/engine/src/clamp.ts`

**Imports pattern:**
```typescript
import type { EngineConfig } from '@apsis/shared';
import { mergeConfig } from './config';
import { clampRange } from './clamp';
```

**Core pattern — pure estimator with clamp-and-warn, mirrors `estimateE1RM`/`strengthStressDetailed`** (`packages/engine/src/strength.ts` lines 14-23, 30-71):
```typescript
const MAX_REPS = 100; // guard against fat-fingered input — reuse same style

export function estimateE1RM(loadKg: number, reps: number): number {
  return loadKg * (1 + reps / 30);
}
```
New `estimateE1RMFromRepMaxTable` must follow the exact same never-throw, clamp-first shape (see RESEARCH.md "Pattern 3", lines 485-509 — literal starter code for `REP_MAX_TABLE` + `estimateE1RMFromRepMaxTable` is already drafted there and should be used verbatim/extended). Route callers by `exercise.bwFactor != null` (RESEARCH Pattern 2, lines 462-483).

**Error handling / warnings pattern** (`packages/engine/src/strength.ts` lines 43-58):
```typescript
const repsClamp = clampRange(set.reps, 0, MAX_REPS, 'reps');
if (repsClamp.warning) warnings.push(repsClamp.warning);
// `!(x > 0)` not `x <= 0` — NaN-safe guard pattern, reuse verbatim for any "must be positive" check
if (!(set.e1rmKg > 0)) {
  warnings.push(`e1rmKg ${set.e1rmKg} <= 0, skipping set`);
  continue;
}
```

**Testing pattern:** `packages/engine/src/__tests__/strength.test.ts` — mirror structure (unit tests per clamp boundary + a golden/calibration-style test in `__tests__/calibration.test.ts` per D-18's "own tests" requirement).

---

### `packages/engine/src/carry.ts` (service, transform) — D-20

**Analog:** `packages/engine/src/endurance.ts` (whole file, 122 lines)

**Core pattern — Detailed + bare-number facade, IF²-shaped formula** (`packages/engine/src/endurance.ts` lines 96-121):
```typescript
export function enduranceStressDetailed(
  seg: EnduranceSegment,
  cfg?: Partial<EngineConfig>
): EnduranceStressDetail {
  const config = mergeConfig(cfg);
  const warnings: string[] = [];

  const durationClamp = clampRange(seg.durationS, 0, Number.POSITIVE_INFINITY, 'durationS');
  if (durationClamp.warning) warnings.push(durationClamp.warning);

  const ifClamp = clampRange(seg.intensityFactor, MIN_IF, MAX_IF, 'intensityFactor');
  if (ifClamp.warning) warnings.push(ifClamp.warning);

  const durationMin = durationClamp.value / 60;
  const es = durationMin * ifClamp.value ** 2 * config.kEndurance;

  return { es, warnings };
}

export function enduranceStress(seg: EnduranceSegment, cfg?: Partial<EngineConfig>): number {
  return enduranceStressDetailed(seg, cfg).es;
}
```
D-20's formula (`durationMin * (RPE/10)^2 * kCarry * loadRatioMultiplier`) is a direct structural clone of this — substitute RPE/10 for `intensityFactor` and add the load-ratio multiplier as an extra clamped factor. Add a new `CarryStressDetail` type to `packages/shared/src/index.ts` mirroring `EnduranceStressDetail` (lines 61-65 of shared/index.ts).

**Config addition** — add `kCarry` to `DEFAULT_CONFIG` in `packages/engine/src/config.ts` (lines 36-47), documented with the same calibration-anchor comment style used for `kStrength`/`kEndurance` (lines 17-23).

---

### `packages/db/src/schema.ts` (model/migration, CRUD) — D-14/D-21/D-28

**Analog:** self (existing table definitions, lines 1-133)

**Column-add pattern** (`exercise` table, lines 38-45; `workout` table, lines 51-60):
```typescript
export const exercise = sqliteTable('exercise', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  type: text('type', { enum: ['strength', 'endurance', 'hybrid'] }).notNull(),
  bodyPart: text('body_part'),
  isSeeded: integer('is_seeded', { mode: 'boolean' }).default(true),
  // ADD (D-21): bwFactor: real('bw_factor'),  // null = not a BW movement
  // ADD (D-21): entryMode: text('entry_mode', { enum: ['reps', 'timed'] }),
});

export const workout = sqliteTable('workout', {
  id: text('id').primaryKey(),
  localDate: text('local_date').notNull(),
  type: text('type', { enum: ['strength', 'endurance', 'hybrid'] }).notNull(),
  title: text('title'),
  hss: real('hss').default(0),
  createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(unixepoch())`),
  // ADD (D-14): finishedAt: integer('finished_at', { mode: 'timestamp' }),
  // ADD (D-28): deletedAt: integer('deleted_at', { mode: 'timestamp' }),
});
```
Nullable columns, no non-constant default — safe for plain `ALTER TABLE ADD COLUMN` (RESEARCH Pitfall 4/A7). Regenerate via `npx drizzle-kit generate` from `packages/db`; never hand-edit `drizzle/migrations.js` (`packages/db/src/migrations.ts` lines 13-19).

---

### `packages/db/src/seed.ts` (model, batch) — extend `STARTER_EXERCISES`

**Analog:** self (lines 25-104)

Extend each relevant object literal in `STARTER_EXERCISES` with `bwFactor`/`entryMode` (pull-up, dip, push-up, lunge, wall-ball, kb-swing, farmers-carry, sled-push per D-15/D-21); leave `bwFactor: null, entryMode: null` on `type: 'endurance'` rows (RESEARCH Pitfall 5). Keep the idempotent count-before-insert seeder shape unchanged (lines 96-104) — this is a one-time additive data change, not a new seeding mechanism.

---

### `apps/mobile/app/_layout.tsx` (provider/route, request-response) — onboarding gate (D-01)

**Analog:** self (existing boot sequence, lines 1-65)

**Extend pattern** — add a `hasProfile` query gate after the existing `useMigrations`/`seedExercises` sequence (lines 29-63), following RESEARCH.md Pattern 1 (`Stack.Protected` guard, lines 421-454) verbatim as the starting shape:
```tsx
import { Stack } from 'expo-router';
// ...
const hasProfile = useProfileExists(); // new drizzle query hook, only runs after `success`
// ...
return (
  <Stack screenOptions={{ headerShown: false }}>
    <Stack.Protected guard={!hasProfile}>
      <Stack.Screen name="onboarding" />
    </Stack.Protected>
    <Stack.Protected guard={hasProfile}>
      <Stack.Screen name="(tabs)" />
    </Stack.Protected>
  </Stack>
);
```
Preserve the existing error/loading gate style exactly (`_layout.tsx` lines 50-60) — `ErrorScreen`/`LoadingScreen` from `components/BootStates.tsx` render hardcoded strings only (V7/T-1-02, `BootStates.tsx` lines 37-52). Auto-resume prompt (D-14) extends `BootStates.tsx` with a new component in the same no-raw-error-detail style.

---

### `apps/mobile/app/(tabs)/_layout.tsx` and `(tabs)/index.tsx` (route/component) — D-30/D-31

**Analog:** self (existing SDK-56 template, `(tabs)/_layout.tsx` lines 1-70, `(tabs)/index.tsx` lines 1-32)

Replace the two-tab (`index`/`two`) template with three tabs (Home/Log/Settings), keeping the `Tabs` + `Tabs.Screen` + `tabBarIcon` shape (lines 9-19, 20-50) and the `Colors`/`useColorScheme`/`useClientOnlyValue` import conventions (lines 1-7). Home tab body (D-31 placeholder) follows the existing `Text`/`View` from `@/components/Themed` pattern (`(tabs)/index.tsx` lines 1-14) rather than introducing a new themed-component convention.

**IMPORTANT:** `apps/mobile/AGENTS.md` flags that Expo has changed since training data — verify all `expo-router`/`Tabs`/`Stack.Protected` API shapes against https://docs.expo.dev/versions/v56.0.0/ before implementation, per RESEARCH.md Assumption A1.

---

### New session-flow files with no direct analog (`sessionStore.ts`, `SetRow.tsx`, `RestTimerBanner.tsx`, `ExercisePickerSheet.tsx`, `HSSBreakdownSheet.tsx`, `log/session.tsx`, `session/finish.tsx`)

No prior UI/store code exists in this repo (Phase 1/2 were db+engine only). Use RESEARCH.md's own drafted patterns as the primary source instead of a codebase analog:
- **Persist-then-recompute** (commit-a-set flow): RESEARCH.md "Pattern 2" (lines 456-483) — write set via drizzle, re-run `sessionHSSDetailed` over the full accumulated set list (not incremental), update `workout.hss`, then update zustand state.
- **Effective-load computation**: RESEARCH.md "Code Examples" §1 (lines 607-621) — lives in `apps/mobile/lib/effectiveLoad.ts`, NOT inside `packages/engine` (engine only receives final `loadKg`).
- **Imperial round-trip**: RESEARCH.md "Code Examples" §2 (lines 623-637) — `apps/mobile/lib/units.ts`.
- Component structure should still follow the engine's "Detailed result feeds a UI summary" precedent: `sessionHSSDetailed` → `HSSBreakdownSheet` per-exercise rollup (D-24), same shape as `SessionHSSResult` in `packages/shared/src/index.ts` lines 68-76.

---

## Shared Patterns

### Clamp-and-warn (never throw)
**Source:** `packages/engine/src/clamp.ts` (full file, 36 lines)
**Apply to:** `bodyweight.ts`, `carry.ts`, and any new engine function — every numeric input passes through `clampRange(value, min, max, label)` and pushes `warning` into the result's `warnings[]`. Use the NaN-safe `!(x > 0)` idiom, not `x <= 0`, wherever "must be positive" is checked (see `strength.ts` line 55 comment).

### Detailed + bare-number facade
**Source:** `packages/engine/src/strength.ts` lines 73-79, `packages/engine/src/endurance.ts` lines 115-121
**Apply to:** All new engine functions — always export a `*Detailed` function returning `{ value, warnings, ... }` plus a bare-number facade calling `.value`/`.ss`/`.es` off it.

### Versioned config, no magic numbers
**Source:** `packages/engine/src/config.ts` (full file)
**Apply to:** Any new tunable constant (`kCarry`, rep-max-table breakpoints) — add to `DEFAULT_CONFIG`/`EngineConfig` (also update `packages/shared/src/index.ts` lines 41-52), never hardcode inline. Document the calibration anchor in a comment block matching lines 17-23 style.

### No raw error detail to the user (V7/T-1-02)
**Source:** `apps/mobile/components/BootStates.tsx` lines 37-52, `apps/mobile/app/_layout.tsx` lines 50-55
**Apply to:** Any new error-surfacing UI (onboarding save failure, migration failure, discard confirm) — console.error raw details, render a hardcoded generic string to the user only.

### Parameterized drizzle queries only (T-1-01)
**Source:** `packages/db/src/seed.ts` lines 92-104 comment + implementation
**Apply to:** All new db writes (`strengthSet` insert, `workout` update, profile insert/update) — use drizzle's query builder exclusively, never raw `sql` template literals with user-supplied values.

### Idempotent/soft-delete filtering
**Source:** `packages/db/src/schema.ts` `loadDaily` table + `seed.ts` count-before-insert guard (lines 96-100)
**Apply to:** D-28 soft delete — every workout/session read query must filter `deletedAt IS NULL`, following the same "check before acting" discipline as the seeder's count-before-insert guard.

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `apps/mobile/stores/sessionStore.ts` | store | event-driven | First zustand usage in repo — no prior store file; follow RESEARCH.md Pattern 2 and the "Anti-Patterns" note (no `persist`+AsyncStorage) instead |
| `apps/mobile/components/session/*.tsx` (SetRow, RestTimerBanner, ExercisePickerSheet, HSSBreakdownSheet) | component | event-driven/transform | First non-template UI components in the app; `@gorhom/bottom-sheet` and Reanimated count-up have no prior in-repo usage — use RESEARCH.md Code Examples + Don't-Hand-Roll table as the source instead |
| `apps/mobile/app/(tabs)/log/session.tsx`, `app/session/finish.tsx` | route | event-driven/request-response | New screens with no prior multi-step flow in the app; only the boot-sequence gating pattern (`_layout.tsx`) and template tab screens exist as loose structural precedent |
| `apps/mobile/app/onboarding/review.tsx` | component/route | CRUD | First "review + tap-to-edit + save" form screen; reused verbatim later by settings, so no existing analog to draw from besides the plain template screen shape |

## Metadata

**Analog search scope:** `packages/engine/src`, `packages/db/src`, `packages/shared/src`, `apps/mobile/app`, `apps/mobile/components`
**Files scanned:** ~30 (all existing source files across engine/db/shared/mobile)
**Pattern extraction date:** 2026-07-09
