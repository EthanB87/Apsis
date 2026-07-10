---
phase: 04-run-logger-home-dashboard
verified: 2026-07-10T23:45:00Z
status: human_needed
score: 3/5 must-haves verified
behavior_unverified: 2
overrides_applied: 0
re_verification:
  previous_status: gaps_found
  previous_score: 3/5
  gaps_closed:
    - "Home screen shows today's readiness band and today's total HSS prominently, reflecting reality (not stale/deleted data) — CR-02 source-level fix confirmed: recomputeLoadDaily.ts now issues database.delete(loadDaily) on the empty-result path and a parameterized notInArray(loadDaily.localDate, keep) cleanup on every recompute. Moves from FAILED to PRESENT_BEHAVIOR_UNVERIFIED (fix is correct and wired; the delete-then-render sequence itself is not exercised by any automated test)."
    - "Home screen shows a 28-day ATL/CTL/TSB trend chart (with the D-19/D-20 scrub tooltip) — CR-01 source-level fix confirmed: TrendChart.tsx's formatSignedTsb now carries the 'worklet' directive as its first statement, so tooltipText's useDerivedValue no longer calls a non-worklet host function on the UI thread. Moves from FAILED to PRESENT_BEHAVIOR_UNVERIFIED (fix is correct; the actual UI-thread scrub gesture is not exercised by any automated test)."
  gaps_remaining: []
  regressions: []
behavior_unverified_items:
  - truth: "Deleting a session removes its load from load_daily so TODAY never shows a ghost HSS/readiness band (CR-02, D-29)."
    test: "Log a session (appears on TODAY), delete it via History swipe-to-delete, return to TODAY. Separately: with sessions across several days, delete the earliest one."
    expected: "After deleting the only session of a day: TODAY shows the empty/0 readiness state, not the deleted session's HSS/band. After deleting the earliest session: the 28-day trend and History no longer show a stale value for that removed day."
    why_human: "recomputeLoadDaily opens a real op-sqlite JSI connection; the apps/mobile vitest harness is scoped to lib/** pure modules and must never import @apsis/db (would open a native SQLite connection at import/collection time). The delete-then-render sequence is a cleanup/ordering invariant that only a live on-device (or simulator) pass can exercise. Source-level fix is confirmed correct (delete(loadDaily) on empty-input path; notInArray range-shrink cleanup import and call both present) and packages/db's 27-test suite still passes, but no test drives the actual op-sqlite DELETE + re-render sequence."
  - truth: "Scrubbing the 28-day trend chart does not crash and renders the snapped tooltip (CR-01, HOME-03/D-19/D-20)."
    test: "Drag across the 28-day trend chart on-device (or in a dev-build/simulator with New Architecture + Reanimated running)."
    expected: "The hairline cursor and tooltip appear, snap to the nearest day, and render the signed TSB form (e.g. 'JUL 8 · HSS 142 · ATL 41 · CTL 55 · TSB +14') without a red-screen crash."
    why_human: "The original crash was a Reanimated UI-thread worklet exception ('Tried to synchronously call a non-worklet function on the UI thread') that only reproduces when the actual chart-press gesture runs on the UI runtime — tsc and vitest cannot execute that runtime. Source-level fix is confirmed correct (formatSignedTsb's function body now begins with the 'worklet'; directive, matching the plan's acceptance criteria byte-for-byte), and apps/mobile typechecks clean, but no automated test exercises the gesture itself."
---

# Phase 4: Run Logger + Home Dashboard Verification Report

**Phase Goal:** A user logs a run/conditioning session in under a minute and sees a live
readiness band + 28-day trend on the home screen that reflects both lifting and running.
**Verified:** 2026-07-10T23:45:00Z
**Status:** human_needed
**Re-verification:** Yes — after gap closure (plans 04-09, 04-10)

## Goal Achievement

This is a re-verification following gap-closure plans 04-09 (CR-01 TrendChart worklet fix,
CR-02 recomputeLoadDaily stale-row deletion) and 04-10 (WR-05 iOS date picker dismissal, WR-07
History empty-state fallback, WR-08 formatPaceMinSec rounding). Both blocking gaps from the
prior 04-VERIFICATION.md were independently re-traced from source in this pass (not accepted
from SUMMARY.md claims) — the fixes are real, correctly targeted, and match their plans'
acceptance criteria exactly. However, both fixed truths assert a runtime state/cleanup
invariant (a UI-thread worklet not throwing; a DELETE actually removing rows before the next
render) that no automated test in this repo exercises, so per the behavior-dependent-truth
rule they are classified PRESENT_BEHAVIOR_UNVERIFIED rather than VERIFIED, and routed to human
verification rather than closed silently.

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | User picks activity type, enters distance + duration with live pace, optional HR/note, editable date defaulting to today | ✓ VERIFIED | `apps/mobile/app/(tabs)/log/run.tsx` unchanged in structure from the prior pass; additionally, WR-05 is now closed — `handleDateChange` (lines 168-179) calls `setShowDatePicker(false)` on iOS when `event.type === 'set'` (a committed selection) and on Android unconditionally (dialog self-dismisses); the date row `onPress` (line 290) now toggles via `setShowDatePicker((open) => !open)` rather than force-opening. `maximumDate={new Date()}` still present (line 300). |
| 2 | Session HSS shown on the run finish screen immediately after saving | ✓ VERIFIED | `apps/mobile/app/session/finish.tsx` untouched by 04-09/04-10; re-confirmed unchanged (endurance branch + 84px `HssRing` + `saveRun`/`workoutId` routing chain intact). |
| 3 | Home screen shows today's readiness band and today's total HSS prominently, reflecting reality (not stale/deleted data) | ⚠️ PRESENT_BEHAVIOR_UNVERIFIED | `apps/mobile/lib/recomputeLoadDaily.ts` (source-read line by line): the empty-result path (lines 42-47) now runs `await database.delete(loadDaily); return;` instead of a bare early return; a range-shrink cleanup (lines 52-57) computes `keep = upsertRows.map(r => r.localDate)` and runs `await database.delete(loadDaily).where(notInArray(loadDaily.localDate, keep))` before the upsert loop, using the newly-imported `notInArray` from `drizzle-orm` (line 25). This is exactly the CR-02 fix the gap called for. But no automated test drives a real delete-then-recompute-then-render sequence against a live op-sqlite connection (the file's own docstring and 04-09-SUMMARY.md both note this is out of scope for the lib-only vitest harness) — the invariant is present and wired, not behaviorally proven, so it routes to human verification below. |
| 4 | 28-day ATL/CTL/TSB trend chart, with a "Building trend…" calibrating state before 14+ days of data | ⚠️ PRESENT_BEHAVIOR_UNVERIFIED | `apps/mobile/components/home/TrendChart.tsx` (source-read): `formatSignedTsb` (lines 71-75) now begins with `'worklet';` as its first statement, matching the CR-01 fix's acceptance criteria exactly (sign-formatting logic and return format byte-identical to the pre-fix helper). `tooltipText`'s `useDerivedValue` (lines 101-108) calls only `Math.round`, `Math.abs`, template literals, and this now-worklet-directed helper — no remaining non-worklet host-function call. The calibrating-state logic (`calibratingDayN`/`calibratingCaption`, unaffected by this plan) remains correct. But no test exercises the actual UI-thread scrub gesture that previously threw; the fix is present and wired, not behaviorally proven on-device. |
| 5 | User can view workout history grouped by day showing day HSS + session count, with the double-session penalty explicitly labeled when sessionCount > 1 | ✓ VERIFIED | `apps/mobile/app/(tabs)/history/index.tsx`: WR-07 is now closed — the empty-state guard (line 106) requires `dailyRows.length === 0 && sessions.length === 0` (previously bailed on `dailyRows.length === 0` alone, discarding already-fetched sessions); `knownDates` (line 124) unions `dayHssByDate.keys()` and `sessionsByDate.keys()` so a session with no `load_daily` row yet still renders (with `dayHss` defaulting to 0 via the existing `?? 0`, line 143). This is a deterministic conditional branch traceable directly from source (not a runtime worklet/native-module boundary), so it is verified by direct code inspection rather than routed to human-only verification. `DayRow.tsx`'s ADJUSTED chip / DAY TOTAL math is unchanged from the prior pass. |

**Score:** 3/5 truths verified (2 present, behavior-unverified)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `apps/mobile/lib/recomputeLoadDaily.ts` | Delete-aware full-history recompute pipeline | ✓ VERIFIED (present + wired; behavior not test-exercised) | `notInArray` imported (line 25); empty-input full clear (line 45); range-shrink `notInArray` cleanup (line 57) runs before the unchanged per-row literal-value upsert loop. `packages/db` 27-test suite (the pure `computeLoadDailyUpsertRows` builder this wraps) still passes unchanged. |
| `apps/mobile/components/home/TrendChart.tsx` | 28-day scrub chart with a worklet-safe tooltip | ✓ VERIFIED (present + wired; behavior not test-exercised) | `formatSignedTsb` carries `'worklet';` as its first statement (line 72); call site inside `tooltipText`'s `useDerivedValue` (line 107) unchanged in signature/output format. |
| `apps/mobile/app/(tabs)/log/run.tsx` | Run/erg/conditioning entry with a dismissable iOS date picker | ✓ VERIFIED | `handleDateChange` closes the iOS picker on `event.type === 'set'`; date row toggles rather than force-opens; `maximumDate={new Date()}` retained. |
| `apps/mobile/app/(tabs)/history/index.tsx` | History tab honest about sessions before `load_daily` recomputes | ✓ VERIFIED | Empty-state guard requires both `dailyRows` and `sessions` empty; day-entry dates union both maps. |
| `packages/shared/src/units.ts` (`formatPaceMinSec`) | Carry-correct M:SS pace formatter | ✓ VERIFIED | Rounds total seconds once (`Math.round(totalSec)`) before deriving minutes/seconds — no independent `Math.round(totalSec % 60)`. Confirmed by direct computation: `formatPaceMinSec(359.7) === "6:00"`, `formatPaceMinSec(59.6) === "1:00"`, `formatPaceMinSec(270) === "4:30"`, `formatPaceMinSec(0) === "0:00"`. |
| `packages/shared/src/__tests__/units.test.ts` | New `formatPaceMinSec` carry-case tests | ✓ VERIFIED | 4 new tests added under `describe('formatPaceMinSec seconds carry (WR-08)')`, all passing. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `recomputeLoadDaily` empty-input path | `load_daily` table | `database.delete(loadDaily)` | ✓ WIRED | Confirmed at line 45; replaces the prior bare early return. |
| `recomputeLoadDaily` range-shrink path | `load_daily` table | `database.delete(loadDaily).where(notInArray(loadDaily.localDate, keep))` | ✓ WIRED | Confirmed at line 57; `keep` derived from `upsertRows.map(r => r.localDate)` at line 56. |
| `TrendChart.tooltipText` (`useDerivedValue` worklet) | `formatSignedTsb` | direct call inside the worklet body | ✓ WIRED (no non-worklet call) | `formatSignedTsb` now itself carries `'worklet'` — the call no longer crosses the UI-thread/JS-thread boundary via a non-worklet capture. |
| `run.tsx` date row `onPress` | `showDatePicker` state | functional toggle updater | ✓ WIRED | `setShowDatePicker((open) => !open)` confirmed at line 290. |
| `history/index.tsx` `loadHistory` | `HistoryDayEntry[]` render list | union of `dayHssByDate`/`sessionsByDate` keys | ✓ WIRED | Confirmed at lines 106-146; sessions are no longer discarded when `load_daily` is empty. |

### Data-Flow Trace (Level 4)

Not re-run in full for this pass — the data sources for the affected artifacts (`load_daily` via
`db.select().from(loadDaily)`, `dayGroupedSessions`, `sessionCountsByDate`) are unchanged from
the prior verification pass, which confirmed real DB queries (not static returns) feed all four
home/history artifacts. The only change verified here is the *cleanup* path (deletes), which by
definition removes rows rather than fabricating them — no new hollow/static-data risk introduced.

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| `packages/db` test suite passes | `pnpm --filter @apsis/db test -- --run` | 6 files / 27 tests passed | ✓ PASS |
| `packages/shared` test suite passes (incl. new WR-08 cases) | `pnpm --filter @apsis/shared test -- --run` | 2 files / 21 tests passed (was 17; +4 new `formatPaceMinSec` carry tests) | ✓ PASS |
| `apps/mobile` lib test suite passes | `npx vitest run` (in apps/mobile) | 1 file / 9 tests passed | ✓ PASS |
| `apps/mobile` typechecks with only the two documented pre-existing errors | `npx tsc --noEmit` | Only `app/onboarding/review.tsx` + `components/ExternalLink.tsx` typed-route errors (both pre-existing) | ✓ PASS |
| `formatPaceMinSec` carry behavior (direct computation, matches unit tests) | manual Node eval of the exact algorithm | `270→"4:30"`, `359.7→"6:00"`, `59.6→"1:00"`, `0→"0:00"` | ✓ PASS |
| `formatSignedTsb` carries `'worklet'` directive as its first statement | source inspection `TrendChart.tsx:71-75` | Confirmed present | ✓ PASS (presence; runtime not exercised — see behavior_unverified_items) |
| `recomputeLoadDaily` issues DELETE on empty-input and range-shrink paths | source inspection `recomputeLoadDaily.ts:42-57` | Confirmed present, `notInArray` imported and used with a parameterized keep-list (no raw SQL interpolation) | ✓ PASS (presence; runtime not exercised — see behavior_unverified_items) |
| All 6 gap-closure commit hashes exist in git history | `git log --oneline \| grep <hashes>` | `cdc1ef5`, `b64f90f`, `6c13d58`, `7d4b339`, `f105aaa`, `2e8625b` all present | ✓ PASS |
| No debt markers (`TBD`/`FIXME`/`XXX`/`TODO`/`HACK`/`PLACEHOLDER`) in the 6 files touched by 04-09/04-10 | grep across each modified file | None found | ✓ PASS |

Step 7c (Probe Execution): SKIPPED — no `scripts/*/tests/probe-*.sh` files exist in this repo and
neither the phase plans nor success criteria reference probe scripts; this is a mobile app phase,
not a migration/tooling phase.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|--------------|--------|----------|
| RUN-01 | 04-05 | Log a session with an activity type | ✓ SATISFIED | Unchanged from prior pass. |
| RUN-02 | 04-01, 04-05, 04-10 | Distance + duration, live pace (never "X:60") | ✓ SATISFIED | `formatPaceMinSec` carry fix confirmed + unit-tested. |
| RUN-03 | 04-05 | Optional average HR | ✓ SATISFIED | Unchanged from prior pass. |
| RUN-04 | 04-02, 04-05, 04-10 | Date defaults to today, editable, dismissable picker | ✓ SATISFIED | WR-05 fix confirmed at source level; on-device toggle behavior listed as a nice-to-have human check below. |
| RUN-05 | 04-01, 04-05 | Optional free-text note | ✓ SATISFIED | Unchanged from prior pass. |
| RUN-06 | 04-06 | Session HSS on finish screen | ✓ SATISFIED | Unchanged from prior pass. |
| HOME-01 | 04-03, 04-04, 04-07, 04-09 | Readiness band above the fold, reflecting reality | ⚠️ PRESENT, BEHAVIOR UNVERIFIED | CR-02 delete-cleanup fix confirmed at source level; on-device delete-then-view regression pass still required (see behavior_unverified_items). |
| HOME-02 | 04-03, 04-04, 04-07, 04-09 | Today's total HSS | ⚠️ PRESENT, BEHAVIOR UNVERIFIED | Same CR-02 fix/gap as HOME-01. |
| HOME-03 | 04-01, 04-02, 04-07, 04-09 | 28-day ATL/CTL/TSB trend chart with scrub tooltip | ⚠️ PRESENT, BEHAVIOR UNVERIFIED | CR-01 worklet-directive fix confirmed at source level; on-device scrub-gesture pass still required. |
| HOME-04 | 04-07 | Calibrating state before 14 days | ✓ SATISFIED | Unchanged from prior pass. |
| HOME-05 | 04-01, 04-08, 04-10 | Day-grouped history + session count, honest before recompute | ✓ SATISFIED | WR-07 fix confirmed at source level (deterministic branch, not a runtime invariant needing on-device proof). |
| HOME-06 | 04-01, 04-08 | Double-session penalty labeled | ✓ SATISFIED | Unchanged from prior pass. |

No orphaned requirements: all 12 IDs (RUN-01..06, HOME-01..06) are declared across the 10 plans
(04-01 through 04-10) and match REQUIREMENTS.md's Phase 4 mapping exactly. REQUIREMENTS.md
currently marks all 12 "Complete" — this verification agrees for 9 of the 12 (RUN-01..06,
HOME-04/05/06) but recommends HOME-01/02/03 stay flagged pending the on-device pass below before
being treated as fully closed for ship purposes; this is a process recommendation, not a
contradiction requiring a code change.

### Anti-Patterns Found

No new blocker or warning-level anti-patterns introduced by 04-09/04-10. Re-scanned all 6 files
modified by the two gap-closure plans (`TrendChart.tsx`, `recomputeLoadDaily.ts`, `run.tsx`,
`history/index.tsx`, `units.ts`, `units.test.ts`) for `TBD`/`FIXME`/`XXX`/`TODO`/`HACK`/
`PLACEHOLDER` — none found. The remaining lower-severity items from `04-REVIEW.md` (stale-
readiness-after-rest-days, missing write transactions, swipe-to-refresh copy mismatch, silent
error swallowing, duplicated formatters, warmup-count inconsistency, unused import, IF-warning
surfacing gap, label font-weight mismatch, `useColorScheme` null-crash, unclamped tooltip
`translateX`) were not re-scanned in this pass — they were already classified non-blocking
WARNING/INFO in the prior review and are outside the scope of what 04-09/04-10 touched.

One intentional deviation is worth flagging for visibility (not a gap): `recomputeLoadDaily`'s
cleanup DELETE and upsert loop are NOT wrapped in a single `database.transaction(...)` call, as
04-09-PLAN.md's primary preference specified. The plan explicitly permitted this fallback
("If the op-sqlite/drizzle transaction API surface is uncertain at implementation time, keep the
sequential form"), and 04-09-SUMMARY.md documents the concrete reason (`op-sqlite`'s
`session.transaction()` returns `T` synchronously, incompatible with this function's `await`-based
upsert loop). This narrows but does not eliminate the read/write window between the cleanup
DELETE and the upsert loop completing — a read that lands in that window could see a transiently
empty-of-stale-rows-but-not-yet-fully-upserted table. This is the same class of risk the plan's
own threat model accepted at "low" severity for a single-user offline app, and does not change
the gap classification, but should be visible for future WR-02 transaction-hardening work.

### Human Verification Required

1. **Delete-then-view regression (CR-02)** — **Test:** Log a run or lift session, confirm it appears on TODAY with a live HSS/readiness band, delete it via History's swipe-to-delete, return to TODAY. **Expected:** TODAY shows the empty/0 readiness state — no stale HSS or band from the deleted session. **Why human:** `recomputeLoadDaily` requires a live op-sqlite connection; this delete-then-render sequence cannot run under the apps/mobile vitest harness (scoped to pure `lib/**` modules that must not import `@apsis/db`).

2. **Earliest-session delete regression (CR-02 range-shrink path)** — **Test:** With finished sessions spanning several days, delete the earliest one via History. **Expected:** The 28-day trend chart and History no longer show a stale value for the removed day; no row for that date lingers outside the newly re-anchored range. **Why human:** Same as above — requires a live SQLite delete-then-recompute-then-render pass.

3. **Scrub tooltip renders without crashing (CR-01)** — **Test:** On the home screen's 28-day trend chart, drag a finger across it. **Expected:** A hairline cursor and tooltip appear, snap to the nearest day, and show `"<DATE> · HSS <n> · ATL <n> · CTL <n> · TSB <±n>"` without a red-screen crash. **Why human:** The original bug was a Reanimated UI-thread worklet exception that only reproduces when the actual chart-press gesture executes on the UI runtime; no test harness in this repo exercises Reanimated/Skia gestures.

4. **iOS date picker open/close (WR-05, lower priority — source fix already confirmed)** — **Test:** On the run entry form, tap the date row (opens the iOS picker), select a date (should close), re-tap the row (should toggle closed). **Expected:** The picker never stays permanently mounted; future dates remain unselectable (`maximumDate`). **Why human:** Native `DateTimePicker` open/close behavior cannot be exercised under vitest/tsc; the state-toggle logic is confirmed correct in source, but the on-device interaction hasn't been physically exercised.

5. **Ring count-up + capped-fill animation** (carried forward, unaffected by 04-09/04-10) — **Test:** Finish a run/lift with HSS > 200 and one with HSS < 200. **Expected:** The ring number always shows the exact rounded HSS; the volt arc caps at a full circle only when HSS ≥ 200. **Why human:** Animation timing/visual correctness isn't observable from source.

6. **Calibrating hero (<14 days)** (carried forward, unaffected by 04-09/04-10) — **Test:** Fresh install, log fewer than 14 days of sessions. **Expected:** Steel ring + PlateOrbit + "BUILDING TREND · DAY N/14", `ReadinessLight` absent, chart shows only real days. **Why human:** Visual composition across multiple components.

7. **Double-session day math** (carried forward, unaffected by 04-09/04-10) — **Test:** Log two sessions on the same day. **Expected:** History's "N SESSIONS · ADJUSTED" chip and "DAY TOTAL X · INCL. +Y DOUBLE-DAY LOAD" line show the correct, engine-derived Y. **Why human:** Needs a real multi-session day to eyeball the exact numbers end-to-end.

### Gaps Summary

Both blocking gaps from the prior verification (CR-01 TrendChart worklet crash, CR-02
recomputeLoadDaily stale-row leak) have been closed at the source-code level by plans 04-09 and
04-10, independently re-confirmed here by direct source inspection (not accepted from
SUMMARY.md's narrative). The fixes are precisely targeted, match their plans' acceptance criteria
byte-for-byte, and introduce no regressions — `packages/db` (27 tests), `packages/shared` (21
tests, +4 new), and `apps/mobile` (9 tests) all pass, and `apps/mobile` typechecks clean except
the two pre-existing, previously-documented route-typing errors. All 6 gap-closure commits
(`cdc1ef5`, `b64f90f`, `6c13d58`, `7d4b339`, `f105aaa`, `2e8625b`) are present in git history. The
three lower-severity warnings (WR-05 iOS date picker, WR-07 History empty-state, WR-08 pace
rounding) are also closed and confirmed.

Neither remaining item is a code gap — no artifact is missing, stubbed, or unwired. What remains
is that both fixed truths (HOME-01/02's "reflects reality" honesty invariant, and HOME-03's scrub
interaction) are **behavior-dependent**: their correctness depends on a runtime delete-cleanup
sequence and a UI-thread worklet gesture respectively, neither of which any automated test in this
repo can exercise (by the vitest harness's own explicit design — it must never import `@apsis/db`
or run Reanimated/Skia on a UI thread). Per the verification methodology's behavior-dependent-
truth rule, presence + wiring is necessary but not sufficient for these two truths; they are
classified PRESENT_BEHAVIOR_UNVERIFIED rather than VERIFIED, and this phase routes to
`human_needed` rather than `passed` pending the two on-device regression passes listed above
(items 1-3 in Human Verification Required). This is not a re-opened gap — it is the honest
terminal state for a fix whose correctness can only be finally proven on-device.

Recommend running the on-device UAT pass (items 1-3 at minimum; items 4-7 are lower-priority or
carried-forward general checks) before treating Phase 4 as fully shippable.

---

_Verified: 2026-07-10T23:45:00Z_
_Verifier: Claude (gsd-verifier)_
