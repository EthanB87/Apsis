---
phase: 04-run-logger-home-dashboard
reviewed: 2026-07-10T22:20:27Z
depth: standard
files_reviewed: 38
files_reviewed_list:
  - apps/mobile/app/(tabs)/_layout.tsx
  - apps/mobile/app/(tabs)/history/_layout.tsx
  - apps/mobile/app/(tabs)/history/index.tsx
  - apps/mobile/app/(tabs)/index.tsx
  - apps/mobile/app/(tabs)/log/index.tsx
  - apps/mobile/app/(tabs)/log/run.tsx
  - apps/mobile/app/session/detail.tsx
  - apps/mobile/app/session/finish.tsx
  - apps/mobile/components/history/DayRow.tsx
  - apps/mobile/components/home/HssRing.tsx
  - apps/mobile/components/home/PlateOrbit.tsx
  - apps/mobile/components/home/ReadinessLight.tsx
  - apps/mobile/components/home/StatTiles.tsx
  - apps/mobile/components/home/TodayBreakdownSheet.tsx
  - apps/mobile/components/home/TrendChart.tsx
  - apps/mobile/constants/theme.ts
  - apps/mobile/lib/__tests__/runEntryLogic.test.ts
  - apps/mobile/lib/finishWorkout.ts
  - apps/mobile/lib/localDate.ts
  - apps/mobile/lib/recomputeLoadDaily.ts
  - apps/mobile/lib/runEntry.ts
  - apps/mobile/lib/runEntryLogic.ts
  - apps/mobile/package.json
  - apps/mobile/vitest.config.mts
  - packages/db/drizzle/0002_careful_sue_storm.sql
  - packages/db/drizzle/meta/_journal.json
  - packages/db/drizzle/meta/0002_snapshot.json
  - packages/db/drizzle/migrations.js
  - packages/db/package.json
  - packages/db/src/__tests__/history-queries.test.ts
  - packages/db/src/__tests__/load-daily.test.ts
  - packages/db/src/index.ts
  - packages/db/src/loadDaily.ts
  - packages/db/src/queries.ts
  - packages/db/src/schema.ts
  - packages/shared/src/__tests__/duration.test.ts
  - packages/shared/src/duration.ts
  - packages/shared/src/index.ts
findings:
  critical: 2
  warning: 9
  info: 7
  total: 18
status: issues_found
---

# Phase 4: Code Review Report

**Reviewed:** 2026-07-10T22:20:27Z
**Depth:** standard
**Files Reviewed:** 38
**Status:** issues_found

## Summary

Reviewed the full Phase 4 surface: run/erg/conditioning entry (`run.tsx`, `runEntry.ts`, `runEntryLogic.ts`), the TODAY dashboard and its components (`HssRing`, `TrendChart`, `StatTiles`, `ReadinessLight`, `TodayBreakdownSheet`, `PlateOrbit`), History + session detail, the `load_daily` recompute pipeline (`recomputeLoadDaily.ts`, `computeLoadDailyUpsertRows`), the new db query builders, migration 0002, and the shared duration parser. All three test suites pass (shared 17, db 27, mobile 9). Query builders are consistently parameterized — no injection surface found; the soft-delete filter and finished-only filters are applied on every history/load read path.

Two critical defects were found by tracing the code against the actual installed library sources: (1) the TrendChart scrub tooltip calls a non-worklet JS function from a UI-thread worklet, which throws at first scrub (confirmed against `react-native-worklets` runtime, which hard-throws "Tried to synchronously call a non-worklet function on the UI thread"); (2) `recomputeLoadDaily` never deletes stale `load_daily` rows and no-ops entirely when the last remaining session is discarded, so a deleted session's HSS/ATL/CTL/readiness keeps rendering on TODAY — a direct violation of the D-28 "discarded sessions never appear in any HSS/load computation" contract, reachable by the very common "new user logs first session, then deletes it" path.

The warnings cluster around data freshness (stale readiness after rest days), missing write atomicity (no transactions around multi-statement saves/recomputes), and several silent-failure/no-recovery UX paths.

## Critical Issues

### CR-01: TrendChart scrub tooltip calls a non-worklet function on the UI thread — runtime exception on first chart scrub

**File:** `apps/mobile/components/home/TrendChart.tsx:71-74, 100-107`
**Issue:** `tooltipText` is a `useDerivedValue` worklet (explicitly marked `'worklet'`) that calls `formatSignedTsb(point.tsb)`. `formatSignedTsb` (line 71) is a plain module-scope function with no `'worklet'` directive. Verified against the installed toolchain: the `react-native-worklets` babel plugin captures it as an ordinary closure variable (`plugin/index.js` `getClosure`, no transitive workletization), and the runtime throws `"Tried to synchronously call a non-worklet function on the UI thread"` when a captured host function is invoked on the UI runtime (`react-native-worklets/lib/module/memory/valueUnpacker.native.js:48`, `ValueUnpacker.cpp:43`). `matchedIndex` initializes to `-1` (verified in `victory-native/dist/cartesian/hooks/useChartPressState.js`), so `data[state.matchedIndex.value]` is `undefined` at mount and the early return masks the bug — it detonates on the first press/scrub of the chart, when `matchedIndex` becomes `>= 0`. The D-19/D-20 scrub tooltip — the whole point of the chart interaction — crashes the app (dev red screen; unhandled worklet exception in release).
**Fix:**
```ts
function formatSignedTsb(tsb: number): string {
  'worklet';
  const rounded = Math.round(tsb);
  return rounded > 0 ? `+${rounded}` : rounded < 0 ? `−${Math.abs(rounded)}` : '+0';
}
```
(or inline the sign formatting directly inside the `tooltipText` worklet body).

### CR-02: `recomputeLoadDaily` never removes stale `load_daily` rows — deleting the only session leaves its HSS/readiness permanently on TODAY

**File:** `apps/mobile/lib/recomputeLoadDaily.ts:35-37` (with `packages/db/src/loadDaily.ts:53-55`)
**Issue:** The recompute is upsert-only. Two consequences:
1. **Empty-set no-op:** when the last finished, non-deleted workout is discarded, `rows.length === 0` triggers an early return and `load_daily` is left completely untouched — still holding the deleted session's `dayHss`, `atl`, `ctl`, `tsb`, and `readinessBand`. The TODAY ring (`app/(tabs)/index.tsx:259, 275`) reads today's `load_daily` row directly, so the athlete deletes their only session and the ring keeps showing its HSS and a readiness band derived from deleted data. This is the first-session user journey (log → notice a mistake → delete), not an exotic edge case, and it directly violates D-28's "the discarded session then never appears in history or any HSS/load computation."
2. **Range-shrink leak:** when the *earliest* session is deleted, `computeLoadDailyUpsertRows` re-anchors `firstDate` to the new earliest session, so rows before the new range are never overwritten — stale `dayHss`/EWMA values linger in `load_daily` and feed `last28DaysTrend`, skewing the chart and `historyDays`.

**Fix:** In `recomputeLoadDaily`, before writing (ideally inside one transaction — see WR-02): delete every `load_daily` row whose `localDate` is not in the recompute output, and when `rows.length === 0`, `DELETE FROM load_daily` instead of returning early:
```ts
if (rows.length === 0) {
  await database.delete(loadDaily);
  return;
}
// ...after computing upsertRows:
const keep = upsertRows.map((r) => r.localDate);
await database.delete(loadDaily).where(notInArray(loadDaily.localDate, keep));
```

## Warnings

### WR-01: TODAY shows stale readiness/ATL/CTL/TSB after rest days — nothing ever recomputes on read

**File:** `apps/mobile/app/(tabs)/index.tsx:258-276`
**Issue:** `load_daily` is only written by terminal actions (`finishWorkout`, `discardWorkout`, `saveRun`). If the athlete hasn't logged anything for N days, no row exists for today, and the dashboard falls back to `mostRecentRow` — the band/ATL/CTL/TSB computed as of the *last session day*. ATL decay during rest (the thing that turns red back to green) never materializes on screen until the next session is logged. Readiness is most valuable *before* training ("should I go hard today?"), so after a hard block + a week off, the athlete opens the app and still sees "OVERREACHING · RED ZONE" with a week-old TSB. History (`history/index.tsx:125-134`) explicitly bridges this exact gap for REST rows; TODAY does not. The 28-day chart has the same hole (its last point is the last recompute date).
**Fix:** In `loadHome`, when the most recent `load_daily` row's `localDate < today`, await `recomputeLoadDaily(db)` (it already gap-fills through the caller-supplied "today") before reading, or derive the decayed bridge in memory via `computeLoadDailyUpsertRows`.

### WR-02: No transactions around multi-statement writes — partial failure leaves a phantom finished workout or a half-updated EWMA chain

**File:** `apps/mobile/lib/runEntry.ts:78-103`; `apps/mobile/lib/recomputeLoadDaily.ts:42-66`
**Issue:** `saveRun` performs four dependent writes (insert `workout` with `finishedAt` already set → insert `endurance_segment` → update `workout.hss` → recompute) with no transaction. If the segment insert or hss update throws, a *finished* workout row with `hss: 0` and no segment persists — it passes every `isNotNull(finishedAt)` filter and shows up in History/TODAY as a 0-HSS phantom session with no way to inspect it (detail screen renders zero rows). Likewise `recomputeLoadDaily` runs a loop of sequential single-row upserts; a mid-loop failure leaves `load_daily` with rows from two different recompute generations — an internally inconsistent ATL/CTL chain that persists until the next successful terminal action.
**Fix:** Wrap each unit of work in a transaction (`db.transaction(async (tx) => { ... })` with drizzle/op-sqlite), or at minimum insert the `workout` row *without* `finishedAt` and set it as the final statement so a partial save never satisfies the finished-workout filters.

### WR-03: History error message promises "Pull down to try again" but there is no pull-to-refresh

**File:** `apps/mobile/app/(tabs)/history/index.tsx:61, 212-252`
**Issue:** `LOAD_ERROR_MESSAGE = "Couldn't load your history. Pull down to try again."` — but the `SectionList` has no `refreshControl`/`onRefresh`. After a load failure, the instructed recovery gesture does nothing; the only actual retry path is blurring and refocusing the tab, which the copy doesn't mention.
**Fix:** Add `refreshControl={<RefreshControl refreshing={refreshing} onRefresh={loadHistory} tintColor={Colors.dark.mutedText} />}` to the `SectionList`, or change the copy to match a real recovery path.

### WR-04: Delete/finish/discard failures are swallowed silently — the user gets no feedback and the app proceeds as if it succeeded

**File:** `apps/mobile/app/(tabs)/history/index.tsx:189-201`; `apps/mobile/app/session/finish.tsx:271-300`
**Issue:** `handleConfirmDelete` catches `discardWorkout` errors with `console.error` only, then closes the modal and reloads — the row the user asked to delete reappears with zero explanation. Worse in `finish.tsx`: `handleDone`/`handleConfirmDiscard` catch the error and then *still* `reset()` the session store and `router.replace('/(tabs)')` — if `finishWorkout` failed before setting `finishedAt`, the workout silently stays open (re-triggering the D-14 resume prompt later, confusingly); if `discardWorkout`'s recompute failed after the soft delete, `load_daily` still contains the discarded session's load with no indication anything went wrong.
**Fix:** On catch, set an inline error message (matching the app's existing generic-error discipline, e.g. `runEntry`'s pattern) and *stay on the screen* instead of navigating away; only `reset()`/navigate on success.

### WR-05: iOS date picker can never be dismissed once opened

**File:** `apps/mobile/app/(tabs)/log/run.tsx:168-171, 282-296`
**Issue:** `handleDateChange` runs `setShowDatePicker(Platform.OS === 'ios')` — i.e. permanently `true` on iOS — and the date row's `onPress` only ever calls `setShowDatePicker(true)`. On iOS there is no code path that sets it back to `false`, so once the athlete taps the date row, the picker stays mounted in the ledger card for the remainder of the screen's life. (On Android the dialog dismisses itself and the `false` write is correct.)
**Fix:** Toggle on the row press and/or close on selection:
```ts
onPress={() => setShowDatePicker((open) => !open)}
// or in handleDateChange, after setSelectedDate(date):
if (Platform.OS === 'ios' && event.type === 'set') setShowDatePicker(false);
```

### WR-06: Save Run uses `router.push` — swipe-back from the finish screen re-arms a duplicate save

**File:** `apps/mobile/app/(tabs)/log/run.tsx:188`
**Issue:** After a successful save the screen pushes `/session/finish`, leaving the fully-populated run form on the stack beneath it. An iOS back-swipe (or Android back) from the finish screen returns to the form with `saving === false` and the volt Save button enabled; tapping it inserts a *second* identical workout. The normal Done path (`router.replace('/(tabs)')`) doesn't protect the back gesture.
**Fix:** `router.replace({ pathname: '/session/finish', params: { workoutId } })` so the form is popped off the stack once the workout exists.

### WR-07: History renders "No sessions yet" when `load_daily` is empty but finished sessions exist

**File:** `apps/mobile/app/(tabs)/history/index.tsx:106-110`
**Issue:** `loadHistory` early-returns with an empty list whenever `dailyRows.length === 0`, ignoring the `counts`/`sessions` results it fetched in the same `Promise.all`. `load_daily` is only populated by terminal actions performed *after* this phase shipped — an athlete with pre-Phase-4 finished workouts (or anyone whose recompute failed, cf. WR-02/WR-04) sees the "No sessions yet / Log a lift or a run" empty state while their sessions demonstrably exist in `workout`. Their history appears wiped until the next finish/discard triggers a recompute.
**Fix:** When `dailyRows` is empty but `sessions` is not, either trigger `recomputeLoadDaily(db)` and re-read, or build the day entries from `sessions`/`counts` with `dayHss` falling back to 0.

### WR-08: Pace can render as "4:60" — seconds rounded to 60 without carrying into minutes

**File:** `packages/shared/src/units.ts:67-71` (root cause, outside diff scope) — surfaced by `apps/mobile/app/(tabs)/log/run.tsx:140-148`, `apps/mobile/app/session/finish.tsx:100-117`, `apps/mobile/app/session/detail.tsx:90-107`, `apps/mobile/app/(tabs)/index.tsx:107-124`
**Issue:** `formatPaceMinSec` computes `minutes = Math.floor(totalSec / 60)` but `seconds = Math.round(totalSec % 60)`. Any pace with a fractional-seconds remainder ≥ 59.5 (e.g. `359.7 s/km`) renders `"5:60"` instead of `"6:00"`. Every pace displayed in this phase (live pace readout, finish summary, session detail, TODAY session rows, erg /500M splits) flows through this function with real-division fractional inputs, so the broken rendering is reachable from all four reviewed callers.
**Fix:** Round first, then split:
```ts
export function formatPaceMinSec(totalSec: number): string {
  const rounded = Math.round(totalSec);
  const minutes = Math.floor(rounded / 60);
  const seconds = rounded % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}
```

### WR-09: `Colors[colorScheme]` crashes if `useColorScheme` returns `null`

**File:** `apps/mobile/app/(tabs)/_layout.tsx:11, 16-20, 37-47` (with `apps/mobile/components/useColorScheme.ts`)
**Issue:** React Native's `useColorScheme()` returns `'light' | 'dark' | null`. The project wrapper only remaps the legacy `'unspecified'` value — `null` passes straight through, making every `Colors[colorScheme]` access in the tab layout (`.tabIconSelected`, `.background`, `.border`, `.text` — 8 sites) a `TypeError: Cannot read property ... of undefined` that takes down the root tab navigator.
**Fix:** In `useColorScheme.ts`: `return coreScheme ?? 'light';` (covers both `null` and `'unspecified'` since the theme is dark-identical either way).

## Info

### IN-01: `formatEnduranceMeta` + compact-duration formatter + month/weekday tables duplicated across three/four screens

**File:** `apps/mobile/app/(tabs)/index.tsx:78-125`, `apps/mobile/app/session/detail.tsx:63-108`, `apps/mobile/app/session/finish.tsx:74-119`; `MONTH_ABBR`/`WEEKDAY_NAME` also in `DayRow.tsx:30` and `history/index.tsx:44-57`; `addDaysLocal` (`lib/localDate.ts:32`) duplicates `nextLocalDateString` (`packages/db/src/loadDaily.ts:33`)
**Issue:** Three near-identical ~45-line copies of the endurance meta-line builder (each comment acknowledging the duplication) plus three copies of the h:mm:ss compact formatter and four copies of month-name tables. Any change to the "distance · pace · duration" contract now needs 3 coordinated edits — the drift the codebase's own `calibratingCaption` helper exists to prevent.
**Fix:** Extract `formatEnduranceMeta`/`formatCompactDuration` into `@apsis/shared` (pure, display-only, unit-testable) and import everywhere.

### IN-02: Warmup sets counted inconsistently across finish, detail, and TODAY summaries

**File:** `apps/mobile/app/session/finish.tsx:228`, `apps/mobile/app/session/detail.tsx:215-239`, `apps/mobile/app/(tabs)/index.tsx:153-166`
**Issue:** `finish.tsx` increments `setCount` for every row including warmups; `detail.tsx` skips warmups (`if (s.isWarmup) continue` / `.filter((s) => !s.isWarmup)`). The same session shows "5 sets" on the finish screen and "3 sets" in the detail screen. TODAY's `fetchLiftMetaByWorkout` also folds warmup-set RPEs into `avgRpe` and warmup rows into the dominant-body-part vote, while every stress computation excludes them.
**Fix:** Pick one convention (working sets only, matching the stress math) and apply it in all three aggregators.

### IN-03: Unused import `HIT_TARGET_MIN` in the Log landing screen

**File:** `apps/mobile/app/(tabs)/log/index.tsx:22`
**Issue:** `HIT_TARGET_MIN` is imported from `@/constants/theme` but never referenced (buttons use literal `minHeight: 48`).
**Fix:** Remove it from the import — or better, use it for the button `minHeight` per the theme's own hit-target contract.

### IN-04: `saveRun`'s honest IF-fallback warnings never reach the user

**File:** `apps/mobile/lib/runEntry.ts:73-75` (with `apps/mobile/app/session/finish.tsx:165-186`)
**Issue:** When an erg/conditioning session has no HR, `resolveIF` falls back to a neutral 1.0 with a warning — but `saveRun` only `console.warn`s it. The finish screen then recomputes from the already-persisted `intensityFactor`, so `resolveIF` never re-runs and its warnings never surface, despite D-29's "full engine warnings list" intent. The athlete isn't told their session was scored at neutral intensity.
**Fix:** Return `warnings` from `saveRun` and pass them to the finish screen (route param or re-derive via `resolveRunSegment` there).

### IN-05: TODAY dashboard has no user-visible error state

**File:** `apps/mobile/app/(tabs)/index.tsx:331-334`
**Issue:** `loadHome`'s catch only logs and clears `loading` — a failed read silently renders zeros/`calibrating` (or the previous focus's stale values) as if they were real data, with no error text anywhere. History and Log both surface a generic error string for the same failure class.
**Fix:** Add an `errorMessage` field to `HomeState` and render the app's standard generic error line.

### IN-06: `Typography.label` pairs `fontWeight: '400'` with `Archivo_500Medium`, contradicting the file's own guidance

**File:** `apps/mobile/constants/theme.ts:71`
**Issue:** The doc block on lines 66-68 warns "a mismatched weight can shift face selection/metrics on iOS" (which is why heading/display omit `fontWeight`), yet `label` declares the 500Medium face with an explicit `'400'` weight.
**Fix:** Drop the `fontWeight` key from `label` (single-face convention), or change it to `'500'`.

### IN-07: Trend tooltip's `translateX` is unclamped — clipped off-card at the right edge

**File:** `apps/mobile/components/home/TrendChart.tsx:111-113, 190-200`
**Issue:** The tooltip translates to the raw press x-position with its left edge at the cursor; near the chart's right edge the (fairly wide, five-metric) tooltip extends past the card and is clipped by `overflow: 'hidden'` — the very data the athlete is scrubbing for becomes unreadable for the most recent days.
**Fix:** Clamp the translate in the animated style, e.g. `Math.min(state.x.position.value, chartBoundsSV.value.right - TOOLTIP_MAX_WIDTH)`, or center the tooltip and clamp both edges.

---

_Reviewed: 2026-07-10T22:20:27Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
