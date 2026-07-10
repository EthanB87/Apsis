---
phase: 04-run-logger-home-dashboard
plan: 08
subsystem: History tab + session detail + 4-tab shell
tags: [history, ledger, swipe-delete, session-detail, tab-bar, react-native, expo-router]
dependency_graph:
  requires: ["04-01", "04-03"]
  provides:
    - "app/(tabs)/history/index.tsx (History tab)"
    - "components/history/DayRow.tsx"
    - "app/session/detail.tsx"
    - "4-tab bar (TODAY/LOG/HISTORY/SETTINGS)"
  affects:
    - "app/(tabs)/_layout.tsx"
    - "app/(tabs)/index.tsx (its router.push to /session/detail now resolves)"
tech_stack:
  added: []
  patterns:
    - "SectionList + client-side windowed pagination (sticky month headers, no second SQL round-trip)"
    - "load_daily is already calendar-contiguous (computeLoadDailyUpsertRows gap-fills REST days) -- History only bridges the remaining gap between the last recompute's 'today' and the actual current day via addDaysLocal"
    - "ReanimatedSwipeable session-sub-row delete, mirroring ExerciseCard.tsx's set-row Swipeable exactly"
    - "nested <Stack.Screen options={{headerShown:true}}> override to re-enable the native back button on a screen reached from a pushed route, since the root layout defaults headerShown to false"
key_files:
  created:
    - apps/mobile/app/(tabs)/history/index.tsx
    - apps/mobile/app/(tabs)/history/_layout.tsx
    - apps/mobile/components/history/DayRow.tsx
    - apps/mobile/app/session/detail.tsx
  modified:
    - apps/mobile/app/(tabs)/_layout.tsx
decisions:
  - "DAY TOTAL uses the persisted, authoritative load_daily.dayHss (never a local re-sum of session scores) -- same 'authoritative value, not a re-sum' discipline TodayBreakdownSheet.tsx already uses for its own Day Total row; the +Y DOUBLE-DAY LOAD delta is computed locally via dailyHSS(scores) - sum(scores), matching TodayBreakdownSheet's exact calculation"
  - "The DAY TOTAL X / INCL. +Y DOUBLE-DAY LOAD line is rendered as ONE combined mono-ash Text string per 04-UI-SPEC.md's Copywriting Contract table, not a separate total row plus a warning-colored line (corrected mid-execution after re-reading the exact contract string)"
  - "History reads the full load_daily/sessionCounts/dayGroupedSessions tables in one useFocusEffect-triggered query and paginates client-side (windowDays state, ~30-day slices on scroll-near-bottom) rather than issuing paginated SQL round-trips -- matches recomputeLoadDaily's existing 'read everything, fold in memory' discipline for this single-user local-first dataset size"
  - "REST days mostly fall out of load_daily for free (computeLoadDailyUpsertRows already gap-fills every day from the first-ever session through whatever 'today' was at the last recompute); History only bridges the remaining gap between that last-recomputed date and the actual current calendar day via addDaysLocal, so a multi-day-idle app open still shows correct REST rows instead of silently skipping days"
  - "session/detail.tsx reuses finish.tsx's exact SQLite-truth query shape (persisted, cached strengthSet.e1rmKg column, never re-estimated via estimateE1RM) and stays on a plain useEffect (not useFocusEffect) -- it's a one-time pushed screen with no store writes, matching finish.tsx's own precedent, not the Pitfall-5 store-oscillation risk that mandates useFocusEffect on tab screens"
  - "Session sub-row label falls back to capitalize(workout.type) with 'endurance' mapped to the friendlier 'Run' when workout.title is null (title is never currently written anywhere in the app) -- executor discretion, not a locked UI-SPEC string"
metrics:
  duration: ~25min
  completed: 2026-07-10
status: complete
---

# Phase 4 Plan 8: History Ledger + Session Detail + 4-Tab Shell Summary

Built the History tab's day-grouped training ledger with honest double-session math, rest-day
rows, sticky month headers, and swipe-to-delete; a new read-only session-detail screen branching
strength vs. endurance; and the D-07 four-tab restructure (TODAY/LOG/HISTORY/SETTINGS).

## What Was Built

**History tab (`app/(tabs)/history/index.tsx` + `components/history/DayRow.tsx`)**

- `useFocusEffect`-driven load of `load_daily` (full table), `sessionCountsByDate`, and
  `dayGroupedSessions` on every focus (Pitfall 5 — no bare `useEffect`).
- Calendar-contiguous ledger: `load_daily` already gap-fills REST days from the athlete's
  first-ever session through the last recompute's "today" boundary
  (`computeLoadDailyUpsertRows`); History bridges the remaining gap up to the *actual* current
  day via `addDaysLocal`, so a multi-day-idle reopen still shows correct REST rows.
- `SectionList` grouped by month (`{MONTH} {YEAR}`, sticky headers via
  `stickySectionHeadersEnabled`), windowed client-side (30-day slices, grown on
  `onEndReached`) rather than a second SQL round-trip per scroll — the whole dataset is read
  once per focus and sliced in memory, matching `recomputeLoadDaily`'s existing
  full-history-fold discipline.
- `DayRow.tsx`: date + day HSS (bone, `tabularNums`); a `2 SESSIONS · ADJUSTED` amber pill for
  multi-session days; tap toggles an inline accordion listing each session
  (`ReanimatedSwipeable`, mirroring `ExerciseCard.tsx`'s exact swipe-to-delete pattern) followed
  by a single combined mono-ash line — `DAY TOTAL {X} · INCL. +{Y} DOUBLE-DAY LOAD` — where X is
  the persisted `load_daily.dayHss` and Y = `dailyHSS(scores) - sum(scores)` via `@apsis/engine`
  (never a hand-rolled multiplier). REST days render as a thinner, ash, non-tappable row.
- Swipe reveals a molten "Delete" action; tapping it opens a confirm `Modal` with the exact
  UI-SPEC copy ("Delete this session? Its HSS will be removed from your training load and
  can't be recovered." / Keep / Delete session); confirming calls `discardWorkout` (soft-delete
  + forward `load_daily` recompute) then reloads the ledger.
- Empty state (`No sessions yet` / `Log a lift or a run and it'll show up here.`) when
  `load_daily` has zero rows; error copy on query failure ("Couldn't load your history. Pull
  down to try again.").

**Session detail (`app/session/detail.tsx`)**

- Pushed screen reached from a History session sub-row; reads `workoutId` from params.
- Re-derives everything from SQLite (never a store), branching on `workout.type`:
  - Endurance: one subtotal row per `endurance_segment` via `enduranceStressDetailed`, with a
    per-type meta line (distance/pace/duration for run/erg, duration+HR for conditioning).
  - Strength/hybrid: per-exercise subtotal rows, re-running `strengthStressDetailed` /
    `carryStressDetailed` over the persisted, cached `strengthSet.e1rmKg` column (never
    re-estimated), matching `finish.tsx`'s exact query shape.
- Both branches end in a Heading-size, volt total row (`workout.hss`, not re-summed) — safe
  here per One-Volt Discipline since this screen is never visible alongside the Home ring.
- Native back-button header re-enabled via a nested `<Stack.Screen options={{headerShown: true, ...}}>` override (root layout defaults `headerShown` to false, same as `finish.tsx`).
- No edit/delete controls (delete lives in History's swipe; editing deferred).

**4-tab restructure (`app/(tabs)/_layout.tsx`)**

- `index` tab renamed `Home` → `TODAY`, kept the plate-mark icon, `headerShown: false` (TODAY
  already renders its own in-screen greeting header).
- New `history` `Tabs.Screen` inserted between `log` and `settings`: title `History`, calendar
  `SymbolView` glyph (`ios: 'calendar'`, `android/web: 'calendar_month'`), `headerShown: false`.
- `log`/`settings` unchanged; mono uppercase tab-label styling and void tab-bar chrome
  preserved.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 — missing critical structure] Added `app/(tabs)/history/_layout.tsx`**
- **Found during:** Task 1 (History ledger scaffolding)
- **Issue:** The plan's declared file list only named `history/index.tsx`, but both existing
  tab-group directories (`log/`, `settings/`) each have their own `_layout.tsx` establishing a
  plain, header-less `Stack` for that group — a convention this new directory should match for
  consistency (and to avoid relying solely on the `Tabs.Screen`-level `headerShown: false`
  override for a header that could otherwise flash/differ from its siblings).
- **Fix:** Added `apps/mobile/app/(tabs)/history/_layout.tsx`, a verbatim copy of the
  `log`/`settings` pattern (`<Stack screenOptions={{ headerShown: false }} />`).
- **Files modified:** `apps/mobile/app/(tabs)/history/_layout.tsx`
- **Commit:** a9d422d

**2. [Rule 1 — spec-conformance bug caught mid-execution] Fixed the DAY TOTAL/DOUBLE-DAY LOAD line shape**
- **Found during:** Task 1, before the Task-1 commit (self-review against 04-UI-SPEC.md's
  Copywriting Contract table)
- **Issue:** First draft rendered "DAY TOTAL" as a separate value row (à la
  `HSSBreakdownSheet`'s total row) plus a second, amber-colored "INCL. +Y DOUBLE-DAY LOAD" line.
  The UI-SPEC's Copywriting Contract table specifies this as ONE combined mono, ash-colored
  string: `"DAY TOTAL {X} · INCL. +{Y} DOUBLE-DAY LOAD"`.
- **Fix:** Collapsed both into a single `Text` element with the exact combined string, ash
  color (not amber/warning), removed the now-unused `totalRow`/`totalLabel`/`totalValue`
  styles.
- **Files modified:** `apps/mobile/components/history/DayRow.tsx`
- **Commit:** a9d422d (fixed before the commit was made, not a follow-up commit)

No auth gates encountered. No architectural (Rule 4) changes needed.

## Verification

- `cd apps/mobile && test -f components/history/DayRow.tsx && grep -q "useFocusEffect" 'app/(tabs)/history/index.tsx' && grep -q "ADJUSTED" components/history/DayRow.tsx && grep -q "DOUBLE-DAY" components/history/DayRow.tsx` — PASS
- `cd apps/mobile && test -f app/session/detail.tsx && grep -q "workout" app/session/detail.tsx` — PASS
- `cd apps/mobile && grep -q 'name="history"' 'app/(tabs)/_layout.tsx' && grep -q "TODAY" 'app/(tabs)/_layout.tsx' && grep -q "calendar" 'app/(tabs)/_layout.tsx'` — PASS
- Root `pnpm run typecheck` (`tsc --build`): clean except the two pre-existing documented errors
  (`app/onboarding/review.tsx`, `components/ExternalLink.tsx`) — confirms the 04-07 handoff
  note's expected "one new route resolves, back to two pre-existing errors" outcome. The
  `app/(tabs)/index.tsx` `router.push('/session/detail', ...)` call (added in 04-07, previously
  flagged as an expected typecheck error until this plan) now resolves cleanly.
- On-device UAT (day-grouped ledger with rest days + month headers; double-session ADJUSTED
  chip + math; swipe-delete confirm/removal/trend update) is a phase-gate item, not verified in
  this execution (no physical device / EAS build available in this environment — consistent
  with Phase 4's existing Windows-host iOS-linking deferral, STATE.md Phase 04 P02 decision).

## Known Stubs

None. All three screens are fully wired to live SQLite reads via the existing `@apsis/db` query
builders and `@apsis/engine` formulas — no hardcoded/placeholder data paths.

## Threat Flags

None. All new reads/writes go through existing parameterized builders
(`sessionCountsByDate`, `dayGroupedSessions`, `discardWorkout`/`softDeleteWorkout`,
direct `db.select().from(loadDaily)`/`workout`/`strengthSet`/`enduranceSegment` with `eq()`
predicates) — no raw `sql` interpolation of user-supplied values, matching the threat
register's T-04-16/T-04-17/T-04-18 mitigations already declared for this plan.

## Self-Check: PASSED

- FOUND: apps/mobile/app/(tabs)/history/index.tsx
- FOUND: apps/mobile/app/(tabs)/history/_layout.tsx
- FOUND: apps/mobile/components/history/DayRow.tsx
- FOUND: apps/mobile/app/session/detail.tsx
- FOUND: apps/mobile/app/(tabs)/_layout.tsx (modified)
- FOUND commit a9d422d (History ledger + DayRow)
- FOUND commit 7bc8844 (session/detail.tsx)
- FOUND commit ee84f3a (4-tab restructure)
