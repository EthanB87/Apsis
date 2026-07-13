---
phase: 07
slug: nutrition-tracking
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-07-13
---

# Phase 07 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 4.1.9 (workspace-wide: packages/shared, packages/engine, packages/db, apps/mobile lib-only harness) |
| **Config file** | per-package `vitest.config.ts` |
| **Quick run command** | `pnpm --filter <touched-package> test` |
| **Full suite command** | `pnpm -r --if-present test && pnpm typecheck` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `pnpm --filter <touched-package> test`
- **After every plan wave:** Run `pnpm -r --if-present test && pnpm typecheck`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 60 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| *(filled by planner — one row per task)* | | | | | | | | | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `packages/engine/src/__tests__/macroTarget.test.ts` — golden-file stubs for dailyMacroTarget (mirrors HSS calibration test treatment)
- [ ] `packages/db/src/__tests__/` — schema/query tests for food, food_log, recipe, recipe_ingredient, nutrition_target (sqlite-proxy mock pattern from Phase 03)
- [ ] `apps/mobile/lib/__tests__/` — pure-logic tests for label-OCR parsing regex and barcode lookup chain ordering (extract logic from screens per the 04-P05 runEntryLogic precedent)

*Existing vitest infrastructure covers all frameworks — no new installs.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Barcode camera scan resolves a real product | TBD (barcode) | Requires physical device camera + real packaged food | Scan a known UPC; confirm product + serving sheet appears |
| Label OCR fills a custom food in one shot | TBD (label OCR) | Requires physical device camera + printed label; Vision OCR is iOS-native | Photograph a nutrition-facts label; confirm kcal/P/C/F pre-filled correctly |
| Repeat-food logging ≤3 taps | TBD (speed bar) | Interaction-latency quality bar, on-device only | Log a favorite food twice; count taps on second log |

*All engine/db/parsing logic has automated verification; camera/OCR flows are device-gated.*

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
