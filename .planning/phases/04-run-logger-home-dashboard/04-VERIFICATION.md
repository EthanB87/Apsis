---
phase: 04-run-logger-home-dashboard
verified: 2026-07-10T23:15:00Z
status: gaps_found
score: 3/5 must-haves verified
behavior_unverified: 0
overrides_applied: 0
gaps:
  - truth: "Home screen shows a 28-day ATL/CTL/TSB trend chart (with the D-19/D-20 scrub tooltip that is the chart's headline interaction)."
    status: failed
    reason: >
      Confirmed by direct code read (independent of 04-REVIEW.md's CR-01 finding, which this
      verification reproduces from source): TrendChart.tsx's `tooltipText` is a
      `useDerivedValue` worklet (marked `'worklet'`, line 101) that calls `formatSignedTsb`
      (lines 71-74) at line 106 — `formatSignedTsb` is an ordinary module-scope function with
      no `'worklet'` directive. Per the installed `react-native-worklets` runtime, calling a
      captured non-worklet host function from a UI-thread worklet throws
      "Tried to synchronously call a non-worklet function on the UI thread." `matchedIndex`
      initializes to -1 so this path is not hit at mount, but fires on the very first
      touch/scrub of the chart (`isActive` becomes true, `state.matchedIndex.value >= 0`).
      This is not a cosmetic bug — scrubbing the 28-day chart is the specific interaction
      HOME-03's must-have and 04-07-PLAN.md's must_haves.truths both call out by name
      ("a scrub tooltip snapping to the nearest day"), and it crashes on first use.
    artifacts:
      - path: apps/mobile/components/home/TrendChart.tsx
        issue: "formatSignedTsb (module-scope, no 'worklet' directive) is called from inside the tooltipText useDerivedValue worklet — throws on the chart's first scrub/press."
    missing:
      - "Add the 'worklet' directive to formatSignedTsb (or inline its sign-formatting logic directly inside the tooltipText worklet body) so no non-worklet function is captured/called from the UI thread."
  - truth: "Home screen shows today's readiness band and today's total HSS prominently, reflecting reality (not stale/deleted data)."
    status: failed
    reason: >
      Confirmed by direct code read (independent of 04-REVIEW.md's CR-02 finding, which this
      verification reproduces from source): recomputeLoadDaily.ts is upsert-only. When the
      last finished, non-deleted workout is discarded, `rows.length === 0` triggers an early
      `return` (line 35-37) with load_daily completely untouched — still holding the deleted
      session's dayHss/atl/ctl/tsb/readinessBand. apps/mobile/app/(tabs)/index.tsx's loadHome
      reads today's load_daily row directly by localDate (line 259) with no additional
      filtering, so an athlete who logs their first session and then deletes it keeps seeing
      that deleted session's HSS and readiness band on TODAY. This directly contradicts
      finishWorkout.ts's own doc comment on discardWorkout ("the discarded session then never
      appears in history or any HSS/load computation") and the phase's D-28/D-29 contract.
      A secondary leak (range-shrink: deleting the earliest session re-anchors firstDate
      without clearing rows before the new range) also persists stale rows that feed
      last28DaysTrend and historyDays.
    artifacts:
      - path: apps/mobile/lib/recomputeLoadDaily.ts
        issue: "No DELETE ever runs against load_daily — the empty-input early return (line 35-37) and the lack of a notInArray cleanup after the upsert loop both leave stale rows in place after a session is deleted."
    missing:
      - "When rows.length === 0, DELETE FROM load_daily instead of returning early."
      - "After computing upsertRows, DELETE every load_daily row whose localDate is not in the new upsert output (e.g. `database.delete(loadDaily).where(notInArray(loadDaily.localDate, keep))`), ideally inside one transaction with the upserts."
deferred: []
---

# Phase 4: Run Logger + Home Dashboard Verification Report

**Phase Goal:** A user logs a run/conditioning session in under a minute and sees a live
readiness band + 28-day trend on the home screen that reflects both lifting and running.
**Verified:** 2026-07-10T23:15:00Z
**Status:** gaps_found
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | User picks activity type, enters distance + duration with live pace, optional HR/note, editable date defaulting to today | ✓ VERIFIED | `apps/mobile/app/(tabs)/log/run.tsx` renders the segmented RUN/ERG/CONDITIONING control, DISTANCE (hidden for CONDITIONING), the `parseDurationDigits`-driven DURATION hero field, optional AVG HR, a live pace readout derived per activity type, a TODAY date row with `@react-native-community/datetimepicker` (`maximumDate={new Date()}`), and an optional note field wired to `saveRun`. Non-blocking warning: WR-05 (iOS date picker never closes after opening) and WR-08 (pace can render "X:60" on rare fractional-second inputs) remain unfixed but do not prevent logging. |
| 2 | Session HSS shown on the run finish screen immediately after saving | ✓ VERIFIED | `apps/mobile/app/session/finish.tsx` branches on `workout.type === 'endurance'`, queries `endurance_segment`, computes HSS via `sessionHSSDetailed`, and renders it in the shared 84px `HssRing` (animate=true). `saveRun` (`apps/mobile/lib/runEntry.ts`) writes `workout.hss` and returns the new `workoutId`, which `run.tsx` passes via `router.push({ pathname: '/session/finish', params: { workoutId } })`. |
| 3 | Home screen shows today's readiness band and today's total HSS prominently, above the fold | ✗ FAILED | Structurally present and correctly ordered above the fold (`apps/mobile/app/(tabs)/index.tsx`: greeting → 200px `HssRing` → `ReadinessLight` → `StatTiles` → `TrendChart`), and reads live from `load_daily` via `useFocusEffect` (no bare `useEffect`). **But** the underlying data is not honest after a delete: `recomputeLoadDaily` never removes stale `load_daily` rows (see gap below), so deleting the only session of a day leaves that session's HSS/band rendering on TODAY as if it still existed — the number and band shown are not always real. |
| 4 | 28-day ATL/CTL/TSB trend chart, with a "Building trend…" calibrating state before 14+ days of data | ✗ FAILED | `TrendChart.tsx` + `index.tsx`'s `chartCalibratingDayN` logic correctly render the calibrating caption and only real days when `historyDays < 14` (HOME-04 present and wired). **But** the chart's scrub tooltip — the interaction HOME-03/D-19/D-20 explicitly call for — throws a runtime exception on the very first scrub because `tooltipText`'s worklet calls a non-worklet function (`formatSignedTsb`). Confirmed by direct source inspection, not merely suspected. |
| 5 | User can view workout history grouped by day showing day HSS + session count, with the double-session penalty explicitly labeled when sessionCount > 1 | ✓ VERIFIED | `apps/mobile/app/(tabs)/history/index.tsx` + `components/history/DayRow.tsx`: month-grouped `SectionList`, REST rows, an amber "N SESSIONS · ADJUSTED" chip and a "DAY TOTAL X · INCL. +Y DOUBLE-DAY LOAD" line (Y computed via `@apsis/engine`'s `dailyHSS`, never hand-rolled) on expand, swipe-to-delete with a confirm dialog calling `discardWorkout`. Non-blocking warning: WR-07 (History shows "No sessions yet" when `load_daily` is empty even if finished sessions exist) is a narrow edge case given 04-03's recompute wiring fires on every terminal write going forward. |

**Score:** 3/5 truths verified (0 present-but-behavior-unverified)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `packages/db/src/loadDaily.ts` (`computeLoadDailyUpsertRows`) | Pure gap-fill + double-session-penalty builder | ✓ VERIFIED | Present, tested (27 db tests pass incl. gap-fill/double-penalty/first-date-anchoring/empty-input cases), composes `@apsis/engine`'s `dailyHSS`/`computeLoadTrendSeries`. |
| `packages/db/src/queries.ts` (`last28DaysTrend`, `sessionCountsByDate`, `dayGroupedSessions`) | Parameterized history/trend builders | ✓ VERIFIED | Present and used by `index.tsx`/`history/index.tsx`; test suite covers filter/order/limit behavior. |
| `packages/shared/src/duration.ts` (`parseDurationDigits`) | Smart h:mm:ss digit entry | ✓ VERIFIED | Present, tested (17 shared tests pass), wired into `run.tsx`'s DURATION field. |
| `packages/db/drizzle/0002_*.sql` (`workout.note` migration) | Committed migration adding `note` column | ✓ VERIFIED | Migration exists; `workout.note` used end-to-end (`runEntry.ts` writes it, `run.tsx` collects it). |
| `apps/mobile/lib/recomputeLoadDaily.ts` | Full-history recompute pipeline | ⚠️ STUB-LIKE GAP | Exists, wired into `finishWorkout`/`discardWorkout`/`saveRun` (present + wired), but its core behavior — "a discarded session never appears in any HSS/load computation" — is violated on the empty-result and range-shrink paths (CR-02, reproduced above). Presence/wiring is not sufficient; the invariant the function exists to guarantee does not hold. |
| `apps/mobile/components/home/HssRing.tsx`, `PlateOrbit.tsx`, `ReadinessLight.tsx`, `StatTiles.tsx` | Presentational home components | ✓ VERIFIED | All four exist, are props-driven, honor the palette/typography rules (capped fill, calibrating variant, PRIMED/CAUTION/OVERREACHING copy, bone stat numbers with sign-prefixed TSB). |
| `apps/mobile/components/home/TrendChart.tsx` | 28-day scrub chart | ⚠️ WIRED BUT BROKEN ON INTERACTION | Renders correctly at rest (lines + calibrating caption); the scrub gesture — its signature interactive feature — crashes (CR-01, reproduced above). |
| `apps/mobile/app/(tabs)/log/run.tsx`, `lib/runEntry.ts` | Run/erg/conditioning entry + save | ✓ VERIFIED | Present, wired to `saveRun` → `resolveRunSegment`/`resolveIF` (pace gated to `run` only per Pitfall 6) → `sessionHSSDetailed` → `recomputeLoadDaily`. |
| `apps/mobile/app/session/finish.tsx` (endurance branch + mini-ring + TODAY routing) | Retrofit finish screen | ✓ VERIFIED | Branches on `workout.type`, computes endurance HSS from `endurance_segment`, renders 84px `HssRing`, `handleDone`/`handleConfirmDiscard` both route to `/(tabs)` (TODAY). |
| `apps/mobile/app/(tabs)/history/index.tsx`, `components/history/DayRow.tsx`, `apps/mobile/app/session/detail.tsx`, `apps/mobile/app/(tabs)/_layout.tsx` | History tab + session detail + 4-tab bar | ✓ VERIFIED | 4-tab bar confirmed (`index`→TODAY, `log`, `history`, `settings`); History and session detail both re-derive from SQLite and branch strength/endurance correctly. |
| `apps/mobile/package.json` (native deps) | victory-native, Skia (exact 2.6.9), react-native-svg, datetimepicker | ✓ VERIFIED | Skia pinned exactly `2.6.9`; other three deps present at expo-resolved versions. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `run.tsx` | `runEntry.saveRun` | `saveRun(db, input)` on Save | ✓ WIRED | Confirmed in code. |
| `saveRun` | `recomputeLoadDaily` | `await recomputeLoadDaily(database)` after write | ✓ WIRED | Confirmed; also wired from `finishWorkout`/`discardWorkout`. |
| `recomputeLoadDaily` | `@apsis/db computeLoadDailyUpsertRows` | pure fold, upserted per-row | ✓ WIRED (but incomplete — see gap) | Upsert path wired; delete/cleanup path missing. |
| `TrendChart` | `@apsis/db last28DaysTrend` (via `index.tsx`) | persisted rows passed as `data` prop | ✓ WIRED | Confirmed; chart never re-derives EWMA. |
| `HssRing` (84px) | `finish.tsx` | shared component reused at both sizes | ✓ WIRED | Confirmed. |
| `DayRow` double-day math | `@apsis/engine dailyHSS` | `dailyHSS(scores) - sum(scores)` | ✓ WIRED | Confirmed, not hand-rolled. |
| Swipe-delete (`DayRow`) | `discardWorkout` | `onRequestDeleteSession` → confirm modal → `discardWorkout(db, id, new Date())` | ✓ WIRED | Confirmed in `history/index.tsx`. |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| `packages/db` test suite passes | `pnpm --filter @apsis/db test -- --run` | 6 files / 27 tests passed | ✓ PASS |
| `packages/shared` test suite passes | `pnpm --filter @apsis/shared test -- --run` | 2 files / 17 tests passed | ✓ PASS |
| `apps/mobile` test suite passes | `npx vitest run` (in apps/mobile) | 1 file / 9 tests passed | ✓ PASS |
| `apps/mobile` typechecks with only the two documented pre-existing errors | `npx tsc --noEmit` | Only `app/onboarding/review.tsx` + `components/ExternalLink.tsx` typed-route errors (both pre-existing, documented in Phase 03 deferred-items) | ✓ PASS |
| TrendChart scrub tooltip does not call a non-worklet function from a worklet | source inspection of `TrendChart.tsx:71-74,100-107` | `formatSignedTsb` (no `'worklet'` directive) is called inside `tooltipText`'s `useDerivedValue` worklet body | ✗ FAIL (reproduces 04-REVIEW.md CR-01) |
| `recomputeLoadDaily` removes stale `load_daily` rows when the last session is deleted | source inspection of `recomputeLoadDaily.ts:35-37` + `discardWorkout` call chain | Empty-result early return performs no delete; no `notInArray` cleanup exists anywhere in the function | ✗ FAIL (reproduces 04-REVIEW.md CR-02) |

None of these are unit-testable on-device runtime crashes (no vitest coverage exists or could exist for a Reanimated worklet boundary violation or an op-sqlite live-app delete-then-render sequence) — both were confirmed via direct source tracing against the actual mechanism the code review already identified, not merely re-asserted from the review text.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|--------------|--------|----------|
| RUN-01 | 04-05 | Log a session with an activity type | ✓ SATISFIED | `run.tsx` segmented control |
| RUN-02 | 04-01, 04-05 | Distance + duration, live pace | ✓ SATISFIED | `parseDurationDigits`, live pace readout |
| RUN-03 | 04-05 | Optional average HR | ✓ SATISFIED | AVG HR field |
| RUN-04 | 04-02, 04-05 | Date defaults to today, editable | ✓ SATISFIED | date row + datetimepicker, `maximumDate` |
| RUN-05 | 04-01, 04-05 | Optional free-text note | ✓ SATISFIED | note field → `workout.note` |
| RUN-06 | 04-06 | Session HSS on finish screen | ✓ SATISFIED | endurance branch + mini-ring |
| HOME-01 | 04-03, 04-04, 04-07 | Readiness band above the fold | ⚠️ BLOCKED (data-integrity gap) | Structurally present; can show stale/deleted-session data (CR-02) |
| HOME-02 | 04-03, 04-04, 04-07 | Today's total HSS | ⚠️ BLOCKED (data-integrity gap) | Same CR-02 gap — today's dayHss can be a ghost value |
| HOME-03 | 04-01, 04-02, 04-07 | 28-day ATL/CTL/TSB trend chart | ⚠️ BLOCKED (crash on scrub) | Chart renders; scrub interaction crashes (CR-01) |
| HOME-04 | 04-07 | Calibrating state before 14 days | ✓ SATISFIED | `chartCalibratingDayN` + `HssRing` calibrating variant |
| HOME-05 | 04-01, 04-08 | Day-grouped history + session count | ✓ SATISFIED | `history/index.tsx` + `DayRow` |
| HOME-06 | 04-01, 04-08 | Double-session penalty labeled | ✓ SATISFIED | ADJUSTED chip + DAY TOTAL/DOUBLE-DAY LOAD line |

**Discrepancy note:** `.planning/REQUIREMENTS.md`'s traceability table currently marks HOME-01/02/03 "Complete." This verification found reachable, confirmed defects (not stylistic nits) that break the honesty/functionality those requirements demand. Recommend the requirements table be revisited once the two gaps below are closed — do not treat REQUIREMENTS.md's current checkmarks as independent evidence; they were not re-verified against the code for this report.

No orphaned requirements: all 12 IDs (RUN-01..06, HOME-01..06) are declared across the 8 plans and match REQUIREMENTS.md's Phase 4 mapping exactly.

### Anti-Patterns Found

Carried forward from `04-REVIEW.md` (independently reproduced for the two CRITICAL items above; the remaining 9 WARNING + 7 INFO items were spot-checked for continued presence but are not phase-blocking per the review's own severity classification):

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `apps/mobile/components/home/TrendChart.tsx` | 71-74, 100-107 | Non-worklet function called from a worklet | 🛑 Blocker | Crashes on first chart scrub (CR-01) |
| `apps/mobile/lib/recomputeLoadDaily.ts` | 35-37 | Upsert-only recompute, no stale-row cleanup | 🛑 Blocker | Deleted-session ghost data persists on TODAY/History/trend (CR-02) |
| `apps/mobile/app/(tabs)/log/run.tsx` | 168-171, 282-296 | iOS date picker never closes | ⚠️ Warning | Picker stays mounted after first open (WR-05) |
| `packages/shared/src/units.ts` | 67-71 | `formatPaceMinSec` seconds round to 60 without carry | ⚠️ Warning | Rare fractional-second inputs render "X:60" (WR-08) |
| `apps/mobile/app/(tabs)/history/index.tsx` | 106-110 | Empty `load_daily` short-circuits to "No sessions yet" | ⚠️ Warning | Ignores `sessions`/`counts` already fetched in the same call (WR-07) |
| (7 additional WARNING/INFO items) | — | — | ⚠️/ℹ️ | See `04-REVIEW.md` for the full list (stale-readiness-after-rest-days, missing write transactions, swipe-to-refresh copy mismatch, silent error swallowing, duplicated formatters, warmup-count inconsistency, unused import, IF-warning surfacing gap, label font-weight mismatch, `useColorScheme` null-crash, unclamped tooltip translateX) |

No unresolved `TBD`/`FIXME`/`XXX` debt markers were found in the Phase 4 file set.

### Human Verification Required

Not populated in frontmatter (status is `gaps_found`, not `human_needed` — the two blocking items above were confirmed programmatically via source tracing, not left uncertain). Once CR-01/CR-02 are fixed, the following on-device checks (deferred by the plans' own `<verification>` sections to the phase UAT gate) still need human confirmation before shipping:

1. **Ring count-up + capped-fill animation** — Trigger: finish a run/lift with HSS > 200 and one with HSS < 200. Expected: ring number always shows the exact rounded HSS; the volt arc visually caps at a full circle only when HSS ≥ 200. Why human: animation timing/visual correctness isn't observable from source.
2. **Scrub tooltip snapping + clamping** — Trigger: once CR-01 is fixed, drag across the 28-day chart. Expected: hairline cursor + tooltip snap to the nearest day and stay on-card at both edges (IN-07 unclamped translateX is a separate, non-blocking follow-up). Why human: gesture/visual behavior.
3. **Calibrating hero (<14 days)** — Trigger: fresh install, log fewer than 14 days of sessions. Expected: steel ring + PlateOrbit + "BUILDING TREND · DAY N/14", ReadinessLight absent, chart shows only real days. Why human: visual composition across multiple components.
4. **Double-session day math** — Trigger: log two sessions on the same day. Expected: History's "N SESSIONS · ADJUSTED" chip and "DAY TOTAL X · INCL. +Y DOUBLE-DAY LOAD" line show the correct, engine-derived Y. Why human: needs a real multi-session day to eyeball the exact numbers end-to-end.
5. **Delete-then-view regression check (post-fix)** — Trigger: after CR-02 is fixed, log a session, confirm it appears on TODAY, delete it via History swipe, return to TODAY. Expected: ring shows 0 / empty state, no stale band. Why human: the current behavior is confirmed broken from source; the fix needs an on-device regression pass, not just a second source read.

### Gaps Summary

Six of eight plans (04-01, 04-02, 04-05, 04-06, 04-08, and the presentational half of 04-04) deliver exactly what they claim, with passing unit-test suites (db 27, shared 17, mobile 9) and clean typechecks (only the two documented pre-existing errors). The run-entry form, finish-screen retrofit, and History tab are all genuinely wired end to end and match their PLAN.md must-haves.

However, two of the phase's five roadmap success criteria are broken by confirmed, reachable defects that this verification reproduced directly from source (not merely inherited from `04-REVIEW.md`'s narrative):

1. **The 28-day trend chart's scrub tooltip crashes on first touch** (`TrendChart.tsx`) — the chart's headline interaction (D-19/D-20, explicitly named in HOME-03's must-have) is unusable.
2. **Deleting a session does not remove its load from `load_daily`** (`recomputeLoadDaily.ts`) — the TODAY dashboard's readiness band and HSS number can show data for a session the athlete just deleted, directly contradicting the app's own "discarded sessions never appear in any HSS/load computation" invariant (D-28/D-29) and undermining the phase's core "sees a live readiness band... that reflects reality" promise.

Both fixes are small and scoped (a `'worklet'` directive; a delete-cleanup step in one function) and were already correctly diagnosed with working patches in `04-REVIEW.md`'s CR-01/CR-02. Recommend routing this phase to `/gsd-plan-phase --gaps` to apply those two fixes (and, time permitting, WR-05/WR-07/WR-08 which touch the same success criteria at lower severity) before considering Phase 4 complete.

---

_Verified: 2026-07-10T23:15:00Z_
_Verifier: Claude (gsd-verifier)_
