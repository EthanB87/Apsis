---
phase: 04-run-logger-home-dashboard
reviewed: 2026-07-10T23:34:49Z
depth: standard
files_reviewed: 40
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
  - packages/shared/src/__tests__/units.test.ts
  - packages/shared/src/duration.ts
  - packages/shared/src/index.ts
  - packages/shared/src/units.ts
findings:
  critical: 0
  warning: 6
  info: 11
  total: 17
status: issues_found
---

# Phase 4: Code Review Report (Re-Review after 04-09/04-10 gap closure)

**Reviewed:** 2026-07-10T23:34:49Z
**Depth:** standard
**Files Reviewed:** 40
**Status:** issues_found

## Summary

Re-review of the full Phase 4 surface after gap-closure plans 04-09/04-10. All five targeted fixes were traced and **all five hold** (verification detail below). All three test suites pass (shared 21, db 27, mobile 9 — the shared suite now includes explicit WR-08 regression cases). No new critical defects were introduced by the fixes; one narrow new edge case introduced by the CR-02 fix is documented as IN-09, and one residual gap in the WR-07 fix as IN-11.

**Fix verification (prior findings closed):**

- **CR-01 (TrendChart worklet crash) — FIXED.** `formatSignedTsb` (`TrendChart.tsx:71-75`) now carries the `'worklet'` directive, so the `tooltipText` derived-value worklet can call it on the UI thread. `state.matchedIndex` confirmed present in the installed `victory-native` (`dist/cartesian/hooks/useChartPressState.js`), and `data` is a captured plain array (copyable to the UI runtime). No non-worklet host function remains in the worklet's closure.
- **CR-02 (stale `load_daily` rows) — FIXED.** `recomputeLoadDaily.ts:42-47` now fully clears `load_daily` when no finished sessions remain, and lines 56-57 delete every row outside the freshly computed range via `notInArray` before upserting. Delete-the-only-session and delete-the-earliest-session paths both converge correctly.
- **WR-05 (iOS date picker never dismisses) — FIXED.** `run.tsx:290` toggles `setShowDatePicker((open) => !open)` on the date row, and `handleDateChange` (`run.tsx:176-178`) closes the picker on an iOS `'set'` event. Android's unmount-on-any-event behavior is preserved.
- **WR-07 (false "No sessions yet") — FIXED.** `history/index.tsx:106-126` now early-returns only when BOTH `load_daily` and sessions are empty, and `knownDates` unions `load_daily` dates with session dates so pre-recompute sessions render (with `dayHss` falling back to 0). Residual cosmetic gap noted as IN-11.
- **WR-08 (pace "5:60") — FIXED.** `units.ts:67-72` rounds `totalSec` before the floor/mod split; carry into minutes verified by the new `units.test.ts` WR-08 cases (`359.7 -> "6:00"`, `59.6 -> "1:00"`).

**Still open from the prior review:** the fixes deliberately scoped to CR-01/CR-02/WR-05/WR-07/WR-08 leave six prior warnings and seven prior info items unaddressed. They are re-verified against current code and carried forward below with their original IDs referenced, so the trail stays auditable.

## Warnings

### WR-01: TODAY shows stale readiness/ATL/CTL/TSB after rest days — nothing ever recomputes on read (carried over, still open)

**File:** `apps/mobile/app/(tabs)/index.tsx:258-276`
**Issue:** Unchanged since the prior review. `load_daily` is only written by terminal actions (`finishWorkout`, `discardWorkout`, `saveRun`). After N days without logging, no row exists for today and the dashboard falls back to `mostRecentRow` — a band/ATL/CTL/TSB frozen at the *last session day*. ATL decay during rest (the thing that turns red back to green) never appears until the next session is logged. History bridges this exact gap for REST rows (`history/index.tsx:129-136`); TODAY does not, and the 28-day chart's last point is likewise the last recompute date.
**Fix:** In `loadHome`, when the most recent `load_daily` row's `localDate < today`, await `recomputeLoadDaily(db)` before reading (it already gap-fills through the caller-supplied "today"), or derive the decayed bridge in memory via `computeLoadDailyUpsertRows`.

### WR-02: No transactions around multi-statement writes — partial failure leaves a phantom finished workout or a half-updated EWMA chain (carried over, still open)

**File:** `apps/mobile/lib/runEntry.ts:78-103`; `apps/mobile/lib/recomputeLoadDaily.ts:45-83`
**Issue:** Unchanged. `saveRun` performs four dependent writes (insert `workout` with `finishedAt` already set → insert `endurance_segment` → update `workout.hss` → recompute) with no transaction; a mid-sequence failure persists a *finished* 0-HSS workout with no segment that passes every `isNotNull(finishedAt)` filter and appears in History/TODAY (and the save error copy — "Nothing was lost" — becomes false; a retry duplicates the workout). The CR-02 fix slightly *raises* the stakes in `recomputeLoadDaily`: there is now a stale-row `delete` followed by a loop of single-row upserts, so a crash between the delete and the loop (or mid-loop) leaves `load_daily` mixing two recompute generations until the next terminal action.
**Fix:** Wrap each unit of work in `db.transaction(async (tx) => { ... })`, or at minimum insert the `workout` row *without* `finishedAt` and set it as the final statement so a partial save never satisfies the finished-workout filters.

### WR-03: History error message promises "Pull down to try again" but there is no pull-to-refresh (carried over, still open)

**File:** `apps/mobile/app/(tabs)/history/index.tsx:61, 216-256`
**Issue:** Unchanged. `LOAD_ERROR_MESSAGE = "Couldn't load your history. Pull down to try again."` but the `SectionList` has no `refreshControl`/`onRefresh`. The instructed recovery gesture does nothing; the only real retry path is blurring and refocusing the tab.
**Fix:** Add `refreshControl={<RefreshControl refreshing={refreshing} onRefresh={loadHistory} tintColor={Colors.dark.mutedText} />}` to the `SectionList`, or change the copy to match a real recovery path.

### WR-04: Delete/finish/discard failures are swallowed silently — no feedback, and the app proceeds as if it succeeded (carried over, still open)

**File:** `apps/mobile/app/(tabs)/history/index.tsx:193-205`; `apps/mobile/app/session/finish.tsx:271-300`
**Issue:** Unchanged. `handleConfirmDelete` catches `discardWorkout` errors with `console.error` only, closes the modal, and reloads — the row the user asked to delete reappears with zero explanation. In `finish.tsx`, `handleDone`/`handleConfirmDiscard` catch the error and *still* `reset()` the session store and `router.replace('/(tabs)')`: a failed `finishWorkout` leaves the workout silently open (re-triggering the D-14 resume prompt later), and a failed discard-recompute leaves the discarded session's load in `load_daily` with no indication anything went wrong.
**Fix:** On catch, set an inline generic error message (matching `runEntry`'s established discipline) and stay on the screen; only `reset()`/navigate on success.

### WR-05: Save Run uses `router.push` — swipe-back from the finish screen re-arms a duplicate save (carried over from prior WR-06, still open)

**File:** `apps/mobile/app/(tabs)/log/run.tsx:195`
**Issue:** Unchanged. After a successful save the screen pushes `/session/finish`, leaving the fully-populated run form on the stack beneath it. An iOS back-swipe (or Android back) from the finish screen returns to the form with `saving === false` and Save enabled; tapping it inserts a second identical workout. The Done path (`router.replace('/(tabs)')`) doesn't protect the back gesture.
**Fix:** `router.replace({ pathname: '/session/finish', params: { workoutId } })` so the form is popped once the workout exists.

### WR-06: `Colors[colorScheme]` crashes if `useColorScheme` returns `null` (carried over from prior WR-09, still open)

**File:** `apps/mobile/app/(tabs)/_layout.tsx:16-47` (root cause `apps/mobile/components/useColorScheme.ts:5`)
**Issue:** Unchanged. React Native's `useColorScheme()` returns `'light' | 'dark' | null`; the project wrapper only remaps the legacy `'unspecified'` value, so `null` passes straight through and every `Colors[colorScheme]` access in the tab layout (8 sites) becomes `TypeError: Cannot read property ... of undefined`, taking down the root tab navigator.
**Fix:** In `useColorScheme.ts`: `return coreScheme ?? 'light';` (covers both `null` and `'unspecified'`; the palettes are dark-identical either way).

## Info

### IN-01: `formatEnduranceMeta` + compact-duration formatter + month/weekday tables duplicated across three/four screens (carried over, still open)

**File:** `apps/mobile/app/(tabs)/index.tsx:78-125`, `apps/mobile/app/session/detail.tsx:63-108`, `apps/mobile/app/session/finish.tsx:74-119`; `MONTH_ABBR`/`WEEKDAY_NAME` also in `DayRow.tsx:30` and `history/index.tsx:44-57`; `addDaysLocal` (`lib/localDate.ts:32`) duplicates `nextLocalDateString` (`packages/db/src/loadDaily.ts:33`)
**Issue:** Three near-identical ~45-line copies of the endurance meta-line builder, three copies of the h:mm:ss compact formatter, four copies of month-name tables. Any change to the "distance · pace · duration" contract needs 3 coordinated edits.
**Fix:** Extract `formatEnduranceMeta`/`formatCompactDuration` into `@apsis/shared` (pure, display-only, unit-testable) and import everywhere.

### IN-02: Warmup sets counted inconsistently across finish, detail, and TODAY summaries (carried over, still open)

**File:** `apps/mobile/app/session/finish.tsx:228`, `apps/mobile/app/session/detail.tsx:215-239`, `apps/mobile/app/(tabs)/index.tsx:153-166`
**Issue:** `finish.tsx` increments `setCount` for every row including warmups; `detail.tsx` skips warmups. The same session shows "5 sets" on the finish screen and "3 sets" in detail. TODAY's `fetchLiftMetaByWorkout` also folds warmup-set RPEs into `avgRpe` and warmup rows into the dominant-body-part vote, while every stress computation excludes them.
**Fix:** Pick one convention (working sets only, matching the stress math) and apply it in all three aggregators.

### IN-03: Unused import `HIT_TARGET_MIN` in the Log landing screen (carried over, still open)

**File:** `apps/mobile/app/(tabs)/log/index.tsx:22`
**Issue:** `HIT_TARGET_MIN` is imported from `@/constants/theme` but never referenced (buttons use literal `minHeight: 48`).
**Fix:** Remove it from the import — or use it for the button `minHeight` per the theme's own hit-target contract.

### IN-04: `saveRun`'s honest IF-fallback warnings never reach the user (carried over, still open)

**File:** `apps/mobile/lib/runEntry.ts:73-75` (with `apps/mobile/app/session/finish.tsx:165-186`)
**Issue:** When an erg/conditioning session has no HR, `resolveIF` falls back to a neutral 1.0 with a warning — but `saveRun` only `console.warn`s it. The finish screen recomputes from the already-persisted `intensityFactor`, so the warnings never surface, despite D-29's "full engine warnings list" intent.
**Fix:** Return `warnings` from `saveRun` and surface them on the finish screen (route param or re-derive via `resolveRunSegment` there).

### IN-05: TODAY dashboard has no user-visible error state (carried over, still open)

**File:** `apps/mobile/app/(tabs)/index.tsx:331-334`
**Issue:** `loadHome`'s catch only logs and clears `loading` — a failed read silently renders zeros/`calibrating` (or a previous focus's stale values) as if real. History and Log both surface a generic error string for the same failure class.
**Fix:** Add an `errorMessage` field to `HomeState` and render the app's standard generic error line.

### IN-06: `Typography.label` pairs `fontWeight: '400'` with `Archivo_500Medium`, contradicting the file's own guidance (carried over, still open)

**File:** `apps/mobile/constants/theme.ts:71`
**Issue:** The doc block (lines 66-68) warns "a mismatched weight can shift face selection/metrics on iOS" — which is why heading/display omit `fontWeight` — yet `label` declares the 500Medium face with an explicit `'400'` weight.
**Fix:** Drop the `fontWeight` key from `label` (single-face convention), or change it to `'500'`.

### IN-07: Trend tooltip's `translateX` is unclamped — clipped off-card at the right edge (carried over, still open)

**File:** `apps/mobile/components/home/TrendChart.tsx:112-114, 191-200`
**Issue:** Unchanged by the CR-01 fix. The tooltip translates its left edge to the raw press x-position; near the chart's right edge the five-metric tooltip extends past the card and is clipped by `overflow: 'hidden'` — the most recent days (the ones most likely scrubbed) become unreadable.
**Fix:** Clamp the translate in the animated style, e.g. `Math.min(state.x.position.value, chartBoundsSV.value.right - TOOLTIP_MAX_WIDTH)`, or center the tooltip and clamp both edges.

### IN-08: `session/detail.tsx` `loading` state is dead — a missing/unknown `workoutId` renders "Session / Total 0" with no loading or not-found UI (new)

**File:** `apps/mobile/app/session/detail.tsx:114, 133-135, 268-299`
**Issue:** The `loading` state is set in five places but never read in the render — there is no spinner and no not-found branch. While the query runs (and permanently, if `workoutId` is absent or matches no row — the `!w` path just sets `loading` false and returns), the screen renders the placeholder title "Session", an empty row list, and a volt "Total 0", which reads as a real zero-stress session rather than a load failure.
**Fix:** Render an `ActivityIndicator` while `loading`, and a distinct "Session not found" state for the `!w` path; or remove the dead state if a loading UI is deliberately out of scope.

### IN-09: CR-02 fix edge — a clock/timezone rollback past the only session's date wipes all of `load_daily` (new, introduced by the CR-02 fix)

**File:** `apps/mobile/lib/recomputeLoadDaily.ts:50-57` (with `packages/db/src/loadDaily.ts:64-70`)
**Issue:** If every finished session's `localDate` is *after* `todayLocalDate()` (device clock rolled back, or westward timezone travel immediately after logging), `computeLoadDailyUpsertRows`'s date loop (`firstDate <= today`) produces zero rows, so `keep` is `[]`. Drizzle 0.45.2's `notInArray(column, [])` compiles to `sql\`true\`` (verified in `drizzle-orm/sql/expressions/conditions.js:82-86`), so the stale-row delete removes EVERY `load_daily` row while sessions still exist — TODAY drops to 0/calibrating until the clock catches up and the next terminal action recomputes. Self-healing and very narrow, but worth a guard since the pre-fix code merely no-op'd here.
**Fix:** In `recomputeLoadDaily`, if `upsertRows.length === 0` while `rows.length > 0`, skip the delete-and-upsert (log and return) instead of clearing the table; or have `computeLoadDailyUpsertRows` clamp `today` to `max(today, firstDate)`.

### IN-10: `sessionCountsByDate` hand-rolls the soft-delete filter its own file forbids (new)

**File:** `packages/db/src/queries.ts:146-155` (contrast `dayGroupedSessions` at 161-173)
**Issue:** The file's D-28 header states "no query anywhere should hand-roll its own `isNull(workout.deletedAt)`", and `dayGroupedSessions` correctly composes `activeWorkoutFilter` — but `sessionCountsByDate`, added in the same phase, writes `isNull(workout.deletedAt)` inline. Behavior is identical today; the risk is drift if `activeWorkoutFilter` ever gains additional conditions. (`recomputeLoadDaily.ts:40` in apps/mobile has the same inline filter.)
**Fix:** `where(and(isNotNull(workout.finishedAt), activeWorkoutFilter))` in `sessionCountsByDate`; reuse `activeWorkoutFilter` in `recomputeLoadDaily` too.

### IN-11: WR-07 fallback path drops intermediate REST days when `load_daily` is empty (new, residual gap in the WR-07 fix)

**File:** `apps/mobile/app/(tabs)/history/index.tsx:124-138`
**Issue:** In the fallback state (sessions exist but `load_daily` is empty — pre-recompute/legacy data), `knownDates` contains only actual session dates, and the bridge loop only fills from the LAST known date to today. Days *between* two sessions (e.g. sessions on 07-01 and 07-05 with nothing in `load_daily`) are not gap-filled, so those REST days silently vanish — inconsistent with D-27's "REST days render as explicit rows" and with the normal (recomputed) path, where `computeLoadDailyUpsertRows` gap-fills them. Cosmetic and transient (the first recompute repairs it), but the fallback renders a structurally different ledger.
**Fix:** In the fallback path, walk from the earliest known date to today with `addDaysLocal` (the same loop already used for the tail bridge) instead of using only `sortedDates`.

---

_Reviewed: 2026-07-10T23:34:49Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
