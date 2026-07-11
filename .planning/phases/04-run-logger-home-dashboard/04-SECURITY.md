---
phase: 04
slug: run-logger-home-dashboard
status: verified
# threats_open = count of OPEN threats at or above workflow.security_block_on severity (the blocking gate)
threats_open: 0
asvs_level: 1
created: 2026-07-11
---

# Phase 04 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| user input → SQLite | Free-text note + numeric run fields (distance, duration, HR, dates) cross into persisted inserts | user-entered training data |
| generated migration → app startup | drizzle-kit migration SQL executes against the local DB via useMigrations | schema DDL |
| npm registry → app bundle | Third-party native code (Skia, victory-native, datetimepicker) compiled into the shipped binary | supply-chain code |
| workout rows → load_daily upsert | Per-session HSS aggregates into the durable trend table | derived load metrics |
| error paths → user | Failed recompute/save must not leak stack traces | diagnostics |
| UI thread ↔ JS thread (Reanimated worklet) | Worklet code runs on the UI runtime; non-worklet capture hard-throws | render state |
| history reads + swipe-delete → SQLite | Paginated reads + destructive soft-delete cross into the DB | session rows |

---

## Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation | Status |
|-----------|----------|-----------|----------|-------------|------------|--------|
| T-04-01 | Tampering | query builders (packages/db/src/queries.ts) | high | mitigate | Parameterized drizzle builders only; sole `sql` fragments are `count(*)`/`max()` aggregates with no user input (T-1-01 convention, documented queries.ts:9,81,143) | closed |
| T-04-02 | Tampering | drizzle migration 0002 | medium | mitigate | `0002_careful_sue_storm.sql` is drizzle-kit generated in append-only drizzle/ dir | closed |
| T-04-03 | Denial of Service | computeLoadDailyUpsertRows contiguous fill | low | accept | O(days-since-first-session) fold acceptable at v1.0 scale (RESEARCH A3) | closed |
| T-04-SC | Tampering | @shopify/react-native-skia install | high | mitigate | Human legitimacy checkpoint + exact `"2.6.9"` pin verified in apps/mobile/package.json | closed |
| T-04-SC2 | Tampering | victory-native / react-native-svg / datetimepicker | low | accept | Audited OK (RESEARCH Package Legitimacy Audit); installed via `npx expo install` | closed |
| T-04-04 | Tampering | load_daily upsert (recomputeLoadDaily) | high | mitigate | Parameterized `onConflictDoUpdate` (recomputeLoadDaily.ts:72) with literal set values, T-1-01 documented | closed |
| T-04-05 | Information Disclosure | recompute error path | medium | mitigate | `console.error` + re-throw, never swallowed (recomputeLoadDaily.ts:22,85) | closed |
| T-04-06 | Denial of Service | full-history fold on terminal write | low | accept | Synchronous op-sqlite fold cheap at v1.0 scale; revisit if UAT shows stall (UAT 2026-07-11: no stall) | closed |
| T-04-07 | Information Disclosure | ring/tile rendering | low | accept | Pure presentational; renders only already-computed local numbers | closed |
| T-04-08 | Tampering | run insert (workout.note, segments) | high | mitigate | Parameterized drizzle inserts; note stored as bound value (runEntry/runEntryLogic, T-1-01) | closed |
| T-04-09 | Information Disclosure | run save error path | medium | mitigate | `console.error` diagnostics + generic user message (run.tsx:17,116) | closed |
| T-04-10 | Tampering | erg IF resolution | medium | mitigate | Pace passed to resolveIF only for `activityType === 'run'` (runEntryLogic.ts:11) | closed |
| T-04-11 | Tampering | endurance summary query | high | mitigate | Parameterized drizzle select by workoutId, no raw sql | closed |
| T-04-12 | Information Disclosure | finish summary error path | low | mitigate | `console.error` + fallback pattern retained (finish.tsx:261,277,293) | closed |
| T-04-13 | Tampering | TODAY/breakdown queries | high | mitigate | Parameterized last28DaysTrend/dayGroupedSessions builders (T-1-01) | closed |
| T-04-14 | Denial of Service | stacked-screen focus rehydrate | medium | mitigate | `useFocusEffect` in (tabs)/index.tsx for load_daily/workout reads (Pitfall 5 / P10) | closed |
| T-04-15 | Information Disclosure | dashboard query error path | low | mitigate | `console.error` + graceful empty/zero render | closed |
| T-04-16 | Tampering | history queries + soft-delete | high | mitigate | Parameterized builders + `discardWorkout` soft-delete (history/index.tsx:41,197) | closed |
| T-04-17 | Denial of Service | history focus rehydrate | medium | mitigate | `useFocusEffect` in history/index.tsx (Pitfall 5) | closed |
| T-04-18 | Repudiation | accidental session deletion | medium | mitigate | Confirm modal before whole-session soft-delete (history/index.tsx:63,94,193,265); soft-delete keeps row recoverable | closed |
| T-04-09-01 | Tampering | recomputeLoadDaily DELETE cleanup | low | mitigate | Parameterized `notInArray(loadDaily.localDate, keep)` (recomputeLoadDaily.ts:25,52) | closed |
| T-04-09-02 | Denial of Service | tooltipText worklet | low | mitigate | `'worklet'` directives present (TrendChart.tsx:72,102); UAT test 3 scrub passed without crash | closed |
| T-04-09-SC | Tampering | package installs (plan 04-09) | n/a | accept | No installs in plan — existing-file edits only | closed |
| T-04-10-01 | Information Disclosure | History empty-state fallback | low | accept | Renders only user's own on-device sessions; offline single-user | closed |
| T-04-10-02 | Tampering | formatPaceMinSec | low | accept | Pure numeric-to-string transform; no untrusted sink | closed |
| T-04-10-SC | Tampering | package installs (plan 04-10) | n/a | accept | No installs — existing-file edits only | closed |

*Status: open · closed · open — below high threshold (non-blocking)*
*Severity: critical > high > medium > low — only open threats at or above workflow.security_block_on count toward threats_open*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-04-01 | T-04-03 | Full-history fold O(days) acceptable at v1.0 scale (RESEARCH A3); revisit on UAT stall | plan 04-01 threat model | 2026-07-11 |
| AR-04-02 | T-04-SC2 | Chart/date-picker deps audited OK at verified versions via `npx expo install` | plan 04-02 threat model | 2026-07-11 |
| AR-04-03 | T-04-06 | Synchronous op-sqlite fold cheap at v1.0 scale; UAT showed no stall | plan 04-03 threat model | 2026-07-11 |
| AR-04-04 | T-04-07 | Presentational components render only already-displayed local numbers | plan 04-04 threat model | 2026-07-11 |
| AR-04-05 | T-04-09-SC, T-04-10-SC | Gap-closure plans added no packages — no supply-chain surface | plans 04-09/04-10 threat models | 2026-07-11 |
| AR-04-06 | T-04-10-01, T-04-10-02 | Display-only changes; no new data crosses any boundary | plan 04-10 threat model | 2026-07-11 |

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-07-11 | 24 | 24 | 0 | gsd-secure-phase (L1 grep-depth, short-circuit: register authored at plan time) |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-07-11
