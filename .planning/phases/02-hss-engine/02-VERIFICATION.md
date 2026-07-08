---
phase: 02-hss-engine
verified: 2026-07-08T19:50:00Z
status: passed
score: 5/5 must-haves verified
behavior_unverified: 0
overrides_applied: 0
---

# Phase 02: HSS Engine Verification Report

**Phase Goal:** The pure-TS engine computes deterministic, fully unit-tested training-load and readiness numbers — validating the entire product thesis before any UI is built on top of it.
**Verified:** 2026-07-08T19:50:00Z
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth (ROADMAP Success Criterion) | Status | Evidence |
|---|---|---|---|
| 1 | Given strength sets (load, reps, RPE), engine returns per-session strength HSS excluding warmup-flagged sets (ENG-01) | ✓ VERIFIED | `packages/engine/src/strength.ts:38-41` — `if (set.isWarmup) continue;` skips warmups before any stress accumulation. `strength.test.ts` asserts a warmup set contributes `strengthStress` `toBe(0)`. 10 tests pass, including RPE-clamp and leg-multiplier goldens. |
| 2 | Given endurance segments, engine returns per-session endurance HSS (ENG-02) | ✓ VERIFIED | `packages/engine/src/endurance.ts` implements `ES = durationMin * IF^2 * kEndurance`; `enduranceStress({durationS:3600, intensityFactor:1.0})` lands ≈100 (calibration anchor). `ifFromHR`/`ifFromPace`/`resolveIF` (HR-priority) implemented and tested — 11 tests pass. |
| 3 | Multiple sessions on the same day → per-day HSS applies double-session penalty when sessionCount > 1 (ENG-03) | ✓ VERIFIED | `packages/engine/src/daily.ts:29-31` — penalty (`* config.doublePenalty`) applied only when `sessionScores.length > 1`. `daily.test.ts` golden: `dailyHSS([50,30])` → 88 = (50+30)*1.1; single session `dailyHSS([50])` → 50 (no penalty). 7 tests pass. |
| 4 | Rolling window of daily HSS → ATL/CTL/TSB over 28-day window + green/amber/red band from TSB/CTL; cold-start (<14 days or low CTL) never produces red (ENG-04/05/06) | ✓ VERIFIED | `packages/engine/src/trend.ts` — EWMA fold with `atlDays=7`/`ctlDays=28`, `tsb = ctl - atl` exactly (asserted). `readinessBand` gates to `'calibrating'` before any red/amber/green branch when `historyDays < 14 OR ctl < 10` (`trend.ts:93-99`). `readiness.test.ts` proves a single-session series (`computeLoadTrendSeries([120])[0].band`) is `'calibrating'`, never `'red'`. Post-review NaN-safety hardening (CR-03) additionally verified: `readinessBand(NaN, NaN, {historyDays:30})` returns `'calibrating'`, not `'green'` — closing a fail-open hole the code review found and fixed. 8 readiness tests + 8 trend tests pass. |
| 5 | `packages/engine` has zero runtime dependencies (first-party `@apsis/shared` link pre-approved), never calls `Date.now()` internally, ≥20 vitest tests pass via `pnpm --filter @apsis/engine test` (ENG-07) | ✓ VERIFIED | `packages/engine/package.json` `dependencies` contains only `@apsis/shared: workspace:*`, no devDependencies leaked into runtime. `grep -rIn -e 'Date\.now' -e 'performance\.now' -e 'new Date(' packages/engine/src` → 0 matches (verified independently). `pnpm --filter @apsis/engine test` → **8 test files, 61/61 tests passed** (exceeds ≥20 bar). `pnpm typecheck` exits 0 (verified independently, `tsc --build`). |

**Score:** 5/5 truths verified (0 present-but-behavior-unverified)

### Required Artifacts

| Artifact | Expected | Status | Details |
|---|---|---|---|
| `packages/shared/src/index.ts` | Engine I/O + config + result types, dependency-free | ✓ VERIFIED | Contains `StrengthSet`, `EnduranceSegment`, `SessionInput`, `EngineConfig` (10 fields incl. calibrating/band constants), `StrengthStressDetail`, `EnduranceStressDetail`, `SessionHSSResult`, `LoadTrendPoint`. Zero import statements. |
| `packages/engine/src/config.ts` | `DEFAULT_CONFIG` + `mergeConfig` | ✓ VERIFIED | All 10 fields present; `kStrength: 4.4` (calibrated), `kEndurance: 1.6667` (D-14 anchor). `mergeConfig` spreads override over defaults. |
| `packages/engine/src/clamp.ts` | Never-throwing clamp+warn primitive | ✓ VERIFIED | `clampRange` guards `typeof value !== 'number' || Number.isNaN(value)` (hardened post-review from NaN-only), clamps `Infinity`/`-Infinity` directionally. 7 tests pass. |
| `packages/engine/src/strength.ts` | `strengthStress`/`strengthStressDetailed`/`estimateE1RM` | ✓ VERIFIED | Formula, warmup exclusion, leg multiplier, RPE clamp, e1rmKg skip (hardened to `!(x>0)` post-review to catch NaN) all present. 10 tests pass. |
| `packages/engine/src/endurance.ts` | `enduranceStress`/detailed/`ifFromHR`/`ifFromPace`/`resolveIF` | ✓ VERIFIED | ES formula, HR-priority resolution, IF clamp [0.3,1.3], zero/negative-denominator guards. 11 tests pass. |
| `packages/engine/src/session.ts` | `sessionHSS`/`sessionHSSDetailed`, version-stamped | ✓ VERIFIED | Composes strength+endurance, stamps `ENGINE_VERSION` + resolved config. 7 tests pass. |
| `packages/engine/src/daily.ts` | `dailyHSS` with double-session penalty | ✓ VERIFIED | Penalty gated on `length > 1`; non-finite entries mapped to 0 (WR-02 fix). 7 tests pass. |
| `packages/engine/src/trend.ts` | `computeLoadTrend`/`computeLoadTrendSeries`/`readinessBand` | ✓ VERIFIED | EWMA fold + calibrating-gated band; shared `ewmaLambda`/`ewmaStep` helpers (WR-01 dedup fix); NaN-safe (CR-03 fix). 8+8 tests pass. |
| `packages/engine/src/index.ts` | Public barrel re-exporting full API + `ENGINE_VERSION` | ✓ VERIFIED | `export * from` config/strength/endurance/session/daily/trend/version. Placeholder test deleted. |
| `packages/engine/src/__tests__/calibration.test.ts` | D-13 cross-modality golden (0.8–1.25 ratio) | ✓ VERIFIED | 3 tests: run≈100, lift/run ratio in [0.8,1.25], squat within BUILD.md's 30–120 range. All pass, imports from `'../index'` (the barrel). |
| `packages/engine/README.md` | Documents every formula + constant (BUILD.md §4.4) | ✓ VERIFIED | 218 lines; sections for Public API, Formulas (ES/SS/Session/Daily/Trend/Band), `DEFAULT_CONFIG` constants table, approved BUILD.md deviations, Purity, Testing. |

### Key Link Verification

| From | To | Via | Status | Details |
|---|---|---|---|---|
| `strength.ts` | `@apsis/shared`, `config.ts`, `clamp.ts` | type + value imports | ✓ WIRED | `import type {...} from '@apsis/shared'`, `import { mergeConfig } from './config'`, `import { clampRange } from './clamp'` all present and exercised. |
| `endurance.ts` | `@apsis/shared`, `config.ts`, `clamp.ts` | same pattern | ✓ WIRED | Confirmed identical import wiring. |
| `session.ts` | `strength.ts` + `endurance.ts` | composes detailed results | ✓ WIRED | `strengthStressDetailed`/`enduranceStressDetailed` imported and called; `hss = ss + es` (`session.ts:44`). |
| `daily.ts` | (none — operates on `number[]`) | pure array param | ✓ WIRED | No dependency on strength/endurance internals, matches plan intent. |
| `trend.ts` `computeLoadTrendSeries` | `readinessBand` | per-day call with `historyDays: i+1` | ✓ WIRED | `trend.ts:136` — `readinessBand(tsb, ctl, { historyDays: i + 1 }, config)` inside the fold loop. |
| `index.ts` (barrel) | all 7 sibling modules | `export * from` | ✓ WIRED | Confirmed all 7 `export * from` lines present; `calibration.test.ts` imports `sessionHSS` from `'../index'`, proving the barrel is a real integration surface, not just declared. |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|---|---|---|---|
| Full engine test suite passes | `pnpm --filter @apsis/engine test` | 8 files, 61/61 tests passed | ✓ PASS |
| Monorepo typecheck is clean | `pnpm typecheck` | exit 0, no output/errors | ✓ PASS |
| Zero wall-clock reads in engine source | `grep -rIn -e 'Date\.now' -e 'performance\.now' -e 'new Date(' packages/engine/src \| wc -l` | 0 | ✓ PASS |
| Zero third-party runtime deps | `node -e "...Object.keys(p.dependencies)"` | `['@apsis/shared']` only | ✓ PASS |
| No debt markers (TBD/FIXME/XXX/TODO/HACK/PLACEHOLDER) in engine or shared source | `grep -rn -E "TBD|FIXME|XXX|TODO|HACK|PLACEHOLDER"` | 0 matches | ✓ PASS |

_Note: `pnpm --filter @apsis/engine test` was run once as the full-suite check per verification constraints; not re-filtered per truth._

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|---|---|---|---|---|
| ENG-01 | 02-02 | Per-session strength HSS from sets, warmups excluded | ✓ SATISFIED | `strength.ts` + `strength.test.ts` (10 tests) |
| ENG-02 | 02-03 | Per-session endurance HSS from segments | ✓ SATISFIED | `endurance.ts` + `endurance.test.ts` (11 tests) |
| ENG-03 | 02-04 | Per-day HSS incl. double-session penalty | ✓ SATISFIED | `daily.ts` + `daily.test.ts` (7 tests) |
| ENG-04 | 02-05 | Rolling load trend (ATL/CTL/TSB) over 28-day window | ✓ SATISFIED | `trend.ts` `computeLoadTrend`/`computeLoadTrendSeries` + `trend.test.ts` (8 tests) |
| ENG-05 | 02-05 | Readiness band (green/amber/red) from TSB and CTL | ✓ SATISFIED | `trend.ts` `readinessBand` + `readiness.test.ts` (8 tests) |
| ENG-06 | 02-05 | Cold-start handling without misleading red | ✓ SATISFIED | `readinessBand`'s calibrating gate; cold-start-never-red test + NaN-fails-toward-calibrating regression test |
| ENG-07 | 02-01, 02-06 | Pure TS (time passed in, no I/O), ≥20 vitest tests | ✓ SATISFIED | Barrel `index.ts`, `calibration.test.ts`, zero-dep/zero-wall-clock checks, 61 tests total |

No orphaned requirements: all 7 requirement IDs declared across the 6 plans (`ENG-07` in 02-01 and 02-06, `ENG-01` in 02-02, `ENG-02` in 02-03, `ENG-03` in 02-04, `ENG-04`/`ENG-05`/`ENG-06` in 02-05) exactly match ROADMAP.md's Phase 02 requirement list and REQUIREMENTS.md's traceability table (all marked "Phase 02 / Complete").

### Anti-Patterns Found

None. Scanned all of `packages/engine/src` and `packages/shared/src` for `TBD`/`FIXME`/`XXX`/`TODO`/`HACK`/`PLACEHOLDER`, placeholder-language phrases, `console.*`, and `Math.random` — zero matches in every category.

### Code Review Follow-Through (post-plan-completion, legitimate phase work)

A code review pass (`02-REVIEW.md`) found 3 Critical NaN-robustness holes and 2 Warnings after the 6 plans completed (53 tests at that point):

- **CR-01**: `clampRange` only guarded `Number.isNaN`, letting `undefined`/non-numeric input through unclamped and unwarned.
- **CR-02**: `e1rmKg <= 0` skip check was defeated by `NaN` (`NaN <= 0` is `false` in JS), silently poisoning `ss` with no warning.
- **CR-03**: No NaN/finite guard in the EWMA fold or `readinessBand` — a single corrupted day would permanently poison ATL/CTL forever, and the band would fail open to `'green'` instead of `'calibrating'` — the worst possible failure mode for ENG-06's cold-start guarantee.
- **WR-01**: EWMA lambda formula duplicated between `ewmaFold` and `computeLoadTrendSeries` (drift risk).
- **WR-02**: `dailyHSS` had no input validation, unlike every other public engine function.

All 5 were fixed (`02-REVIEW-FIX.md`, commits `7e71d88`, `05d56ca`, `6b32722`, `0ca53fb`, `e8fdc87`) with regression tests added for each. Independently verified in this pass: `clampRange` now checks `typeof value !== 'number' || Number.isNaN(value)`; `strength.ts` uses `!(set.e1rmKg > 0)`; `trend.ts`'s `readinessBand` explicitly checks `!Number.isFinite(tsb) || !Number.isFinite(ctl)` before the calibrating gate; `ewmaLambda`/`ewmaStep` are shared single-source-of-truth helpers; `dailyHSS` maps non-finite entries to 0. Test count independently confirmed at 61/61 (matches the claimed growth from 53 → 61). This closes a real fail-open safety gap in the exact ENG-06 guarantee the phase goal depends on — the review-and-fix cycle materially strengthens, rather than merely documents, goal achievement.

### Human Verification Required

None. This phase is pure computational logic (no UI, no network, no external service, no real-time behavior) — all observable truths are fully verifiable via static analysis, typecheck, and deterministic unit tests.

### Gaps Summary

No gaps. All 5 ROADMAP success criteria are verified against actual, substantive, wired, and tested code — not stubs. All 7 requirement IDs (ENG-01 through ENG-07) are satisfied with no orphaned requirements. The post-plan code-review-and-fix cycle closed a genuine fail-open safety hole (NaN handling in the readiness band) that would otherwise have silently violated the ENG-06 cold-start guarantee; this is legitimate phase work, independently re-verified here, not drift.

---

_Verified: 2026-07-08T19:50:00Z_
_Verifier: Claude (gsd-verifier)_
