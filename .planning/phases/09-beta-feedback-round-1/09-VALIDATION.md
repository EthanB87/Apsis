---
phase: 9
slug: beta-feedback-round-1
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: validated
nyquist_compliant: true
wave_0_complete: false
created: 2026-08-04
---

# Phase 9 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Transcribed from `09-RESEARCH.md` § Validation Architecture; commands mirror each plan's `<automated>` verify.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 4.x (confirmed via existing `packages/db/src/__tests__/*.test.ts` and `apps/mobile` lib tests) |
| **Config file** | per-package `vitest.config.ts` (existing, unchanged) |
| **Quick run command** | package-scoped: `pnpm --filter @apsis/db test` / `pnpm --filter @apsis/shared test` / `pnpm --filter apps/mobile test` |
| **Full suite command** | `pnpm -r test` (root — Phase 06 P06 precedent) |
| **Estimated runtime** | ~15–30 seconds full suite (STATE.md precedent: 259 tests — 21 shared + 95 engine + 63 db + 80 mobile) |

---

## Sampling Rate

- **After every task commit:** Run the package-scoped quick command for whichever package the task touched (`@apsis/db`, `@apsis/shared`, or `apps/mobile`); UI-only tasks run `pnpm typecheck`
- **After every plan wave:** Run `pnpm -r test` (full suite) + `pnpm typecheck` (root — Phase 03 P04/05 cross-package precedent)
- **Before `/gsd-verify-work`:** Full suite must be green + an on-device UAT pass covering every keyboard/onboarding item (D-11..D-19)
- **Max feedback latency:** ~30 seconds (per-package quick command returns in a few seconds; full suite ~30s)

---

## Per-Task Verification Map

> This phase has **no REQ-IDs** in REQUIREMENTS.md (beta-feedback items, not v1.0 scope items — REQUIREMENTS.md's traceability table has no Phase 09 row). The Requirement column carries the CONTEXT.md decision IDs (D-01..D-21) each task implements instead. Manual-only on-device checkpoint tasks are listed in the **Manual-Only Verifications** table below, not here.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 09-01-01 | 01 | 1 | D-01 | T-09-01 | N/A (tracer spine; migration proof follows in 09-01-02) | tracer/typecheck | `pnpm typecheck` | ✅ | ⬜ pending |
| 09-01-02 | 01 | 1 | D-01, D-04 | T-09-01 / T-09-02 | Round-trip proof asserts backfill values before .sql ships | unit (migration round-trip) | `pnpm --filter @apsis/db test` | ❌ W0 (`units-migration.test.ts`) | ⬜ pending |
| 09-02-01 | 02 | 1 | D-05 | T-09-03 | qtyToGrams clamps to finite non-negative before arithmetic | unit | `pnpm --filter @apsis/shared test` | ✅ (extend `units.test.ts`) | ⬜ pending |
| 09-02-02 | 02 | 1 | D-06, D-07 | T-09-03 / T-09-04 | tsp/tbsp offered only when food.servingGrams exists (no fabricated density) | unit | `pnpm --filter apps/mobile test foodUnits` | ❌ W0 (`foodUnits.test.ts`) | ⬜ pending |
| 09-03-01 | 03 | 1 | D-20, D-21 | T-09-05 / T-09-06 | DB delete + recomputeSessionHss before in-memory removal; cancel prior notification before reschedule | unit | `pnpm --filter apps/mobile test sessionStore` | ❌ W0 (`sessionStore.test.ts`) | ⬜ pending |
| 09-03-02 | 03 | 1 | D-20 | — | N/A | typecheck | `pnpm typecheck` | ✅ | ⬜ pending |
| 09-04-01 | 04 | 1 | D-11, D-13 | — | N/A (InputAccessoryView is RN core; no new pkg) | typecheck | `pnpm typecheck` | ✅ | ⬜ pending |
| 09-04-02 | 04 | 1 | D-14 | T-09-07 | New session.tsx effect uses useFocusEffect, never plain useEffect (P10 rehydrate loop) | typecheck | `pnpm typecheck` | ✅ | ⬜ pending |
| 09-05-01 | 05 | 2 | D-01, D-02, D-04 | T-09-08 | Save writes all three unit columns + legacy anchor; read mapper falls back so null never surfaces | typecheck | `pnpm typecheck` | ✅ | ⬜ pending |
| 09-05-02 | 05 | 2 | D-03 | — | N/A | typecheck | `pnpm typecheck` | ✅ | ⬜ pending |
| 09-06-01 | 06 | 2 | D-01 | T-09-09 | Grep acceptance asserts no display-read of `profile.units` remains | typecheck | `pnpm typecheck` | ✅ | ⬜ pending |
| 09-06-02 | 06 | 2 | D-01 | T-09-09 | Grep acceptance asserts no display-read of `profile.units` remains | typecheck | `pnpm typecheck` | ✅ | ⬜ pending |
| 09-07-01 | 07 | 2 | D-08, D-09, D-11, D-12 | T-09-10 / T-09-11 / T-09-12 | qtyToGrams clamps + converts to grams only; no new Sentry breadcrumb; tsp/tbsp gated on servingGrams | typecheck | `pnpm typecheck` | ✅ | ⬜ pending |
| 09-07-02 | 07 | 2 | D-10 | T-09-10 | buildFoodLogRow receives grams only (chips convert before storage) | typecheck | `pnpm typecheck` | ✅ | ⬜ pending |
| 09-08-01 | 08 | 3 | D-15, D-16, D-17, D-18 | T-09-13 | Cards use only hardcoded sample data; acceptance asserts no DB read | typecheck | `pnpm typecheck` | ✅ | ⬜ pending |
| 09-08-02 | 08 | 3 | D-19 | — | N/A | typecheck | `pnpm typecheck` | ✅ | ⬜ pending |
| 09-09-01 | 09 | 3 | D-11, D-13 | T-09-14 | Acceptance greps assert runUnits/bodyweightUnits reads stay intact | typecheck | `pnpm typecheck` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `packages/db/src/__tests__/units-migration.test.ts` — covers D-01/D-04 (migration + backfill round-trip), reusing `applyCommittedMigrations` from `nutrition-schema.test.ts`
- [ ] `apps/mobile/lib/__tests__/sessionStore.test.ts` — covers D-21 (notification cancel-before-reschedule) and D-20 (removeExercise DB cleanup), mocking `lib/notifications.ts`
- [ ] `apps/mobile/lib/__tests__/foodUnits.test.ts` — covers D-05..D-09's grams↔oz/lb/tsp/tbsp/serving conversion math, especially the D-06 "no tsp/tbsp without a real servingGrams basis" gating rule
- [x] Framework install: none — vitest is already configured in all three packages

*The three test files above are the ❌ W0 references in the map. All new-behavior tasks (09-01-02, 09-02-02, 09-03-01) depend on them; no MISSING reference is left uncovered.*

---

## Manual-Only Verifications

> UI/keyboard/onboarding interaction is not meaningfully unit-testable in this stack (STATE.md-documented gap: `apps/mobile` has no component test harness; expo-router focus/stack regressions are only catchable on-device). These are the four `checkpoint:human-verify` tasks.

| Task ID | Behavior | Requirement | Why Manual | Test Instructions |
|---------|----------|-------------|------------|-------------------|
| 09-03-03 | Rest-timer fix + delete-exercise flow | D-20, D-21 | OS notification scheduling + swipe/delete UX not unit-observable | Commit a set before rest elapses → confirm only newest timer fires; open ExerciseCard overflow → Remove → confirm sets deleted + HSS recomputed |
| 09-04-03 | Session keyboard-safety + Done bar | D-11, D-13, D-14 | Keyboard layout/scroll is device-only | Focus a lifting set field → confirm it scrolls above the keyboard and the Done bar dismisses it |
| 09-07-03 | Food unit chips + keyboard-safe sheet + Done bar | D-05..D-13 | BottomSheet keyboard interaction + live macro preview device-only | Open FoodConfirmSheet → confirm chip row, macros recompute live per unit, Log button stays visible, tsp/tbsp only on serving-basis foods |
| 09-08-03 | Explainer cards + Settings revisit | D-15..D-19 | Swipeable card gestures + expandable math layer device-only | Launch onboarding → confirm 3 swipeable cards with dots/Skip before input; reopen via Settings "How Apsis works" |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies (every auto task has an `<automated>` command; the 4 manual-only checkpoints are documented above)
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references (`units-migration.test.ts`, `sessionStore.test.ts`, `foodUnits.test.ts`)
- [x] No watch-mode flags (all commands are single-shot `pnpm` runs)
- [x] Feedback latency < 30s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved 2026-08-04
