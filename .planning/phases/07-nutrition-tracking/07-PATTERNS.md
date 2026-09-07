# Phase 07: Nutrition Tracking - Pattern Map

**Mapped:** 2026-07-13
**Files analyzed:** 19
**Analogs found:** 16 / 19

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `packages/db/src/schema.ts` (extend: `food`, `foodLog`, `recipe`, `recipeIngredient`, `nutritionTarget`, `userProfile.heightCm/birthYear/goalMode`) | model | CRUD | `packages/db/src/schema.ts` (existing tables) | exact (same file, extend in place) |
| `packages/db/src/nutritionQueries.ts` | service (query builders) | CRUD | `packages/db/src/queries.ts` | exact |
| `packages/db/src/nutritionTarget.ts` | service (recompute/upsert orchestration) | CRUD | `packages/db/src/loadDaily.ts` | exact |
| `packages/db/src/seed.ts` — no changes expected, but any nutrition constant/catalog seeding should mirror it | utility (seed) | batch | `packages/db/src/seed.ts` (`STARTER_EXERCISES` + `seedExercises`) | role-match (only if a seeded food/goal-mode catalog is needed) |
| `packages/engine/src/nutrition.ts` (`dailyMacroTarget`, `classifyDayType`, `trainingKcalFromHss`) | service (pure compute) | transform | `packages/engine/src/daily.ts` + `packages/engine/src/config.ts` | exact |
| `packages/engine/src/__tests__/nutrition.test.ts` | test (golden-file) | transform | `packages/engine/src/__tests__/calibration.test.ts` + `daily.test.ts` | exact |
| `apps/mobile/lib/offClient.ts` | service (external HTTP client) | request-response | *(no analog — first network client in the app)* | none |
| `apps/mobile/lib/usdaClient.ts` | service (external HTTP client) | request-response | `apps/mobile/lib/offClient.ts` (sibling, once built) | role-match (internal) |
| `apps/mobile/lib/labelOcrParse.ts` | utility (pure parse/regex) | transform | `apps/mobile/lib/runEntryLogic.ts` | role-match |
| `apps/mobile/lib/nutritionSearch.ts` | service (local-first cache-through) | CRUD + request-response | `apps/mobile/lib/recomputeLoadDaily.ts` (recompute-then-write shape) + `apps/mobile/lib/runEntryLogic.ts` (pure/impure split) | role-match |
| `apps/mobile/lib/recomputeNutritionTarget.ts` (recompute-on-write wrapper, mirrors `recomputeLoadDaily.ts`) | service (recompute/upsert orchestration) | event-driven | `apps/mobile/lib/recomputeLoadDaily.ts` | exact |
| `apps/mobile/lib/nutritionCameraAuth.ts` (camera permission wrapper, if factored out) | service (permission flow) | request-response | `apps/mobile/lib/healthkitAuth.ts` | exact |
| `apps/mobile/app/(tabs)/nutrition/_layout.tsx` | route (tab layout) | request-response | `apps/mobile/app/(tabs)/_layout.tsx` (5th `Tabs.Screen` entry) + `apps/mobile/app/(tabs)/log/_layout.tsx` | exact |
| `apps/mobile/app/(tabs)/nutrition/index.tsx` (today's targets vs. logged totals) | component (screen) | CRUD | `apps/mobile/app/(tabs)/index.tsx` (TODAY screen) | role-match |
| `apps/mobile/app/(tabs)/nutrition/search.tsx` | component (screen) | request-response | `apps/mobile/app/(tabs)/log/index.tsx` (exercise picker/recents list pattern) | role-match |
| `apps/mobile/app/(tabs)/nutrition/scan.tsx` (barcode) | component (screen, native camera) | event-driven | `apps/mobile/app/onboarding/healthkit.tsx` (permission-gated native-capability screen) | partial (permission-UX only; no camera analog exists) |
| `apps/mobile/app/(tabs)/nutrition/label-scan.tsx` (OCR) | component (screen, native camera) | event-driven | `apps/mobile/app/onboarding/healthkit.tsx` | partial (same as above) |
| Nutrition-setup prompt (new profile fields gate, e.g. `apps/mobile/app/nutrition-setup/*.tsx` or a Settings sub-screen) | component (screen) | CRUD | `apps/mobile/app/(tabs)/settings/index.tsx` (staged-draft → batched UPDATE profile editor) | exact |
| `apps/mobile/lib/nutritionTargetSignal.ts` (zustand version bump for nutrition-target recompute, if needed) | store (zustand signal) | event-driven | `apps/mobile/lib/profileVersion.ts` | exact |
| `apps/mobile/lib/sentrySanitize.ts` (extend allowlist reasoning only — no new fields added, nutrition values never forwarded) | utility (security filter) | transform | `apps/mobile/lib/sentrySanitize.ts` (itself — read, do not weaken) | exact |

## Pattern Assignments

### `packages/db/src/schema.ts` (model, CRUD)

**Analog:** itself (`packages/db/src/schema.ts`), existing tables `workout`, `loadDaily`, `userProfile`

**Table definition pattern** (lines 143-164, `loadDaily`):
```typescript
export const loadDaily = sqliteTable(
  'load_daily',
  {
    localDate: text('local_date').primaryKey(),
    dayHss: real('day_hss').default(0),
    // ...
    updatedAt: integer('updated_at', { mode: 'timestamp' }).default(sql`(unixepoch())`),
  },
  (table) => ({
    dateIdx: index('load_daily_date_idx').on(table.localDate),
  }),
);
```
Apply this exact shape to `nutritionTarget` (PK `localDate` won't work here since it's not a singleton-per-day-only table if overrides matter — use `id: text('id').primaryKey()` with a named `localDate` index instead, mirroring `workout`'s `id` + separate index pattern below).

**FK + cascade pattern** (lines 94-101, `strengthSet`):
```typescript
export const strengthSet = sqliteTable('strength_set', {
  id: text('id').primaryKey(),
  workoutId: text('workout_id')
    .notNull()
    .references(() => workout.id, { onDelete: 'cascade' }),
  exerciseId: text('exercise_id')
    .notNull()
    .references(() => exercise.id),
  // ...
});
```
Use for `recipeIngredient.recipeId → recipe.id` (cascade) and `recipeIngredient.foodId → food.id` (no cascade, mirrors `exerciseId`).

**Enum column pattern** (line 71, `workout.type`):
```typescript
type: text('type', { enum: ['strength', 'endurance', 'hybrid'] }).notNull(),
```
Use for `food.source` (`'user'|'off'|'usda'|'apsis'|'commercial'`), `foodLog.meal`, `nutritionTarget.dayType`, `nutritionTarget.source`, and the new `userProfile.goalMode` (`'cut'|'maintain'|'bulk'`).

**Nullable optional-metric column pattern** (lines 105-106, `strengthSet.rpe`):
```typescript
rpe: real('rpe'),
```
Use for `food.fiberGPer100g`, `food.sodiumMgPer100g`, `food.servingName`/`servingGrams`, `food.brand`/`barcode`.

**CRITICAL — do NOT add `userId`.** No existing table (including singleton `userProfile`) has a `userId` column (verified via RESEARCH.md Pitfall 4, grep confirmed zero hits). Drop `userId` from `food_log`/`recipe`/`nutrition_target` even though NUTRITION.md's raw proposal includes it.

**`userProfile` additions** — extend the existing table in place (lines 23-42), following the same inline-doc-comment convention as `healthkitConnected`/`bodyweightSetAt`:
```typescript
/** Height in cm, required for Mifflin-St Jeor BMR (NUTR-15). */
heightCm: real('height_cm'),
/** Birth year, used to derive age for BMR (NUTR-15). */
birthYear: integer('birth_year'),
/** Goal mode driving kcal delta in dailyMacroTarget (NUTR-15). */
goalMode: text('goal_mode', { enum: ['cut', 'maintain', 'bulk'] }),
```

---

### `packages/db/src/nutritionQueries.ts` (service, CRUD)

**Analog:** `packages/db/src/queries.ts`

**Imports/type pattern** (lines 16-25):
```typescript
import { and, desc, eq, isNotNull, isNull, sql } from 'drizzle-orm';
import type { BaseSQLiteDatabase } from 'drizzle-orm/sqlite-core';
import { enduranceSegment, loadDaily, strengthSet, workout } from './schema';

export type QueryableDB = BaseSQLiteDatabase<'async', any, any, any>;
```
Reuse the existing exported `QueryableDB` type from `queries.ts` — do not redeclare.

**Parameterized query-builder-factory pattern** (lines 50-70, `previousSessionSet`):
```typescript
export function previousSessionSet(db: QueryableDB, exerciseId: string) {
  return db
    .select({ /* ... */ })
    .from(strengthSet)
    .innerJoin(workout, eq(strengthSet.workoutId, workout.id))
    .where(and(eq(strengthSet.exerciseId, exerciseId), isNotNull(workout.finishedAt), isNull(workout.deletedAt)))
    .orderBy(desc(workout.finishedAt))
    .limit(1);
}
```
Use this exact shape for `sessionTypesForDate` (already sketched in RESEARCH.md Pattern 3), `computeRecipeServingMacros`'s ingredient join (RESEARCH.md Code Examples), `searchLocalFoods`, `recentFoods`, `favoriteFoods`.

**Aggregate `sql<number>` pattern** (lines 83-95, `recentExerciseIds`):
```typescript
export function recentExerciseIds(db: QueryableDB, limit: number) {
  return db
    .select({
      exerciseId: strengthSet.exerciseId,
      lastUsed: sql<number>`max(${workout.createdAt})`.as('lastUsed'),
    })
    .from(strengthSet)
    .innerJoin(workout, eq(strengthSet.workoutId, workout.id))
    .where(activeWorkoutFilter)
    .groupBy(strengthSet.exerciseId)
    .orderBy(desc(sql`max(${workout.createdAt})`))
    .limit(limit);
}
```
Use for day-total `SUM(food_log.kcal) WHERE localDate = ? GROUP BY localDate` (RESEARCH.md Pattern 2 — no join needed, denormalized).

**Security note (T-1-01):** every builder must use drizzle's parameterized API exclusively — no raw `sql` template literal with an interpolated barcode/search/OCR string. Only static column/aggregate references may appear inside `sql\`...\``.

---

### `packages/db/src/nutritionTarget.ts` (service, CRUD/recompute)

**Analog:** `packages/db/src/loadDaily.ts`

**Pure recompute-row-builder pattern** (lines 49-83, `computeLoadDailyUpsertRows`):
```typescript
export function computeLoadDailyUpsertRows(
  sessions: { localDate: string; hss: number }[],
  today: string,
): LoadDailyUpsertRow[] {
  // groups by date, gap-fills contiguous range, folds through @apsis/engine pure fns
}
```
Mirror this shape for a (much simpler, single-day, no gap-fill/EWMA needed) `computeNutritionTargetRow(profile, dayType, sessionKcal) -> NutritionTargetUpsertRow` that wraps `dailyMacroTarget`/`classifyDayType`/`trainingKcalFromHss` from `@apsis/engine`. Keep this module **I/O-free and wall-clock-free** — same discipline as `loadDaily.ts`'s own doc comment: "this module performs no DB access and never reads the wall clock — `today`/`localDate` is always passed in by the caller."

---

### `apps/mobile/lib/recomputeNutritionTarget.ts` (service, event-driven upsert)

**Analog:** `apps/mobile/lib/recomputeLoadDaily.ts`

**Read → pure-fold → upsert-loop pattern** (lines 35-88, full file):
```typescript
export async function recomputeLoadDaily(database: DB): Promise<void> {
  try {
    const rows = await database.select(/* ... */).from(workout).where(/* ... */);
    if (rows.length === 0) { await database.delete(loadDaily); return; }
    const upsertRows = computeLoadDailyUpsertRows(sessions, todayLocalDate());
    for (const row of upsertRows) {
      await database.insert(loadDaily).values(/* ... */).onConflictDoUpdate({ target: loadDaily.localDate, set: /* ... */ });
    }
  } catch (err: unknown) {
    console.error('[Apsis] Failed to recompute load_daily:', err);
    throw err;
  }
}
```
Reuse for `recomputeNutritionTarget(database, localDate)`: read today's `sessionTypesForDate` + `load_daily.dayHss` for today, fold through `computeNutritionTargetRow`, `onConflictDoUpdate` into `nutrition_target`. **Important divergence from the source pattern (RESEARCH.md Pitfall 5):** `recomputeLoadDaily` is only triggered by a workout write; `nutrition_target` also needs a **lazy-compute-on-view fallback** on the nutrition TODAY screen (`sessionKcal = 0`, `dayType = 'rest'` if no `nutrition_target` row exists yet for today) — there is no existing precedent for this lazy-trigger shape in the codebase; document it clearly at the call site in `nutrition/index.tsx`.

**Security/error-handling pattern:** log-then-rethrow (`console.error` with an `[Apsis]`-prefixed message, `Error` objects only — never raw values, per T-05-01) is the house style; do not swallow errors here either.

---

### `packages/engine/src/nutrition.ts` (service, pure compute)

**Analog:** `packages/engine/src/daily.ts` + `packages/engine/src/config.ts`

**Pure-function-with-config-merge pattern** (lines 25-33, `daily.ts`):
```typescript
export function dailyHSS(sessionScores: number[], cfg?: Partial<EngineConfig>): number {
  const config = mergeConfig(cfg);
  const safeScores = sessionScores.map((s) => (Number.isFinite(s) ? s : 0));
  const total = safeScores.reduce((sum, s) => sum + s, 0);
  if (sessionScores.length > 1) return total * config.doublePenalty;
  return total;
}
```
`dailyMacroTarget`/`classifyDayType`/`trainingKcalFromHss` must follow this exact signature convention: `(...inputs, cfg?: Partial<EngineConfig>) => Result`, resolve via `mergeConfig(cfg)` first line, defend every input (non-finite → 0/clamped, matching D-15 "every public engine function defends its own inputs"), **never** read `Date.now()`, never throw.

**Config-constant-with-provenance-comment pattern** (`config.ts` lines 11-57): every new `EngineConfig` field (`proteinGPerKgCut`, `kcalPerHssPoint`, `carbGPerKgHeavyLift`, etc. — already fully specified in RESEARCH.md Pattern 4) needs a doc comment in `DEFAULT_CONFIG` explaining its literature/heuristic basis and which golden test calibrates it, exactly like the `kStrength`/`kCarry` comments do. Add these fields to `EngineConfig` in `packages/shared/src/index.ts` (sibling of the existing interface), and to `DEFAULT_CONFIG` in `packages/engine/src/config.ts`.

---

### `packages/engine/src/__tests__/nutrition.test.ts` (test, golden-file)

**Analog:** `packages/engine/src/__tests__/calibration.test.ts` + `daily.test.ts`

**Golden-file anchor-test pattern** (full file, `calibration.test.ts`):
```typescript
describe('calibration — threshold run vs. hard 5x5 squat (D-13/D-14)', () => {
  const runSession = { /* ... */ };
  it('a 60-min threshold run (IF 1.0) lands at HSS ≈ 100 (D-14 anchor)', () => {
    const runHSS = sessionHSS(runSession);
    expect(runHSS).toBeCloseTo(100, 0);
  });
  it('the hard 5x5 squat lands within ±25% of the threshold-run HSS (D-13)', () => {
    // computed anchor, not hand-waved
  });
});
```
Apply this exact "compute the real number, assert a defensible range, document why in a comment" discipline to the 5 recommended test cases from RESEARCH.md (`Recommended golden-file test cases`, lines 571-579): maintain+rest sanity check, cut+heavy_lift kcal-delta assertion, bulk+double carb/sessionKcal assertion, invalid-bodyweight zero+warning assertion, fat-floor-clamp assertion. Treat every new `EngineConfig` constant exactly like `kStrength`'s "starting guess, subject to a reasonableness test, not precise calibration" framing (config.ts doc comment convention).

---

### `apps/mobile/lib/offClient.ts` / `usdaClient.ts` (service, request-response)

**No analog exists** — this is the app's first outbound network client. RESEARCH.md's own Code Examples section (already vetted against the actual architecture) is the primary reference:
```typescript
const OFF_BASE = 'https://world.openfoodfacts.org';
const USER_AGENT = 'Apsis/1.0 (support@apsistraining.com)';

export async function offLookupBarcode(barcode: string, signal: AbortSignal) {
  const url = `${OFF_BASE}/api/v2/product/${barcode}.json?fields=product_name,brands,nutriments,serving_size`;
  const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT }, signal });
  const json = await res.json();
  if (json.status !== 1) return null;
  return json.product;
}
```
**Error/timeout handling convention to import from the rest of the codebase** (not network-specific, but the house style): `console.error('[Apsis] ...', err)` with an `[Apsis]`-prefixed message and `Error`-object-only logging (T-05-01, see `healthkitAuth.ts` lines 46-56); use `AbortController` + `setTimeout` for every fetch (5-8s per RESEARCH.md Security Domain), never let a hung request block the logging UI (local-first hard constraint).

---

### `apps/mobile/lib/labelOcrParse.ts` (utility, transform)

**Analog:** `apps/mobile/lib/runEntryLogic.ts`

**Pure-extraction-module-with-no-native-import pattern** (lines 1-16, module doc comment + imports):
```typescript
/**
 * Pure ... logic, factored out of `runEntry.ts` so it is unit-testable under vitest
 * without importing `@apsis/db` ... or any Expo native module. Zero I/O, zero wall-clock
 * reads - mirrors the `@apsis/engine` purity convention.
 */
import { enduranceStressDetailed, resolveIF } from '@apsis/engine';
```
`labelOcrParse.ts` must follow the same "extracted for vitest-testability, zero native import" discipline: it receives `string[]` (already-extracted OCR text lines) as a plain parameter — never calls `expo-text-extractor` itself — and returns a parsed/bounds-checked macro object. Never-divide-by-zero/never-throws guard pattern (lines 43-46, `computePaceSecPerKm`):
```typescript
export function computePaceSecPerKm(distanceM: number | undefined, durationS: number): number | undefined {
  if (distanceM == null || distanceM <= 0 || durationS <= 0) return undefined;
  return durationS / (distanceM / 1000);
}
```
Apply this bounds-check style to every regex-extracted numeric value (Pitfall 9: no negative macros, no absurd values like 50,000 kcal/100g) before returning.

---

### `apps/mobile/lib/nutritionCameraAuth.ts` (service, permission flow)

**Analog:** `apps/mobile/lib/healthkitAuth.ts`

**Full-set-declared-up-front, never-throws permission wrapper pattern** (lines 46-56):
```typescript
export async function requestHealthKitAuthorization(): Promise<boolean> {
  try {
    return await requestAuthorization({ toRead: [...HK_READ_TYPES], toShare: [...HK_WRITE_TYPES] });
  } catch (err: unknown) {
    console.error('[Apsis] HealthKit requestAuthorization failed:', err);
    return false;
  }
}
```
Apply directly to the camera-permission request wrapping `expo-camera`'s `useCameraPermissions()` — the try/catch/log/return-false-never-throw shape is the house convention for any native-capability permission gate.

---

### `apps/mobile/app/(tabs)/nutrition/_layout.tsx` + tab registration (route)

**Analog:** `apps/mobile/app/(tabs)/_layout.tsx`

**5th-tab registration pattern** (lines 99-114, the `settings` `Tabs.Screen`):
```typescript
<Tabs.Screen
  name="settings"
  options={{
    title: 'Settings',
    headerShown: false, // custom in-screen ScreenHeader
    tabBarIcon: ({ color }) => (
      <SymbolView name={{ ios: 'gearshape.fill', android: 'settings', web: 'settings' }} tintColor={color} size={28} />
    ),
  }}
/>
```
Add a `nutrition` `Tabs.Screen` following this exact shape (pick an `ios`/`android`/`web` SF Symbol trio, e.g. `fork.knife`); decide `headerShown` per DESIGN-SYSTEM.md's "one-volt-per-screen" convention (custom `ScreenHeader` vs native header) the same way TODAY/History/Settings already diverge.

---

### `apps/mobile/app/(tabs)/nutrition/scan.tsx` / `label-scan.tsx` (component, event-driven)

**Analog:** `apps/mobile/app/onboarding/healthkit.tsx` (permission-UX only — no camera analog exists in this codebase)

**Permission-gated action + loading-state + never-block pattern** (lines 35-65):
```typescript
export default function HealthKitStep(): React.JSX.Element {
  const [connecting, setConnecting] = useState(false);
  async function handleConnect(): Promise<void> {
    if (connecting) return;
    setConnecting(true);
    try {
      const granted = await requestHealthKitAuthorization();
      if (granted) { /* proceed */ }
    } catch (err: unknown) {
      console.error('[Apsis] ...', err);
    } finally {
      /* always advance/reset state */
    }
  }
  // ...
}
```
Apply the guard-flag (`connecting`/`scanning`) + try/catch/finally + `console.error`-only-logging shape to the camera permission request before mounting `CameraView`. The `CameraView` component structure itself has no in-repo precedent — follow RESEARCH.md's Code Examples section (`ScanScreen` sketch, lines 781-810) directly, since it is the closest thing to a vetted pattern for this net-new native-camera surface.

---

### Nutrition-setup profile-fields prompt (component, CRUD)

**Analog:** `apps/mobile/app/(tabs)/settings/index.tsx`

**Staged-draft → single-batched-UPDATE pattern** (lines 118-147, 319-334):
```typescript
const [draft, setDraft] = useState<ProfileReviewValues | null>(null);
// Seed the local edit draft from the loaded profile row exactly once...
useEffect(() => {
  if (profile != null && draft == null) { /* seed draft from profile */ }
}, [profile, draft]);
// ...
if (draft.sex != null) patch.sex = draft.sex;
if (draft.bodyweightKg != null) { patch.bodyweightKg = draft.bodyweightKg; /* ... */ }
```
Use this exact staged-draft-then-single-patch-object shape for collecting `heightCm`/`birthYear`/`goalMode` (RESEARCH.md Pitfall 2/3 — gate nutrition-target display behind this prompt when any of the three fields is `null`, mirroring `ONB-03`'s "never show wrong numbers until onboarding is complete" pattern applied to a field subset instead of the whole profile).

---

### `apps/mobile/lib/nutritionTargetSignal.ts` (store, event-driven) — only if a cross-screen re-check signal is needed

**Analog:** `apps/mobile/lib/profileVersion.ts`

**Tiny zustand version-counter pattern** (full file):
```typescript
import { create } from 'zustand';

interface ProfileVersionState {
  version: number;
  bump: () => void;
}

export const useProfileVersion = create<ProfileVersionState>()((set) => ({
  version: 0,
  bump: () => set((state) => ({ version: state.version + 1 })),
}));
```
Only introduce a nutrition-equivalent signal if a screen needs to react to a nutrition-target/food-log write happening elsewhere (e.g. quick-add sheet writing while the TODAY nutrition screen is mounted) without a query-invalidation library — same minimal-surface reasoning as `profileVersion.ts`'s own doc comment.

## Shared Patterns

### Security — No `userId`, No raw SQL
**Source:** `packages/db/src/schema.ts` (verified, zero `userId` columns anywhere) + `packages/db/src/queries.ts` module doc comment (T-1-01)
**Apply to:** every new table in `schema.ts`, every new query builder in `nutritionQueries.ts`
```typescript
// Security (T-1-01/T-03-03): every builder here uses drizzle's parameterized query API
// (eq/and/isNull/isNotNull/desc) exclusively — never a raw `sql` template literal with an
// interpolated user-supplied value.
```

### Error handling — log-then-rethrow / log-then-return-false, `[Apsis]`-prefixed, Error-objects-only
**Source:** `apps/mobile/lib/recomputeLoadDaily.ts` (lines 84-87) + `apps/mobile/lib/healthkitAuth.ts` (lines 52-55)
**Apply to:** `recomputeNutritionTarget.ts`, `offClient.ts`, `usdaClient.ts`, `nutritionCameraAuth.ts`, `labelOcrParse.ts` call sites
```typescript
} catch (err: unknown) {
  console.error('[Apsis] Failed to recompute load_daily:', err);
  throw err; // orchestration layers rethrow; permission/UX layers return false instead
}
```

### Engine purity — pure, `cfg?: Partial<EngineConfig>`, no I/O, no `Date.now()`
**Source:** `packages/engine/src/daily.ts` + `packages/engine/src/config.ts`
**Apply to:** all of `packages/engine/src/nutrition.ts`
```typescript
export function dailyHSS(sessionScores: number[], cfg?: Partial<EngineConfig>): number {
  const config = mergeConfig(cfg);
  // defend every input; never throw; never read wall clock
}
```

### Crash-report scrubbing — allowlist, not denylist
**Source:** `apps/mobile/lib/sentrySanitize.ts` (full file)
**Apply to:** NUTR-22 — no code change needed if the allowlist shape is preserved (it already resets `extra`/`breadcrumbs`/`user` unconditionally), but any new nutrition-value logging call site anywhere in the app must never attach kcal/macro/barcode values to Sentry `extra`/`contexts`/`breadcrumbs` — verify no new call site bypasses this filter's allowlist design.

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `apps/mobile/lib/offClient.ts` | service | request-response | First outbound network client in the app (100% offline until this phase) — no HTTP-fetch-wrapper precedent exists anywhere in the codebase. Use RESEARCH.md's Code Examples section directly; apply the codebase's general error-handling/logging conventions (see Shared Patterns) on top of it. |
| `apps/mobile/app/(tabs)/nutrition/scan.tsx` (CameraView structure itself) | component | event-driven | No camera/native-capture screen exists in the codebase (HealthKit is the closest native-capability precedent, but it's a permission+background-sync flow, not a live camera view). Follow RESEARCH.md's `ScanScreen` sketch (Code Examples, lines 781-810) for the `CameraView` structure; reuse `healthkit.tsx`'s permission-guard/loading-state shape around it. |

## Metadata

**Analog search scope:** `packages/db/src`, `packages/engine/src` (+ `__tests__`), `packages/shared/src`, `apps/mobile/lib`, `apps/mobile/app` (tabs, onboarding, settings)
**Files scanned:** `schema.ts`, `queries.ts`, `migrations.ts`, `seed.ts`, `loadDaily.ts`, `config.ts`, `daily.ts`, `calibration.test.ts`, `healthkitAuth.ts`, `runEntryLogic.ts`, `profileVersion.ts`, `recomputeLoadDaily.ts`, `sentrySanitize.ts`, `(tabs)/_layout.tsx`, `onboarding/healthkit.tsx`, `(tabs)/settings/index.tsx` (partial)
**Pattern extraction date:** 2026-07-13
