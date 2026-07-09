---
phase: 3
slug: onboarding-lifting-logger
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-07-09
---

# Phase 3 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 4.1.9 (already configured in `packages/engine` and `packages/db`) |
| **Config file** | `packages/engine/vitest.config.mts`, `packages/db/vitest.config.mts` — none yet for `apps/mobile` |
| **Quick run command** | `pnpm --filter @apsis/engine test` / `pnpm --filter @apsis/db test` |
| **Full suite command** | `pnpm -r test` |
| **Estimated runtime** | ~20 seconds |

---

## Sampling Rate

- **After every task commit:** Run the quick command for whichever package the task touched (`@apsis/engine` and/or `@apsis/db`)
- **After every plan wave:** Run `pnpm -r test`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** ~30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| TBD | TBD | TBD | ONB-04 | — | N/A | unit | `vitest run lib/units.test.ts` (new) | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | LIFT-03 | — | N/A | integration | `vitest run packages/db/src/__tests__/previous-session-query.test.ts` (new) | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | LIFT-07 / D-28 | — | soft-deleted workouts excluded from every load/HSS query | integration | `vitest run packages/db/src/__tests__/soft-delete.test.ts` (new) | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | LIFT-08 | — | N/A | unit | `vitest run packages/engine/src/__tests__/session.test.ts` (existing) | ✅ | ⬜ pending |
| TBD | TBD | TBD | D-18 (rep-max e1RM) | — | clamp-and-warn, never throw | unit | `vitest run packages/engine/src/__tests__/bodyweight.test.ts` (new) | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | D-20 (carry stress) | — | clamp-and-warn, never throw | unit + golden | `vitest run packages/engine/src/__tests__/carry.test.ts` (new) | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

(Task IDs filled by planner; the requirement→test mapping above comes from 03-RESEARCH.md Validation Architecture.)

---

## Wave 0 Requirements

- [ ] `packages/engine/src/__tests__/bodyweight.test.ts` — D-18 rep-max table estimator (table-row values, interpolation, out-of-range clamp+warning)
- [ ] `packages/engine/src/__tests__/carry.test.ts` — D-20 carry/sled stress + calibration golden (4×40 m heavy farmer's carry ≈ hard accessory block, well under ~100 HSS anchor)
- [ ] `packages/db/src/__tests__/previous-session-query.test.ts` — LIFT-03 previous-session set query
- [ ] `packages/db/src/__tests__/soft-delete.test.ts` — LIFT-07/D-28 soft-delete filtering
- [ ] `apps/mobile` component-test framework (@testing-library/react-native) — optional/discretionary per BUILD.md §3 ("focus test budget on the engine package, not UI"); NOT a blocking gap

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Onboarding wizard captures sex/BW/thresholds | ONB-01 | UI flow, no component test budget | Fresh install → complete wizard → verify profile row |
| Profile view/edit from Settings | ONB-02 | UI flow | Settings → edit bodyweight → verify future sets use new value |
| Readiness gated (never shown this phase) | ONB-03 | Structural — code inspection | Grep app code: no readiness band rendered anywhere |
| Exercise search < 2 taps | LIFT-01 | UX speed criterion | Add exercise → type 2 chars → tap result |
| Set logged in ≤ 3 taps | LIFT-02 | UX speed criterion | Pre-filled set → checkmark = 1 tap |
| RPE quick-row never behind modal | LIFT-04 | UI structure | Inspect set row on device |
| Auto-rest timer + banner + background notification | LIFT-05 | Needs real device / lock screen | Complete set → background app → notification fires — flag `checkpoint:human-verify` |
| Add/remove sets inline | LIFT-06 | UI flow | Add set clones previous; swipe-left deletes |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
