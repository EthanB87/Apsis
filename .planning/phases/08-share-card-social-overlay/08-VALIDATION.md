---
phase: 8
slug: share-card-social-overlay
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: draft
nyquist_compliant: true
wave_0_complete: false
created: 2026-08-03
---

# Phase 8 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 4.1.9 |
| **Config file** | `apps/mobile/vitest.config.mts` — scoped to `lib/**/__tests__/*.{test,spec}.ts` only; zero `@apsis/db` / native-module imports allowed (its own doc comment + `lib/__tests__/runEntryLogic.test.ts` precedent) |
| **Quick run command** | `pnpm --filter @apsis/mobile test -- shareCard` |
| **Full suite command** | `pnpm --filter @apsis/mobile test` |
| **Estimated runtime** | ~2 seconds (single pure-logic `shareCard` test file; the full mobile suite runs in a few seconds) |

Non-test automated gate: every code-producing task in this phase also runs `pnpm run typecheck` as its `<automated>` verify. The share-card export/render/photo layers (`ShareCardCanvas.tsx`, `shareCardExport.ts`, `share.tsx`, `detail.tsx`, `finish.tsx`) touch native modules and have no component-test harness in this repo (STATE.md: "apps/mobile has no component test harness"), so `typecheck` + on-device UAT is their automated + manual coverage.

---

## Sampling Rate

- **After every task commit:** Run `pnpm --filter @apsis/mobile test -- shareCard` (for tasks that touch `lib/shareCard.ts`) or `pnpm run typecheck` (for the render/export/photo tasks that have no unit-testable surface).
- **After every plan wave:** Run `pnpm --filter @apsis/mobile test` (full suite) + `pnpm run typecheck`. After Wave 1 (08-01) lands the three native deps, cut a fresh EAS dev-client build so `expo-image-picker` / `expo-file-system` / `expo-sharing` are linked before any on-device UAT (Pitfall 3).
- **Before `/gsd-verify-work`:** Full suite green + `pnpm run typecheck` clean + the on-device share-sheet UAT (08-02 Task 2 spike and 08-04 Task 3 full UAT) passing.
- **Max feedback latency:** ~2 seconds (quick `shareCard` run).

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 08-01-01 | 01 | 1 | D-06, D-08, D-15 | T-08-SC | Human confirms the 3 SUS Expo packages are official before install (not auto-approvable) | manual-only | on-device / npmjs.com review | N/A | ⬜ pending |
| 08-01-02 | 01 | 1 | D-06, D-08, D-15 | T-08-01 / T-08-SC | Photo-library permission string honestly discloses the single share-card use; deps land SDK-56 line, lockfile synced | integration | `node -e "…deps present check…" && pnpm run typecheck` | ✅ (package.json/app.json) | ⬜ pending |
| 08-02-01 | 02 | 2 | D-01, D-02, D-05, D-07, D-11, D-12, D-13, D-14 | T-08-02 / T-08-03 | HSS read from persisted SQLite (never re-derived); no new Sentry calls; ring is volt-only, no readiness band (D-05) | unit + typecheck | `pnpm --filter @apsis/mobile test -- shareCard && pnpm run typecheck` | ❌ W0 (`shareCard.test.ts`) | ⬜ pending |
| 08-02-02 | 02 | 2 | D-01, D-02, D-05, D-07, D-11, D-12, D-13, D-14 | T-08-02 / T-08-03 | On-device spike: Skia snapshot → File → share sheet attaches a real PNG (not PDF-only, Pitfall 1); non-blank/non-stale (Pitfall 4) | manual-only | on-device UAT (RESEARCH Open Question 1 spike) | N/A | ⬜ pending |
| 08-03-01 | 03 | 3 | D-03, D-04 | T-08-04 | Stat-trio numbers reuse the exact `@apsis/shared` formatters/rounding `finish.tsx`/`detail.tsx` use (no drift) | unit + typecheck | `pnpm --filter @apsis/mobile test -- shareCard && pnpm run typecheck` | ✅ (extends `shareCard.test.ts`) | ⬜ pending |
| 08-03-02 | 03 | 3 | D-03, D-04, D-09 | T-08-02 / T-08-04 | share.tsx aggregates stats from persisted SQLite (still no `sessionHSSDetailed`); every `matchFont` guarded | typecheck | `pnpm run typecheck` | ✅ (source files) | ⬜ pending |
| 08-03-03 | 03 | 3 | D-11 | — | Detail Share affordance uses bone fill (not volt); total row keeps sole volt ownership | typecheck | `pnpm run typecheck` | ✅ (`detail.tsx`) | ⬜ pending |
| 08-04-01 | 04 | 4 | D-06, D-08, D-15, D-16 | T-08-02 | Permission wrapper distinguishes limited-access from denied (Pitfall 5); never throws, logs `[Apsis]`-prefixed | typecheck | `pnpm run typecheck` | ✅ (`shareCardExport.ts`) | ⬜ pending |
| 08-04-02 | 04 | 4 | D-06, D-07, D-10, D-16 | T-08-02 / T-08-05 | Denied/limited/skip all fall back to the void card (never hard-block); `useImage`/`matchFont` guarded so a bad photo degrades to void, not crash | typecheck | `pnpm run typecheck` | ✅ (source files) | ⬜ pending |
| 08-04-03 | 04 | 4 | D-06, D-07, D-08, D-10, D-15, D-16 | T-08-05 | Full on-device UAT: photo-first pick/crop/swap/skip + scrim legibility + both entry points + PNG attach in every branch | manual-only | on-device UAT (7-scenario checklist) | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

*Requirement column uses `08-CONTEXT.md`'s D-01..D-16 decisions — Phase 8 postdates the locked v1.0 REQUIREMENTS.md set and has no formal REQ IDs (RESEARCH "Phase Requirements", owner decision 2026-08-03).*

---

## Wave 0 Requirements

- [ ] `apps/mobile/lib/__tests__/shareCard.test.ts` — RED-first stubs for the D-03/D-04 pure formatting logic (`buildShareCaption`, and later `buildStrengthStatTrio`/`buildEnduranceStatTrio`); authored inside 08-02 Task 1 (tracer, tests-first) then extended in 08-03 Task 1.
- [ ] No new framework/config install — the existing `apps/mobile/vitest.config.mts` `lib/**` scoping already covers a new `lib/shareCard.ts` module as long as it stays `@apsis/db`-free (RESEARCH "Wave 0 Gaps").

*The single MISSING automated reference (`shareCard.test.ts`) is created RED-first within the first code task (08-02-01); `wave_0_complete` stays `false` until that task lands.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Skia snapshot → File → iOS share sheet attaches a valid PNG (not PDF-only) | D-12 / Pattern 1 (Open Question 1) | Native share sheet + `UIActivityViewController`; zero codebase precedent, no automated harness | 08-02 Task 2 spike: on a fresh EAS dev build, finish a lift → Share card → tap Share → confirm a real 1080×1080 PNG attaches with Save Image / Messages / social targets (Pitfall 1), non-blank/non-stale (Pitfall 4) |
| Share-edition ring renders volt-only, recomposed 1080px sizing, no readiness band | D-02 / D-05 / D-09 | Skia render; no component test harness in `apps/mobile` (STATE.md) | On device, confirm the ring shows the correct session HSS in a volt arc with no calibrating/steel-only readiness variant, sized for social scale |
| Photo pick opens native library; `allowsEditing:true` forces a square crop on iOS | D-06 / D-08 / D-15 | Native picker/crop UI; cannot run headless | 08-04 Task 3: pick a non-square photo → confirm the iOS crop rectangle is square |
| No-photo skip and permission-denied/limited both fall back to the void card without blocking share | D-07 / D-16 | iOS permission-state simulation needs a physical device with Photos permission control | 08-04 Task 3: set Photos to None → confirm alert + Open Settings deep-link then void fallback; set Photos to Limited (zero selected) → confirm void fallback, not a dead end (Pitfall 5) |
| Bottom void-to-transparent scrim keeps ring/trio/footer legible over a bright/busy photo | D-10 | Visual legibility judgment over real photos | 08-04 Task 3: pick a bright/busy photo → confirm the overlay text stays legible over the scrim |
| Both entry points (finish screen + History session detail) reach the compose flow | D-11 | Navigation + on-device flow | 08-04 Task 3: reach the compose screen from a finished session AND from a History session detail |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies (checkpoint/UAT tasks are inherently manual and captured in the Manual-Only table)
- [x] Sampling continuity: no 3 consecutive tasks without automated verify (manual tasks 08-01-01, 08-02-02, 08-04-03 are each separated by automated `typecheck`/unit tasks)
- [x] Wave 0 covers all MISSING references (`shareCard.test.ts` created RED-first in 08-02 Task 1)
- [x] No watch-mode flags (all commands are single-run)
- [x] Feedback latency < 2s (quick `shareCard` run)
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** pending — final sign-off set by `/gsd-validate-phase` after execution
