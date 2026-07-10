---
phase: 4
slug: run-logger-home-dashboard
status: approved
nyquist_compliant: true
wave_0_complete: true
created: 2026-07-10
---

# Phase 4 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | `vitest 4.1.9` (pure-TS packages only: `packages/engine`, `packages/db`, `packages/shared` — VERIFIED via `vitest.config.mts` present in each). `apps/mobile` has **no** RN component/integration harness (documented Phase 3 gap, STATE.md). |
| **Config file** | `packages/db/vitest.config.mts` (closest analog for the new pure-logic tests this phase adds); `packages/shared` has its own config |
| **Quick run command** | `pnpm --filter @apsis/db test` (or `pnpm --filter @apsis/shared test` for the duration parser) |
| **Full suite command** | `pnpm -r test` (repo root — runs all three package suites) |
| **Estimated runtime** | ~5s per package quick run; ~15s full monorepo suite (pure TS, no native/emulator) |

---

## Sampling Rate

- **After every task commit:** Run `pnpm --filter @apsis/db test` (fast; covers any new query-builder / recompute-logic / duration-parser tests). Use `--filter @apsis/shared` for the parser task.
- **After every plan wave:** Run `pnpm -r test`
- **Before `/gsd-verify-work`:** Full suite must be green **plus** the on-device UAT walkthrough of RUN-01..06 and HOME-01..06 (see Manual-Only Verifications)
- **Max feedback latency:** ~15 seconds (full pure-TS suite)

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 4-01-01 | 01 | 1 | RUN-05 | T-04-02 | Migration is drizzle-kit generated, never hand-edited (append-only dir) | structural | `cd packages/db && npx drizzle-kit generate && ls drizzle/0002_*.sql && grep -il "note" drizzle/0002_*.sql` | ✅ | ⬜ pending |
| 4-01-02 | 01 | 1 | HOME-03, HOME-04, HOME-05, HOME-06 | T-04-01 / T-04-03 | Parameterized drizzle builders only; sole `sql` fragment is `count(*)` (no user input) | unit | `pnpm --filter @apsis/db test` | ✅ | ⬜ pending |
| 4-01-03 | 01 | 1 | RUN-02 | — | N/A (pure parser; no persisted input) | unit | `pnpm --filter @apsis/shared test` | ✅ | ⬜ pending |
| 4-02-CP | 02 | 1 | RUN-04, HOME-03 | T-04-SC | Blocking-human Skia legitimacy check on npmjs.com before install (never auto-approved) | manual (checkpoint) | — (blocking-human npmjs.com verification) | N/A | ⬜ pending |
| 4-02-01 | 02 | 1 | RUN-04, HOME-03 | T-04-SC2 | Exact-pinned Skia `2.6.9` (no caret); other three deps `expo install`-resolved at verified versions | structural | `cd apps/mobile && node -e "const p=require('./package.json').dependencies; if(p['@shopify/react-native-skia']!=='2.6.9') throw new Error('skia not pinned exact'); for(const k of ['victory-native','react-native-svg','@react-native-community/datetimepicker']){ if(!p[k]) throw new Error('missing '+k);} console.log('deps ok');"` | ✅ | ⬜ pending |
| 4-03-01 | 03 | 2 | HOME-01, HOME-02 | — | Single shared local-time (never UTC) date helper — no timezone drift (Pitfall 4) | structural | `cd apps/mobile && grep -q "export function todayLocalDate" lib/localDate.ts && grep -q "export function addDaysLocal" lib/localDate.ts && grep -q "lib/localDate" 'app/(tabs)/log/index.tsx'` | ✅ | ⬜ pending |
| 4-03-02 | 03 | 2 | HOME-01, HOME-02 | T-04-04 | Per-row literal parameterized `onConflictDoUpdate` (no `excluded.*`, no raw interpolated sql) | structural | `cd apps/mobile && grep -q "export async function recomputeLoadDaily" lib/recomputeLoadDaily.ts && grep -q "computeLoadDailyUpsertRows" lib/recomputeLoadDaily.ts && grep -q "onConflictDoUpdate" lib/recomputeLoadDaily.ts` | ✅ | ⬜ pending |
| 4-03-03 | 03 | 2 | HOME-01, HOME-02 | T-04-05 | Retrofit lift flow to recompute; `console.error` + re-throw (no stack trace to user) | structural | `cd apps/mobile && grep -c "recomputeLoadDaily" lib/finishWorkout.ts` | ✅ | ⬜ pending |
| 4-04-01 | 04 | 2 | HOME-01, HOME-02 | T-04-07 | Renders only already-computed local numbers (no new data source/network/PII) | structural + UAT | `cd apps/mobile && grep -q "RING_FILL_REFERENCE_HSS" components/home/HssRing.tsx && grep -q "react-native-svg" components/home/HssRing.tsx && grep -q "displayXl" constants/theme.ts && test -f components/home/PlateOrbit.tsx` | ✅ | ⬜ pending |
| 4-04-02 | 04 | 2 | HOME-01 | T-04-07 | (as above) | structural + UAT | `cd apps/mobile && grep -q "PRIMED" components/home/ReadinessLight.tsx && grep -q "CAUTION" components/home/ReadinessLight.tsx && grep -q "OVERREACHING" components/home/ReadinessLight.tsx` | ✅ | ⬜ pending |
| 4-04-03 | 04 | 2 | HOME-02 | T-04-07 | (as above) | structural + UAT | `cd apps/mobile && grep -q "ACUTE" components/home/StatTiles.tsx && grep -q "CHRONIC" components/home/StatTiles.tsx && grep -q "BALANCE" components/home/StatTiles.tsx` | ✅ | ⬜ pending |
| 4-05-01 | 05 | 3 | RUN-01, RUN-02, RUN-03 | T-04-08 / T-04-10 | Parameterized inserts; erg/conditioning never pass pace to `resolveIF` (Pitfall 6) | structural (tdd) | `cd apps/mobile && grep -q "export async function saveRun" lib/runEntry.ts && grep -q "resolveIF" lib/runEntry.ts && grep -q "recomputeLoadDaily" lib/runEntry.ts` | ✅ | ⬜ pending |
| 4-05-02 | 05 | 3 | RUN-02, RUN-04, RUN-05 | T-04-09 | `console.error` + hardcoded generic user message (no stack trace) | structural + UAT | `cd apps/mobile && grep -q "parseDurationDigits" 'app/(tabs)/log/run.tsx' && grep -q "saveRun" 'app/(tabs)/log/run.tsx' && grep -q "datetimepicker" 'app/(tabs)/log/run.tsx'` | ✅ | ⬜ pending |
| 4-05-03 | 05 | 3 | RUN-01 | — | N/A (navigation CTA) | structural + UAT | `cd apps/mobile && grep -q "log/run" 'app/(tabs)/log/index.tsx' && grep -qi "Log Run" 'app/(tabs)/log/index.tsx'` | ✅ | ⬜ pending |
| 4-06-01 | 06 | 3 | RUN-06 | T-04-11 | Parameterized `endurance_segment` select by workoutId; re-derive HSS from SQLite | structural + UAT | `cd apps/mobile && grep -q "enduranceSegment" app/session/finish.tsx` | ✅ | ⬜ pending |
| 4-06-02 | 06 | 3 | RUN-06 | T-04-12 | Existing `console.error` + fallback `hss=0` retained | structural + UAT | `cd apps/mobile && grep -q "HssRing" app/session/finish.tsx && grep -q "size={84}\|size: 84\|84" app/session/finish.tsx` | ✅ | ⬜ pending |
| 4-07-01 | 07 | 3 | HOME-03, HOME-04 | T-04-13 | Parameterized `last28DaysTrend`; no EWMA re-derivation in UI | structural + UAT | `cd apps/mobile && grep -q "useChartPressState" components/home/TrendChart.tsx && grep -q "CartesianChart" components/home/TrendChart.tsx` | ✅ | ⬜ pending |
| 4-07-02 | 07 | 3 | HOME-01, HOME-02, HOME-03, HOME-04 | T-04-14 | `useFocusEffect` for all `load_daily`/`workout` reads (never bare `useEffect` — Pitfall 5 / P10) | structural + UAT | `cd apps/mobile && grep -q "useFocusEffect" 'app/(tabs)/index.tsx' && grep -q "last28DaysTrend" 'app/(tabs)/index.tsx' && grep -q "HssRing" 'app/(tabs)/index.tsx' && ! grep -q "useEffect(" 'app/(tabs)/index.tsx'` | ✅ | ⬜ pending |
| 4-07-03 | 07 | 3 | HOME-02, HOME-06 | T-04-15 | `console.error` + graceful empty/zero render (no stack trace); double-day math via engine `dailyHSS` | structural + UAT | `cd apps/mobile && test -f components/home/TodayBreakdownSheet.tsx && grep -q "dailyHSS\|DOUBLE-DAY" components/home/TodayBreakdownSheet.tsx` | ✅ | ⬜ pending |
| 4-08-01 | 08 | 3 | HOME-05, HOME-06 | T-04-16 / T-04-18 | Parameterized history queries + confirm dialog before whole-session soft-delete | structural + UAT | `cd apps/mobile && test -f components/history/DayRow.tsx && grep -q "useFocusEffect" 'app/(tabs)/history/index.tsx' && grep -q "ADJUSTED" components/history/DayRow.tsx && grep -q "DOUBLE-DAY" components/history/DayRow.tsx` | ✅ | ⬜ pending |
| 4-08-02 | 08 | 3 | HOME-05 | T-04-16 | Re-derive from SQLite; parameterized select; no edit/delete controls | structural + UAT | `cd apps/mobile && test -f app/session/detail.tsx && grep -q "workout" app/session/detail.tsx` | ✅ | ⬜ pending |
| 4-08-03 | 08 | 3 | HOME-05 | — | N/A (tab config) | structural + UAT | `cd apps/mobile && grep -q 'name="history"' 'app/(tabs)/_layout.tsx' && grep -q "TODAY" 'app/(tabs)/_layout.tsx' && grep -q "calendar" 'app/(tabs)/_layout.tsx'` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

**Test-type key:**
- **unit** — a real vitest behavioral assertion (input → expected output). Only the two pure-logic tasks in plan 04-01 (query/recompute builders `4-01-02`, duration parser `4-01-03`) are truly behavioral, because they live in packages that HAVE a harness.
- **structural** — the `<automated>` command is a grep / `test -f` gate proving the required symbol/file/pin exists. It guarantees the executor wired the artifact but does not, on its own, prove runtime behavior; the behavior is confirmed by the paired on-device UAT (see Manual-Only Verifications). Every screen-level `apps/mobile` task is structural because `apps/mobile` has no RN component harness.
- **manual (checkpoint)** — a blocking-human gate with no automated command by design (the Skia legitimacy check).

**Sampling continuity:** every task carries an `<automated>` verify command — there is never a run of 3 consecutive tasks without an automated gate. ✅

---

## Wave 0 Requirements

No separate Wave 0 scaffolding pass is required. The `vitest` framework is already installed in
`packages/db` and `packages/shared`, and every new test file is co-created inline within plan
**04-01** (Wave 1), alongside the logic it exercises — there are no `<automated>MISSING` markers
in any of the 8 plans. The test files that satisfy RESEARCH.md's "Wave 0 Gaps" are:

- [ ] `packages/db/src/__tests__/load-daily.test.ts` — gap-fill + `dailyHSS` + `computeLoadTrendSeries` composition (RESEARCH Pattern 1). *Created in 04-01 Task 2.* (RESEARCH called this `recompute-load-daily.test.ts`; the plan names it `load-daily.test.ts` — same coverage.)
- [ ] `packages/db/src/__tests__/history-queries.test.ts` — `sessionCountsByDate` grouping + `last28DaysTrend` limit/order (HOME-05). *Created in 04-01 Task 2.* (RESEARCH called this `session-counts.test.ts`.)
- [ ] `packages/shared/src/__tests__/duration.test.ts` — `parseDurationDigits` examples + edges (RUN-02). *Created in 04-01 Task 3.*
- Framework install: **none** — `vitest` already present in `packages/db` and `packages/shared`.

*(Boxes above are unchecked only because plan 04-01 has not yet executed; they carry no separate
Wave 0 dependency — `wave_0_complete: true` reflects that there is no outstanding Wave 0 gap for
the executor to remediate before the feature waves.)*

---

## Manual-Only Verifications

All `apps/mobile` screen-level behavior is verified on-device: `apps/mobile` has no RN
component/integration test harness (the documented Phase 3 gap, carried unresolved into Phase 4).
The structural greps above prove the wiring exists; the behaviors below are the on-device UAT that
proves they actually work. This mirrors Phase 3, where LIFT-05 was explicitly deferred to phase
UAT for the same class of on-device-only behavior.

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Native modules linked (Skia/svg/victory-native/datetimepicker) | RUN-04, HOME-03 | Native rebuild only observable on device (Expo Go incompatible) | Prebuild + launch dev build; app bundles with no missing-native-module error |
| Run form entry: segmented control, smart h:mm:ss duration, live pace readout, date sheet (no future dates), optional note, sub-minute save | RUN-01, RUN-02, RUN-03, RUN-04, RUN-05 | No RN component harness | On-device: log a run in <1 min; pace updates per keystroke; ERG shows /500M, CONDITIONING hides distance/pace; date sheet blocks future dates; note persists |
| Finish mini-ring + endurance session HSS | RUN-06 | On-device Skia/svg render | After saving a run, finish screen shows the 84px mini-ring counting up the session HSS; Done returns to TODAY |
| TODAY hero: ring animate-once-per-day, readiness light semantic color, empty state | HOME-01, HOME-02 | On-device render + animation | Open TODAY: ring animates once/day then instant on repeat; readiness light shows correct band color; before today's first session, ring=0 with light still live + LET'S WORK + ghost shortcuts |
| 28-day ATL/CTL trend chart + scrub tooltip | HOME-03 | victory-native/Skia render + gesture, no harness | Scrub the chart; ash hairline cursor snaps to nearest day; tooltip shows the D-20 line (date · HSS · ATL · CTL · signed TSB); no volt on chart |
| Calibrating hero before 14 days of history | HOME-04 | On-device render | With <14 days of data: steel ring + plate-orbit + BUILDING TREND · DAY N/14; chart renders only real days |
| History ledger: accordion, ADJUSTED chip, REST rows, month headers, infinite scroll, swipe-delete | HOME-05, HOME-06 | Accordion/gesture UI, no harness | Day-grouped ledger with REST rows + month headers; a 2+ session day shows the amber ADJUSTED chip and, expanded, the +Y DOUBLE-DAY LOAD math; swipe-delete confirms then removes the session and updates the trend |
| Lift finish → Home reflects the lift (not just runs) | HOME-01, HOME-02 | On-device end-to-end (Pitfall 1 regression guard) | Finish a LIFT: Home's ring/band/chart change; discard a session: its load leaves the trend |

*Pure-logic tasks (`4-01-02`, `4-01-03`) are NOT manual-only — they have real automated vitest coverage.*

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies (every task carries an automated gate; the sole checkpoint `4-02-CP` is a deliberate blocking-human gate)
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references (no `MISSING` markers exist; test files folded into 04-01, framework already present)
- [x] No watch-mode flags (no `--watch` in any command)
- [x] Feedback latency < 15s (pure-TS package suites)
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved 2026-07-10
