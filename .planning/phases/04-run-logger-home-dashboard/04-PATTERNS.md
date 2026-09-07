# Phase 4: Run Logger & Home Dashboard - Pattern Map

**Mapped:** 2026-07-10
**Files analyzed:** 17
**Analogs found:** 14 / 17

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|--------------------|------|-----------|-----------------|----------------|
| `apps/mobile/app/(tabs)/log/run.tsx` | screen (form) | CRUD (single-row write) | `apps/mobile/components/session/SetRow.tsx` (field styling) + `apps/mobile/app/(tabs)/log/index.tsx` (screen shell/save flow) | role-match |
| `apps/mobile/app/session/finish.tsx` (retrofit) | screen (summary) | request-response | itself (existing file, extend for endurance branch + mini-ring) | exact |
| `apps/mobile/app/session/detail.tsx` | screen (read-only detail) | request-response | `apps/mobile/app/session/finish.tsx` (SQLite-truth query + summary render pattern) | role-match |
| `apps/mobile/app/(tabs)/index.tsx` (TODAY, retrofit) | screen (dashboard) | request-response + reactive read | itself (placeholder) + `apps/mobile/components/session/LiveHssHeader.tsx` (count-up animation pattern) | role-match |
| `apps/mobile/app/(tabs)/history/index.tsx` | screen (paginated ledger) | CRUD (read, paginated) + event-driven (swipe-delete) | `apps/mobile/app/(tabs)/log/index.tsx` (screen shell) + `packages/db/src/queries.ts` (grouped query style) | role-match |
| `apps/mobile/app/(tabs)/_layout.tsx` (retrofit) | route/config | — | itself (existing file, add HISTORY tab + TODAY rename) | exact |
| `apps/mobile/app/(tabs)/log/index.tsx` (retrofit) | screen | CRUD | itself (add "Log Run" secondary CTA) | exact |
| `apps/mobile/components/home/HssRing.tsx` | component (visual/animated) | transform (render) | `apps/mobile/components/session/LiveHssHeader.tsx` (Reanimated count-up `withTiming` pattern) | role-match |
| `apps/mobile/components/home/ReadinessLight.tsx` | component | transform (render) | `apps/mobile/components/session/SetRow.tsx` (mono-label + semantic-color badge styling) | partial |
| `apps/mobile/components/home/StatTiles.tsx` | component | transform (render) | `apps/mobile/app/session/finish.tsx` (label + tabular-nums value row pattern) | partial |
| `apps/mobile/components/home/TrendChart.tsx` | component (chart, new lib) | event-driven (gesture) | NONE — first chart in codebase; see "No Analog Found" | no analog |
| `apps/mobile/components/history/DayRow.tsx` | component (accordion row) | transform (render) + event-driven (expand/swipe) | `apps/mobile/components/session/SetRow.tsx` (row layout, warning-badge expand pattern) | role-match |
| `apps/mobile/lib/recomputeLoadDaily.ts` | service/utility (db pipeline) | batch (full-history fold) | `apps/mobile/lib/commitSet.ts` (persist-then-recompute, `recomputeSessionHss` pattern) | exact |
| `apps/mobile/lib/runEntry.ts` | service/utility | CRUD (insert + compute) | `apps/mobile/lib/commitSet.ts` (`commitSet` insert + engine-call + write-back pattern) | exact |
| `apps/mobile/lib/durationDigits.ts` | utility (pure fn) | transform | `apps/mobile/lib/effectiveLoad.ts` (small pure-function utility module, same directory convention) | role-match |
| `packages/db/src/schema.ts` (migration: add `workout.note`) | model/schema | CRUD | itself (existing `workout`/`loadDaily`/`enduranceSegment` table defs) | exact |
| `packages/db/src/__tests__/recompute-load-daily.test.ts` | test | batch | `packages/db/src/__tests__/previous-session-query.test.ts` (sqlite-proxy `.toSQL()` test style) | exact |

## Pattern Assignments

### `apps/mobile/app/(tabs)/log/run.tsx` (screen/form, CRUD)

**Analogs:** `apps/mobile/components/session/SetRow.tsx` (field styling/tap-to-type), `apps/mobile/app/(tabs)/log/index.tsx` (screen shell + save-and-navigate flow)

**Imports pattern** (SetRow.tsx lines 26-36):
```typescript
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { db } from '@apsis/db';
import { carryStressDetailed, estimateE1RM, ... } from '@apsis/engine';
import { kgToDisplayLbFractional, lbToKgExact, type Units } from '@apsis/shared';

import Colors from '../../constants/Colors';
import { Radius, Spacing } from '../../constants/theme';
```

**Tap-to-type inset field pattern** (SetRow.tsx lines 232-249, 372-385):
```typescript
<TextInput
  value={loadText ?? (draft.isBlank ? '' : formatWeightValue(draft.loadFieldKg, units))}
  placeholder="0"
  placeholderTextColor={Colors.dark.mutedText}
  onChangeText={(text) => {
    const clean = text.replace(/[^0-9.]/g, '');
    setLoadText(clean);
    patch({ loadFieldKg: parseWeightInput(clean, units), isBlank: false });
  }}
  onBlur={() => setLoadText(null)}
  keyboardType="decimal-pad"
  selectTextOnFocus
  style={[styles.valueField, styles.flexField]}
/>
// styles.valueField: inset steel, hairline border, mono tabular value — reuse verbatim
// for DISTANCE/DURATION/AVG HR fields (D-03).
```
Reuse this local-text-buffer-during-edit pattern for the duration smart-entry field (avoid
re-formatting mid-keystroke, same lesson SetRow already learned for decimal loads).

**Screen shell + save flow pattern** (log/index.tsx lines 14-77, `todayLocalDate()` helper lines 29-35):
```typescript
async function handleSave(): Promise<void> {
  if (saving) return;
  setSaving(true);
  setErrorMessage(null);
  try {
    const profile = await fetchProfileSummary(db);
    const workoutId = randomUUID();
    await db.insert(workout).values({ id: workoutId, localDate, type: 'endurance', note });
    // ... insert endurance_segment, compute HSS, call recomputeLoadDaily ...
    router.push({ pathname: '/session/finish', params: { workoutId } });
  } catch (err: unknown) {
    console.error('[Apsis] Failed to save run:', err);
    setErrorMessage(SAVE_ERROR_MESSAGE);
  } finally {
    setSaving(false);
  }
}
```
**IMPORTANT:** promote `todayLocalDate()` (log/index.tsx lines 29-35) to a shared
`lib/localDate.ts` helper and reuse it everywhere Phase 4 derives "today" (Pitfall 4 in
RESEARCH.md — timezone drift between the date picker and `recomputeLoadDaily`).

**Error handling pattern:** hardcoded generic user-facing string + `console.error` for
diagnostics (log/index.tsx lines 71-74) — reuse exactly, per project's V7/T-1-02 convention.

---

### `apps/mobile/app/session/finish.tsx` (retrofit — screen, request-response)

**Analog:** itself (existing file)

**Core pattern to extend** (finish.tsx lines 62-158): branch the `useEffect` summary-fetch on
`workout.type` — existing code queries `strengthSet`/`exercise`; add an `enduranceSegment`
branch computing `sessionHSSDetailed({ enduranceSegments: [...] })` per Pattern 3 in
RESEARCH.md. Keep the "re-derive from SQLite, never from a store" invariant (comment lines
11-15) — the run-save flow does not mount a persistent session store the way lifting does.

**Done/Discard flow** (lines 160-187): reuse `finishWorkout`/`discardWorkout` from
`lib/finishWorkout.ts` unchanged; both already accept any `workoutId` regardless of type.

**Mini-ring insertion point:** replace the plain `Text` HSS display (lines 224-226,
`styles.hss`/`Typography.display`) with the new `HssRing` component sized to 84px (D-04) —
same count-up mechanism as `LiveHssHeader.tsx`.

---

### `apps/mobile/components/home/HssRing.tsx` (component, transform/render)

**Analog:** `apps/mobile/components/session/LiveHssHeader.tsx`

**Reanimated count-up pattern** (LiveHssHeader.tsx lines 16, 22-23, 51-61, 76-88):
```typescript
import Animated, { Easing, useAnimatedProps, useSharedValue, withTiming } from 'react-native-reanimated';

Animated.addWhitelistedNativeProps({ text: true });
const AnimatedTextInput = Animated.createAnimatedComponent(TextInput);
const COUNT_UP_DURATION_MS = 500;

const hssValue = useSharedValue(liveHss);
useEffect(() => {
  hssValue.value = withTiming(liveHss, { duration: COUNT_UP_DURATION_MS, easing: Easing.out(Easing.cubic) });
}, [liveHss, hssValue]);

const animatedProps = useAnimatedProps(() => ({ text: `${Math.round(hssValue.value)}` }));
// <AnimatedTextInput editable={false} pointerEvents="none" caretHidden
//   animatedProps={animatedProps} style={[styles.hssValue, tabularNums]} />
```
Apply D-05's "animate once per day, instant on repeat visits" gate as a wrapper condition
around whether `withTiming` or a direct `hssValue.value = liveHss` assignment runs.

**Tap-to-open-sheet pattern** (lines 71-90): `<Pressable onPress={() => setBreakdownOpen(true)}>`
— reuse for D-24's ring-tap-opens-breakdown-sheet behavior, targeting a new home store/local
state instead of `sessionStore.breakdownOpen`.

**Ring geometry:** no existing SVG ring in the codebase — hand-roll per RESEARCH.md's
"Don't Hand-Roll" table recommendation (stroke-dashoffset `Circle` from `react-native-svg`,
~40 lines); no closer analog exists.

---

### `apps/mobile/components/home/ReadinessLight.tsx` / `StatTiles.tsx` (components, render)

**Analog:** `apps/mobile/components/session/SetRow.tsx` (mono-label + semantic-color badge
convention), `apps/mobile/app/session/finish.tsx` (label/value stacked row pattern, lines
353-363 `styles.label`/`styles.hss`)

**Mono uppercase caption + value pattern** (finish.tsx lines 353-363):
```typescript
label: { ...Typography.label, color: Colors.dark.mutedText, marginTop: Spacing.lg, marginBottom: Spacing.sm },
hss: { ...Typography.display, color: Colors.dark.accent, marginBottom: Spacing.xxxl },
```
Reuse for ATL/CTL/TSB stat tiles (big number + mono caption, D-21) — swap `Typography.display`
for a smaller tile-scale numeral per DESIGN-SYSTEM.md's stat-tile spec.

**Semantic status coloring** (SetRow.tsx lines 213, 399-401, `RPE_HEAT_THRESHOLD`/
`valueFieldHot`): the pattern of conditionally applying a semantic color style
(`Colors.dark.destructive`/`warning`/`accent`) based on a threshold check is the template for
PRIMED(volt)/CAUTION(amber)/OVERREACHING(molten) readiness-light coloring (D-02).

---

### `apps/mobile/components/home/TrendChart.tsx` (component, event-driven/gesture)

**No analog in codebase** — first chart implementation. Follow RESEARCH.md Pattern 4
(`victory-native` `CartesianChart` + `useChartPressState`) verbatim; confirm the exact
TypeScript signature against `node_modules/victory-native`'s installed `.d.ts` once installed
(RESEARCH.md Assumption A2). `GestureHandlerRootView` already wraps the app root
(`apps/mobile/app/_layout.tsx`) — no additional setup needed.

---

### `apps/mobile/components/history/DayRow.tsx` (component, transform + event-driven)

**Analog:** `apps/mobile/components/session/SetRow.tsx`

**Expand/collapse row + badge pattern** (SetRow.tsx lines 159, 323-336, `warningExpanded`
state + conditional `Text` render): reuse for the accordion day-row expand and the
"2 SESSIONS · ADJUSTED" amber chip / "DAY TOTAL ... INCL. +N DOUBLE-DAY LOAD" expanded detail
(D-26). Row hairline-border + surface-background convention (SetRow.tsx `styles.container`,
lines 341-349) matches the day-row / rest-day-row visual language directly.

**Swipe-to-delete:** no swipe pattern was found inside the files read this session; RESEARCH.md
references a `@gorhom/bottom-sheet`+`Swipeable` root wrap already present in `app/_layout.tsx`
(added Phase 3) — planner should locate Phase 3's actual `Swipeable` set-row-delete
implementation (not read this session; grep `Swipeable` in `apps/mobile` during planning) as
the concrete analog for D-29's swipe-to-delete-session gesture.

---

### `apps/mobile/lib/recomputeLoadDaily.ts` (service, batch)

**Analog:** `apps/mobile/lib/commitSet.ts` (`recomputeSessionHss` — persist-then-recompute
shape, full-recompute-never-delta discipline)

**Full-recompute pattern** (commitSet.ts lines 65-116, doc comment lines 1-14):
```typescript
async function recomputeSessionHss(database: DB, workoutId: string, profileBodyweightKg: number): Promise<CommitSetResult> {
  const rows = await database.select({...}).from(strengthSet).innerJoin(exerciseTable, ...).where(eq(strengthSet.workoutId, workoutId));
  // ... build engine input arrays from rows ...
  const result = sessionHSSDetailed({ strengthSets, carrySets });
  await database.update(workout).set({ hss: result.hss }).where(eq(workout.id, workoutId));
  return { hss: result.hss, warnings: result.warnings };
}
```
`recomputeLoadDaily` is the day/trend-level analog of this same "read all rows → call pure
engine function → write result back" shape, just scoped to the whole `workout` table instead
of one workout's sets — confirms `computeLoadTrendSeries`/`dailyHSS` (never hand-rolled EWMA)
per RESEARCH.md Pattern 1.

**Schema/table reference** (`packages/db/src/schema.ts` lines 59-72, 127-148): `workout.hss`,
`workout.finishedAt`, `workout.deletedAt` read filters, and the full `loadDaily` table shape
(`localDate` PK, `dayHss`/`atl`/`ctl`/`tsb`/`readinessBand`, named `load_daily_date_idx` index)
— use these exact column names in the upsert.

**Error handling / security convention** (finishWorkout.ts lines 17-19, commitSet.ts lines
10-13): parameterized drizzle builders only, no raw `sql` template literal interpolation of
user-supplied values — the one exception is the documented `sql\`excluded.column\`` upsert
idiom (RESEARCH.md Open Question 1), which references only column names, not user data.

---

### `apps/mobile/lib/runEntry.ts` (service, CRUD)

**Analog:** `apps/mobile/lib/commitSet.ts` (`commitSet` function, lines 118-159)

**Insert + engine-call + write-back pattern** (commitSet.ts lines 125-159):
```typescript
export async function commitSet(database: DB, input: CommitSetInput): Promise<CommitSetResult> {
  const loadKg = computeEffectiveLoad({ bwFactor: exercise.bwFactor }, input.loadFieldKg, input.profileBodyweightKg);
  await database.insert(strengthSet).values({ id: input.id, workoutId: input.workoutId, ... });
  return recomputeSessionHss(database, input.workoutId, input.profileBodyweightKg);
}
```
`runEntry.ts`'s save handler mirrors this exactly: insert `workout` row, insert
`enduranceSegment` row, call `resolveIF` + `enduranceStressDetailed`/`sessionHSSDetailed`
(RESEARCH.md Pattern 3), write `workout.hss`, then call `recomputeLoadDaily(db)`.

---

### `packages/db/src/__tests__/recompute-load-daily.test.ts` (test)

**Analog:** `packages/db/src/__tests__/previous-session-query.test.ts`

**sqlite-proxy `.toSQL()` test pattern** (lines 1-16):
```typescript
import { drizzle } from 'drizzle-orm/sqlite-proxy';
import * as schema from '../schema';
import { previousSessionSet } from '../queries';

const mockDb = drizzle(async () => ({ rows: [] }), { schema });
```
For `recompute-load-daily.test.ts`, prefer testing the pure gap-fill/fold logic
(`recomputeLoadDaily`'s data-shaping helpers) directly with fabricated `{localDate, hss}[]`
arrays rather than SQL generation — no live op-sqlite connection needed (RESEARCH.md's Wave 0
Gaps note). Reuse the `sqlite-proxy` `mockDb` pattern only if/when the upsert SQL shape itself
needs assertion (parameterization check, matching `previous-session-query.test.ts`'s "binds as
parameter, never interpolated" style, lines 30-35).

## Shared Patterns

### Focus-gated store/DB access
**Source:** RESEARCH.md Pitfall 5 (STATE.md Phase 3 P10 lesson) — no single file excerpt
read this session, but the convention is explicit project policy.
**Apply to:** `app/(tabs)/index.tsx` (TODAY), `app/(tabs)/history/index.tsx` — every effect
that reads `load_daily`/`workout` on these tab screens MUST use `useFocusEffect`, never a bare
`useEffect`.

### Error handling (hardcoded user message + console.error)
**Source:** `apps/mobile/app/(tabs)/log/index.tsx` lines 71-74; `apps/mobile/lib/finishWorkout.ts` lines 17-19
```typescript
} catch (err: unknown) {
  console.error('[Apsis] <action> failed:', err);
  setErrorMessage(GENERIC_MESSAGE);
}
```
**Apply to:** `run.tsx` save handler, `recomputeLoadDaily.ts`, `history/index.tsx` swipe-delete handler.

### Soft-delete + recompute
**Source:** `apps/mobile/lib/finishWorkout.ts` (`discardWorkout`, lines 33-35) +
`packages/db` (`softDeleteWorkout` builder, referenced not re-read this session)
**Apply to:** D-29's swipe-to-delete-session in `history/index.tsx` — call the existing
`softDeleteWorkout(db, workoutId, deletedAt)` builder, then call the new
`recomputeLoadDaily(db)` afterward (extends the existing pattern one step further than the
current lifting-only flow does).

### Local date derivation (`todayLocalDate`)
**Source:** `apps/mobile/app/(tabs)/log/index.tsx` lines 28-35
```typescript
function todayLocalDate(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
```
**Apply to:** MUST be promoted to a shared `lib/localDate.ts` and reused verbatim by
`run.tsx` (date picker default + editable date), `recomputeLoadDaily.ts` ("today" boundary),
and `history/index.tsx` (month grouping) — RESEARCH.md Pitfall 4 flags this as a
correctness-critical de-duplication, not a style nit.

### Tabular-nums / mono instrument styling
**Source:** `apps/mobile/constants/theme.ts` (`tabularNums`, `Mono`, `Spacing`, `Typography`,
`Radius` — referenced across every file read this session, not re-excerpted here)
**Apply to:** every new component in this phase; import from `../../constants/theme` and
`../../constants/Colors` following the exact same relative-import depth convention seen in
`SetRow.tsx`/`LiveHssHeader.tsx`/`finish.tsx`.

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `apps/mobile/components/home/TrendChart.tsx` | component | event-driven (gesture) | No chart exists anywhere in the codebase yet (first `victory-native` consumer); follow RESEARCH.md Pattern 4 (official victory-native docs) instead of a codebase analog |
| `apps/mobile/lib/durationDigits.ts` | utility | transform | No existing "smart digit entry" parser exists; RESEARCH.md Pattern 2 provides a complete reference implementation — treat that as the source of truth, `effectiveLoad.ts` only supplies the *module-shape* convention (small pure exported function, no React) |
| Swipe-to-delete gesture for `DayRow.tsx` | component interaction | event-driven | Not read this session — Phase 3 almost certainly has a `Swipeable` set-row-delete implementation (per RESEARCH.md's `@gorhom/bottom-sheet`/`Swipeable` root-wrap reference in `app/_layout.tsx`); planner should `grep -r Swipeable apps/mobile` during planning to locate and cite the concrete file/lines |

## Metadata

**Analog search scope:** `apps/mobile/app/`, `apps/mobile/components/session/`,
`apps/mobile/lib/`, `apps/mobile/app/(tabs)/`, `packages/db/src/schema.ts`,
`packages/db/src/__tests__/`
**Files scanned:** 11 read in full (SetRow.tsx, LiveHssHeader.tsx, HSSBreakdownSheet.tsx,
finish.tsx, finishWorkout.ts, commitSet.ts, `(tabs)/_layout.tsx`, `(tabs)/index.tsx`,
`(tabs)/log/index.tsx`, schema.ts §workout/enduranceSegment/loadDaily,
previous-session-query.test.ts) plus 2 directory listings
**Pattern extraction date:** 2026-07-10
