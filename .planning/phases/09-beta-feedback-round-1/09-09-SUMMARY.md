---
phase: 09-beta-feedback-round-1
plan: 09
subsystem: mobile-ui
tags: [keyboard, input-accessory, run-form, onboarding, ios]

# Dependency graph
requires:
  - "09-04: DecimalPadDoneBar shared component + DECIMAL_PAD_ACCESSORY_ID nativeID (mounting convention)"
  - "09-01: run.tsx runUnits wiring (not disturbed)"
  - "09-05: bodyweight.tsx bodyweightUnits wiring (not disturbed)"
provides:
  - "run.tsx distance + duration TextInputs opted into the shared Done bar"
  - "onboarding bodyweight.tsx bodyweight TextInput opted into the shared Done bar"
  - "All six D-13 decimal-pad call sites app-wide now carry the shared Done bar"
affects: []

tech-stack:
  added: []
  patterns:
    - "DecimalPadDoneBar mounted per-screen alongside its inputs (09-04 convention) — run.tsx mounts it inside KeyboardAvoidingView after the primary CTA; bodyweight.tsx mounts it as a WizardStep children sibling (InputAccessoryView renders natively, position in the tree is inert)"

key-files:
  created: []
  modified:
    - "apps/mobile/app/(tabs)/log/run.tsx"
    - apps/mobile/app/onboarding/bodyweight.tsx

decisions:
  - "run.tsx's DURATION field (keyboardType=number-pad, no return key) opted into the Done bar alongside DISTANCE (decimal-pad) — same 09-04 precedent (SetRow's reps/duration number-pad fields shared the load field's Done bar since they share the no-return-key problem)"
  - "bodyweight.tsx mounts <DecimalPadDoneBar /> as a sibling within WizardStep's children (after the out-of-range warning), not inside WizardStep.tsx itself — WizardStep is a shared component out of this plan's declared file scope, and InputAccessoryView has no visual position in the render tree"

metrics:
  duration: ~10min
  completed: 2026-08-05

status: complete

actuals:
  tokens: 1050
  tasks: 1
  commits: 1
---

# Phase 09 Plan 09: Done Bar on Run Form + Onboarding Bodyweight Summary

Wired the shared `DecimalPadDoneBar` (built in 09-04) into the two remaining D-13 call sites — the run form's distance/duration fields and the onboarding bodyweight field — completing the app-wide Done-bar rollout across all six decimal-pad inputs.

## Tasks Completed

| Task | Name | Commit | Files |
| ---- | ---- | ------ | ----- |
| 1 | Done bar on the run form + onboarding bodyweight inputs (D-13 call sites 4 & 5) | `fbbee12` | `apps/mobile/app/(tabs)/log/run.tsx`, `apps/mobile/app/onboarding/bodyweight.tsx` |

_Note: no plan-metadata commit in worktree mode — the orchestrator commits STATE.md/ROADMAP.md centrally after the wave merges._

## What Was Built

**run.tsx:**
- Imported `DECIMAL_PAD_ACCESSORY_ID`/`DecimalPadDoneBar` from `@/components/DecimalPadDoneBar`
- Set `inputAccessoryViewID={DECIMAL_PAD_ACCESSORY_ID}` on the DISTANCE TextInput (`keyboardType="decimal-pad"`) and the DURATION TextInput (`keyboardType="number-pad"`)
- Mounted `<DecimalPadDoneBar />` once, inside the `KeyboardAvoidingView`, after the primary Save Run CTA
- `useProfile().profile.runUnits` read (09-01 tracer wiring) left untouched — confirmed by grep

**bodyweight.tsx:**
- Imported `DECIMAL_PAD_ACCESSORY_ID`/`DecimalPadDoneBar` from `../../components/DecimalPadDoneBar`
- Set `inputAccessoryViewID={DECIMAL_PAD_ACCESSORY_ID}` on the bodyweight TextInput (`keyboardType="decimal-pad"`)
- Mounted `<DecimalPadDoneBar />` as a sibling within `WizardStep`'s children, after the out-of-range warning text
- `useOnboardingDraft((state) => state.bodyweightUnits)` read (09-05 wiring) left untouched — confirmed by grep

## Verification

- `pnpm install --frozen-lockfile` (fresh worktree checkout, no `node_modules`, matching 09-01/09-05's same finding) then `pnpm typecheck` (`tsc --build tsconfig.json`) — green, zero errors
- Acceptance criteria confirmed via grep: `inputAccessoryViewID` present on run.tsx's distance + duration inputs and bodyweight.tsx's bodyweight input; `runUnits`/`bodyweightUnits` reads intact in both files

## Deviations from Plan

None - plan executed exactly as written. The plan's action text called both run.tsx fields "decimal-pad TextInputs" even though DURATION uses `keyboardType="number-pad"` — this matches the 09-04 precedent where reps/duration number-pad fields were opted into the same Done bar as the decimal-pad load field, since they share the no-return-key iOS keyboard problem. No architectural deviation, no scope change.

## Threat Model Compliance

- **T-09-14 (low, mitigate):** Acceptance greps confirm `runUnits`/`bodyweightUnits` reads from 09-01/09-05 are intact; `pnpm typecheck` green
- **T-09-SC (low, accept):** No new packages this phase — `DecimalPadDoneBar` and `DECIMAL_PAD_ACCESSORY_ID` were already built and exported in 09-04

## Known Stubs

None — no stubs, placeholders, or unwired data paths introduced. This plan only adds a `nativeID` opt-in prop and mounts an already-built, already-verified shared component.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

All six D-13 decimal-pad call sites (lifting set fields via 09-04, three food surfaces via 09-07, run form + onboarding bodyweight via this plan) now carry the shared Done bar. The on-device confirmation that the Done bar appears and dismisses the keyboard on the run form and onboarding bodyweight screens (this plan's `<verification>` phase-gate line) remains open until the beta-round build 10 UAT, consistent with 09-01/09-04/09-05's same deferral pattern.

---
*Phase: 09-beta-feedback-round-1*
*Completed: 2026-08-05*

## Self-Check: PASSED

- `apps/mobile/app/(tabs)/log/run.tsx` — FOUND
- `apps/mobile/app/onboarding/bodyweight.tsx` — FOUND
- Commit `fbbee12` — FOUND
