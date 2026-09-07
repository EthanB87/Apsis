# Phase 5: HealthKit Integration - Pattern Map

**Mapped:** 2026-07-11
**Files analyzed:** 15
**Analogs found:** 13 / 15

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|--------------------|------|-----------|-----------------|----------------|
| `apps/mobile/lib/healthkitMapping.ts` | utility (pure) | transform | `apps/mobile/lib/runEntryLogic.ts` | exact |
| `apps/mobile/lib/healthkitAuth.ts` | service (native module wrapper) | request-response | `apps/mobile/lib/recomputeLoadDaily.ts` (error-handling shape only) | role-match |
| `apps/mobile/lib/healthkitImport.ts` | service | batch / CRUD | `apps/mobile/lib/runEntry.ts` | exact |
| `apps/mobile/lib/healthkitWriteback.ts` | service | event-driven (fire-and-forget) | `apps/mobile/lib/finishWorkout.ts` | exact |
| `apps/mobile/lib/healthkitSyncState.ts` | service (CRUD on sync state) | CRUD | `apps/mobile/hooks/useSaveProfile.ts` (insert/update shape) | role-match |
| `apps/mobile/lib/__tests__/healthkitMapping.test.ts` | test | transform | `packages/db/src/__tests__/soft-delete.test.ts` / existing `lib/**/__tests__` convention | role-match |
| `apps/mobile/hooks/useForegroundHealthKitSync.ts` | hook | event-driven | `apps/mobile/components/session/RestTimerBanner.tsx` (AppState listener) | exact |
| `apps/mobile/app/onboarding/healthkit.tsx` | component (wizard step) | request-response | `apps/mobile/app/onboarding/bodyweight.tsx` + `apps/mobile/app/onboarding/review.tsx` | exact |
| `apps/mobile/app/(tabs)/settings/index.tsx` (extend) | component | request-response | itself (existing file, extend in place) | exact |
| `apps/mobile/lib/finishWorkout.ts` (extend `discardWorkout`) | service | event-driven | itself (existing file, extend in place) | exact |
| `apps/mobile/lib/runEntry.ts` (extend `saveRun`) | service | CRUD | itself (existing file, extend in place) | exact |
| `packages/db/src/schema.ts` (extend) | model / migration | CRUD | itself (existing file, extend in place) | exact |
| `packages/db/src/queries.ts` (extend, dedupe-candidate builder) | model / query builder | CRUD | `previousSessionSet` builder in same file | exact |
| `packages/db/drizzle/000X_*.sql` | migration | batch | `packages/db/drizzle/0002_careful_sue_storm.sql` (naming/shape convention) | role-match |
| `apps/mobile/hooks/useSaveProfile.ts` (extend for bodyweightSetAt) | hook | CRUD | itself (existing file, extend in place) | exact |

## Pattern Assignments

### `apps/mobile/lib/healthkitMapping.ts` (utility, pure/transform)

**Analog:** `apps/mobile/lib/runEntryLogic.ts` (full file read, 71 lines)

**Header/purity contract pattern** (lines 1-16):
```typescript
/**
 * Pure ... logic, factored out of `runEntry.ts` so it is unit-testable under vitest
 * without importing `@apsis/db` (whose barrel eagerly opens the native op-sqlite JSI
 * connection at module load) or any Expo native module. Zero I/O, zero wall-clock
 * reads - mirrors the `@apsis/engine` purity convention.
 */
```
Apply the same purity contract to `healthkitMapping.ts`: zero `@apsis/db` import, zero native-module import (only type-only imports from `@kingstinct/react-native-healthkit` for enum values are acceptable since they're pure constants, not calls).

**Gating/discretion-boundary pattern** (lines 53-62, `resolveRunSegment`):
```typescript
export function resolveRunSegment(inputs: RunSegmentInputs): RunSegmentResult {
  const paceSecPerKm = computePaceSecPerKm(inputs.distanceM, inputs.durationS);
  const { intensityFactor, warnings: ifWarnings } = resolveIF({
    avgHR: inputs.avgHr,
    thresholdHR: inputs.thresholdHr ?? undefined,
    // Pitfall 6 / T-04-10: ERG/CONDITIONING must never pass a pace into IF resolution.
    paceSecPerKm: inputs.activityType === 'run' ? paceSecPerKm : undefined,
    thresholdPaceSecPerKm: inputs.thresholdPaceSecPerKm ?? undefined,
  });
  ...
}
```
`mapHKActivityType` and `isDuplicateOfExisting` (both already specced in RESEARCH.md Pattern 1) should follow this same explicit-switch/no-throw style with inline comments citing the decision ID (D-04, D-05, D-06) driving each branch. Reuse `resolveRunSegment` itself for imported-run IF resolution — do not reimplement IF gating.

**Never-throw contract:** Every function in this analog returns a result object with `warnings: string[]` rather than throwing — the same shape should carry through `healthkitMapping.ts`'s dedupe/mapping functions so `healthkitImport.ts` can log warnings without try/catch per-row.

---

### `apps/mobile/lib/healthkitImport.ts` (service, batch/CRUD)

**Analog:** `apps/mobile/lib/runEntry.ts` (full file read, 111 lines)

**Imports pattern** (lines 18-23):
```typescript
import { randomUUID } from 'expo-crypto';
import { enduranceSegment, userProfile, workout, type DB } from '@apsis/db';
import { sessionHSSDetailed } from '@apsis/engine';
import { eq } from 'drizzle-orm';
import { recomputeLoadDaily } from './recomputeLoadDaily';
import { resolveRunSegment, type RunActivityType } from './runEntryLogic';
```
`healthkitImport.ts` should mirror this exactly, additionally importing `mapHKActivityType`/`isDuplicateOfExisting` from `healthkitMapping.ts` and the HK query functions from `@kingstinct/react-native-healthkit`.

**Insert -> HSS -> single recompute-at-end pattern** (lines 61-110, `saveRun`):
```typescript
export async function saveRun(database: DB, input: RunEntryInput): Promise<string> {
  try {
    const thresholds = await fetchThresholds(database);
    const { intensityFactor, es, warnings } = resolveRunSegment({...});
    if (warnings.length > 0) {
      console.warn('[Apsis] saveRun resolveIF/enduranceStress warnings:', warnings);
    }
    const workoutId = randomUUID();
    await database.insert(workout).values({ id: workoutId, localDate: input.localDate, type: 'endurance', finishedAt: new Date() });
    await database.insert(enduranceSegment).values({ id: randomUUID(), workoutId, activityType: input.activityType, ... });
    const { hss } = sessionHSSDetailed({ enduranceSegments: [{ durationS: input.durationS, intensityFactor }] });
    await database.update(workout).set({ hss }).where(eq(workout.id, workoutId));
    await recomputeLoadDaily(database);
    return workoutId;
  } catch (err: unknown) {
    console.error('[Apsis] saveRun failed:', err);
    throw err;
  }
}
```
**Critical deviation for the batch case:** per RESEARCH Pitfall 10, `healthkitImport.ts` must NOT call `recomputeLoadDaily` per inserted row — loop the insert+HSS-write body for every non-duplicate HK sample in the batch, and call `recomputeLoadDaily(database)` exactly once after the loop. Set `workout.source = 'healthkit'` and `workout.healthkitUuid = <hk sample uuid>` on every inserted row (D-08/D-11).

**Error handling pattern:** console.error + re-throw at the outer batch level (same as `saveRun`), but per-row dedupe-skip warnings should use `console.warn`, not throw (a skipped duplicate is not a batch failure).

---

### `apps/mobile/lib/healthkitWriteback.ts` (service, event-driven fire-and-forget)

**Analog 1:** `apps/mobile/lib/finishWorkout.ts` (full file read, 46 lines) — soft-delete + fire-and-forget shape
**Analog 2:** RESEARCH.md Code Examples section already contains a verified, ground-truth-checked `discardWorkout` extension and `writeBackRun` example — prefer copying those literally over re-deriving.

**Fire-and-forget tail-call pattern** (RESEARCH.md, verified against `finishWorkout.ts`'s existing shape):
```typescript
export async function discardWorkout(database: DB, workoutId: string, deletedAt: Date): Promise<void> {
  const [row] = await database
    .select({ source: workout.source, healthkitUuid: workout.healthkitUuid })
    .from(workout)
    .where(eq(workout.id, workoutId));

  await softDeleteWorkout(database, workoutId, deletedAt);
  await recomputeLoadDaily(database);

  if (row?.source === 'manual' && row.healthkitUuid != null) {
    deleteObjects('HKWorkoutTypeIdentifier', { uuid: row.healthkitUuid }).catch((err: unknown) => {
      console.error('[Apsis] HealthKit delete-sync failed:', err); // D-25 — silent, never blocks
    });
  }
}
```
**Existing `discardWorkout` to extend** (`apps/mobile/lib/finishWorkout.ts` lines 42-45):
```typescript
export async function discardWorkout(database: DB, workoutId: string, deletedAt: Date): Promise<void> {
  await softDeleteWorkout(database, workoutId, deletedAt);
  await recomputeLoadDaily(database);
}
```
Note the analog's doc-comment convention at the top of the file (lines 1-24) — cite the decision IDs (D-12, D-14, D-25) driving the new behavior the same way `finishWorkout.ts` cites D-27/D-28/D-29.

**Error handling:** never `await`/never rethrow on the HK write call itself — `.catch()` inline, console.error only, consistent with D-12/D-25's "never block save" rule. This is the ONE place in the codebase where a caught error must NOT be re-thrown (contrast with `saveRun`/`recomputeLoadDaily`'s throw-after-log convention — call this out explicitly in the plan).

---

### `apps/mobile/lib/healthkitSyncState.ts` (service, CRUD on sync state)

**Analog:** `apps/mobile/hooks/useSaveProfile.ts` (full file read, 71 lines) for the insert/update-with-error-message shape, and `packages/db/src/schema.ts`'s `userProfile` table (lines 23-34) for the column-shape convention.

**Column convention to extend** (`packages/db/src/schema.ts` lines 23-34):
```typescript
export const userProfile = sqliteTable('user_profile', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  ...
  createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(unixepoch())`),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).default(sql`(unixepoch())`),
});
```
Add nullable columns here (single-row table, matches RESEARCH's "Don't Hand-Roll" recommendation): `bodyweightSetAt` (timestamp, Pitfall 3), `healthkitConnected` (boolean, D-19/D-21 toggle state), `healthkitLastSyncAt` (timestamp, D-24), `healthkitAnchor` (text, opaque anchor token, D-02/Pattern 2).

**Try/catch + console.error + generic message pattern** (`useSaveProfile.ts` lines 46-67):
```typescript
async function save(input: SaveProfileInput): Promise<boolean> {
  setSubmitting(true);
  setErrorMessage(null);
  try {
    await db.insert(userProfile).values({ ... });
    bumpProfileVersion();
    return true;
  } catch (err: unknown) {
    console.error('[Apsis] useSaveProfile insert failed:', err);
    setErrorMessage(SAVE_ERROR_MESSAGE);
    return false;
  } finally {
    setSubmitting(false);
  }
}
```
`healthkitSyncState.ts` read/write helpers (`getSyncState`, `setSyncState`) should be plain async functions (not hooks) since they're called from `healthkitImport.ts`/`useForegroundHealthKitSync.ts`, not directly from a form — but keep the try/catch-log-generic-message discipline. Per D-25, a sync-state write failure must NOT throw up to the UI — log only.

---

### `apps/mobile/hooks/useForegroundHealthKitSync.ts` (hook, event-driven)

**Analog:** `apps/mobile/components/session/RestTimerBanner.tsx` (AppState listener, lines 16-70)

**AppState foreground-trigger pattern** (lines 63-70):
```typescript
import { AppState, ... } from 'react-native';
...
useEffect(() => {
  const subscription = AppState.addEventListener('change', (nextState) => {
    if (nextState === 'active') {
      const wallClockNow = Date.now();
      setNow(wallClockNow);
      // ... re-sync / re-check logic here
    }
  });
  return () => subscription.remove();
}, [...]);
```
Copy this exact `AppState.addEventListener('change', ...)` + cleanup-on-unmount shape. `useForegroundHealthKitSync` should call `healthkitImport`'s batch-sync function on `nextState === 'active'`, gated by the D-21 sync toggle (`healthkitConnected` from `healthkitSyncState.ts`) and by a debounce/in-flight guard so a rapid background/foreground cycle doesn't double-trigger a sync (not present in the analog — new discretion item, note it in the plan).

---

### `apps/mobile/app/onboarding/healthkit.tsx` (component, wizard terminal step)

**Analog 1 (WizardStep shell):** `apps/mobile/app/onboarding/bodyweight.tsx` (full file, 126 lines) for the `WizardStep` wrapper + soft-validation pattern.
**Analog 2 (terminal-step/no-WizardStep shape + profile-version-bump race):** `apps/mobile/app/onboarding/review.tsx` (full file, 95 lines) — CRITICAL, see Pitfall 2 below.

**WizardStep usage pattern** (`bodyweight.tsx` lines 62-90):
```typescript
return (
  <WizardStep
    step="bodyweight"
    question="What's your bodyweight?"
    onNext={handleNext}
    nextDisabled={!isValidNumber}>
    <View style={styles.inputRow}>
      ...
    </View>
  </WizardStep>
);
```
`healthkit.tsx` should use `WizardStep` too (per RESEARCH D-23/D-20's "skippable, quiet decline" framing) but needs a secondary "Not now" action alongside `onNext` — check `WizardStep`'s prop surface for a skip/secondary-action slot before assuming `onNext`-only.

**MANDATORY deviation — profile-version-bump race (RESEARCH Pitfall 2, HIGH confidence, reproduced from live code):**
Current `review.tsx` (lines 37-55):
```typescript
async function handleSubmit(): Promise<void> {
  if (draft.sex == null || ...) return;
  await save({ sex: draft.sex, ... });
  // On success, useProfileExists' version-driven re-query flips Plan 04's
  // Stack.Protected gate to the tab shell — no manual navigation needed here.
}
```
Current `useSaveProfile.ts` (lines 46-59) bumps `useProfileVersion` immediately inside `save()`:
```typescript
await db.insert(userProfile).values({ ... });
bumpProfileVersion();
```
**This bump must move** out of `useSaveProfile.save()` into `healthkit.tsx`'s own "Continue"/"Not now" handlers (both must bump it — D-20 requires declining still completes onboarding). `review.tsx`'s `handleSubmit` must `router.push('/onboarding/healthkit')` after a successful `save()` instead of relying on the `Stack.Protected` gate to auto-navigate. Do not treat this as optional polish — without it the HealthKit step is unreachable.

---

### `apps/mobile/app/(tabs)/settings/index.tsx` (extend)

**Analog:** itself — existing file (735 lines), read in full.

**Section + ChoiceButton pattern to replicate for the Connect/toggle row** (lines 295-299, Units section):
```typescript
<Text style={styles.sectionLabel}>Units</Text>
<View style={styles.choiceRow}>
  <ChoiceButton label="Metric" sub="km, kg" selected={!isImperial} onPress={() => handleUnitsChange('metric')} />
  <ChoiceButton label="Imperial" sub="mi, lb" selected={isImperial} onPress={() => handleUnitsChange('imperial')} />
</View>
```
Add an "Apple Health" section using the same `sectionLabel` + row shape; the D-21 toggle can reuse `ChoiceButton`'s `selected` boolean styling or a plain `Pressable` row consistent with `footer`'s mono-caption style for the D-24 "LAST SYNC 9:41 AM" line (`styles.footerText`, `Mono` typography, lines 607-610).

**Optimistic-update-with-rollback pattern** (lines 227-237, `handleUnitsChange`):
```typescript
async function handleUnitsChange(next: Units): Promise<void> {
  if (draft == null || draft.units === next) return;
  const previous = draft.units;
  setDraft((prev) => (prev ? { ...prev, units: next } : prev));
  const ok = await update({ units: next });
  if (!ok) {
    setDraft((prev) => (prev ? { ...prev, units: previous } : prev));
  }
}
```
The D-21 sync toggle handler should follow this exact optimistic-set-then-rollback-on-failure shape.

---

### `packages/db/src/schema.ts` (extend — D-08/D-14/Pitfall 3 columns + migration)

**Analog:** itself — `workout` table (lines 59-75) and `userProfile` table (lines 23-34), both read in full.

**Column-with-inline-decision-comment convention** (`workout` table, lines 71-74):
```typescript
/** Set when the session is finished (D-14); null = open/in-progress session (crash recovery). */
finishedAt: integer('finished_at', { mode: 'timestamp' }),
/** Soft-delete marker (D-28); null = active. Every load/HSS read must filter this IS NULL. */
deletedAt: integer('deleted_at', { mode: 'timestamp' }),
```
Add to `workout`: `source: text('source', { enum: ['manual', 'healthkit'] }).default('manual')` (D-08) and `healthkitUuid: text('healthkit_uuid')` (D-11/D-14), each with an inline comment citing the decision ID exactly like the existing rows. Add to `userProfile`: `bodyweightSetAt`, `healthkitConnected`, `healthkitLastSyncAt`, `healthkitAnchor` per the `healthkitSyncState.ts` section above, same comment convention.

**Migration file convention:** existing migrations are `packages/db/drizzle/0000_mushy_satana.sql`, `0001_long_firebrand.sql`, `0002_careful_sue_storm.sql` — generate the new one via `npx drizzle-kit generate` (never hand-write), which will produce `0003_<generated-name>.sql`, following the same numbered+adjective-noun auto-naming already in place.

---

### `packages/db/src/queries.ts` (extend — dedupe-candidate query builder)

**Analog:** itself — `previousSessionSet` builder (lines 46-63) in the same file, and `activeWorkoutFilter` (line 35).

**Parameterized builder-factory pattern** (lines 20-25, 46-63):
```typescript
/**
 * Accepts any drizzle SQLite db instance sharing the base query-builder API — the real
 * op-sqlite-backed `DB` in production, or a `drizzle-orm/sqlite-proxy` instance in tests.
 */
export type QueryableDB = BaseSQLiteDatabase<'async', any, any, any>;

export function previousSessionSet(db: QueryableDB, exerciseId: string) {
  return db
    .select({ loadKg: strengthSet.loadKg, ... })
    .from(strengthSet)
    .innerJoin(workout, eq(strengthSet.workoutId, workout.id))
    ...
}
```
The RESEARCH.md Code Examples section already provides the exact target shape (`candidatesForDedupe`) — copy it, adjusted to import `QueryableDB` from this same file rather than redefining it. **Critical:** per Pitfall 9, this builder must deliberately NOT use `activeWorkoutFilter` (the tombstone check needs soft-deleted rows) — comment this exception explicitly, mirroring how `activeWorkoutFilter`'s own doc comment (line 31-34) explains its universal-except-here status.

---

## Shared Patterns

### Error handling / never-block discipline (D-12, D-25)
**Source:** `apps/mobile/lib/finishWorkout.ts`, `apps/mobile/lib/recomputeLoadDaily.ts`, `apps/mobile/hooks/useSaveProfile.ts`
**Apply to:** All new `lib/healthkit*.ts` files
- **Read/import paths** (`healthkitImport.ts`, `healthkitSyncState.ts` reads): follow `recomputeLoadDaily.ts`'s log-then-rethrow pattern (lines 84-87) at the outer batch boundary — the caller (foreground sync hook) catches and treats as a silent no-op per D-25, never surfaces an error banner.
- **Write-back/delete-sync paths** (`healthkitWriteback.ts`): follow the fire-and-forget `.catch()`-only pattern from `finishWorkout.ts`'s extended `discardWorkout` (RESEARCH Code Examples) — never `await` + rethrow, since these must never block the local save.
- Never `console.log`/`console.error` raw HK sample values (bodyweight numbers, HR) — log counts/booleans/durations only, matching the existing `T-04-09` convention already followed throughout `lib/`.

### Recompute-once-per-batch (Pitfall 10)
**Source:** `apps/mobile/lib/recomputeLoadDaily.ts` (header comment, lines 1-23) + `apps/mobile/lib/runEntry.ts` (single-row call site, line 103)
**Apply to:** `healthkitImport.ts` exclusively — every other existing call site (`saveRun`, `finishWorkout`, `discardWorkout`) calls once per single user action, which is already correct; the import batch is the one new case requiring an explicit single end-of-loop call instead of copying the per-row pattern verbatim.

### Zero-I/O pure-module convention
**Source:** `apps/mobile/lib/runEntryLogic.ts` (header comment, lines 1-16)
**Apply to:** `healthkitMapping.ts`
```typescript
/**
 * Pure ... logic ... unit-testable under vitest without importing `@apsis/db`
 * (whose barrel eagerly opens the native op-sqlite JSI connection at module load)
 * or any Expo native module. Zero I/O, zero wall-clock reads.
 */
```

### AppState foreground trigger
**Source:** `apps/mobile/components/session/RestTimerBanner.tsx` lines 16-70
**Apply to:** `useForegroundHealthKitSync.ts`
```typescript
useEffect(() => {
  const subscription = AppState.addEventListener('change', (nextState) => {
    if (nextState === 'active') { /* trigger */ }
  });
  return () => subscription.remove();
}, [...]);
```

### Parameterized drizzle-only, no raw SQL
**Source:** `packages/db/src/queries.ts` header comment (lines 8-10), `packages/db/src/schema.ts` header comment (lines 7-9)
**Apply to:** All new query builders in `queries.ts` and every insert/update in `healthkitImport.ts`/`healthkitWriteback.ts`/`healthkitSyncState.ts` — `eq`/`and`/`isNull`/`isNotNull` composition only, never a `sql` template literal with an interpolated value.

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `apps/mobile/lib/healthkitAuth.ts` | service (native module wrapper) | request-response | No existing file wraps a native permission-request flow in this codebase — HealthKit is the first native module requiring an explicit runtime permission dialog (op-sqlite/Skia need no such gate). RESEARCH.md's Pattern 4 (`requestAuthorization`) is the primary reference; structurally it should still follow the try/catch-log-console.error convention from `recomputeLoadDaily.ts`, but there is no direct analog for the authorization-status-tracking shape itself — treat D-19's "connected = sheet completed" boolean as the entire state model, per RESEARCH's "Don't Hand-Roll" guidance (no status poller). |
| `packages/db/drizzle/000X_*.sql` | migration | batch | Generated by `drizzle-kit generate`, not hand-authored — no "pattern" to copy beyond the numbering/naming convention noted above (existing files `0000`/`0001`/`0002` establish that convention, listed under `packages/db/src/schema.ts` above). |

## Metadata

**Analog search scope:** `apps/mobile/lib/`, `apps/mobile/hooks/`, `apps/mobile/app/onboarding/`, `apps/mobile/app/(tabs)/settings/`, `apps/mobile/components/session/`, `packages/db/src/`
**Files scanned:** 15 read in full (runEntry.ts, runEntryLogic.ts, finishWorkout.ts, recomputeLoadDaily.ts, settingsStore.ts, settings/index.tsx, onboarding/review.tsx, onboarding/bodyweight.tsx, useSaveProfile.ts, profileVersion.ts, schema.ts [partial, tables through endurance_segment], queries.ts [partial, first 60 lines], RestTimerBanner.tsx [AppState section]), plus directory globs of `lib/`, `app/onboarding/`, `app/(tabs)/settings/`, `packages/db/`, `packages/db/drizzle/`
**Pattern extraction date:** 2026-07-11
