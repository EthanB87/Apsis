---
phase: 03-onboarding-lifting-logger
plan: 08
subsystem: ui
tags: [react-native, expo-router, gorhom-bottom-sheet, drizzle, hss-engine]

# Dependency graph
requires:
  - phase: 03-onboarding-lifting-logger
    provides: "Plan 02's softDeleteWorkout/activeWorkoutFilter builders, Plan 06's session.tsx/finish.tsx/HSSBreakdownSheet.tsx stubs and SetRow.tsx warning-badge slot"
provides:
  - "finishWorkout/discardWorkout lib helpers (D-14 invariant fix + D-28 soft delete)"
  - "Finish summary screen: big HSS, per-exercise volume/set counts, engine warnings list, menu-gated confirmed discard"
  - "HSS breakdown sheet: per-exercise stress subtotal rollup + session total, no formula internals"
  - "Set-row warning badges driven by real per-set engine warnings"
affects: [phase-04-home-readiness]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Per-set engine re-run for attribution: since sessionHSSDetailed's warnings[] carries no set id, per-set/per-exercise attribution is derived by re-running strengthStressDetailed/carryStressDetailed on a single set (or one exercise's committed sets) rather than trying to parse the flat session-wide warnings list"
    - "Finish screen re-derives its summary straight from SQLite (never sessionStore) so both the normal Finish flow and the D-14 crash-resume 'Finish Now' path (which never mounts session.tsx) produce a correct summary"

key-files:
  created:
    - apps/mobile/lib/finishWorkout.ts
  modified:
    - apps/mobile/app/session/finish.tsx
    - apps/mobile/components/session/HSSBreakdownSheet.tsx
    - apps/mobile/components/session/SetRow.tsx

key-decisions:
  - "finishWorkout is called from finish.tsx's Done action (not just session.tsx's Finish button) so the D-14 'Finish Now' crash-resume path — which navigates straight to /session/finish without ever setting finishedAt — no longer leaves the open-session invariant dangling"
  - "Per-exercise HSS breakdown and per-set warning badges are computed by re-running the engine's own strengthStressDetailed/carryStressDetailed functions on the relevant subset of committed sets, rather than piping attribution through sessionStore — the engine's warnings[]/perSetStress are flat, unindexed lists with no set id, so this was the only way to get true per-set/per-exercise attribution without changing the engine's public contract"
  - "Discard menu implemented as a plain custom Pressable dropdown + RN Modal confirm dialog (no third-party menu/actionsheet library) per UI-SPEC's 'plain RN components, no third-party UI kit' rule"
  - "Per-exercise 'volume' in the finish summary is tonnage (sum of loadKg x reps, warmups excluded) for reps-mode exercises, and total duration for timed/carry exercises — not specified precisely in CONTEXT.md/UI-SPEC, resolved as Claude's Discretion following standard training-log convention"

patterns-established:
  - "Menu-gated destructive action: a 44x44 '...' icon button opens a small absolute-positioned dropdown (backdrop-dismiss), never placed adjacent to the primary CTA, for any future destructive-but-recoverable action"

requirements-completed: [LIFT-07]

coverage:
  - id: D1
    description: "Finishing a workout marks it finished (finishedAt) and shows a summary: big session HSS, per-exercise volume/set counts, and the engine warnings list"
    requirement: "LIFT-07"
    verification:
      - kind: unit
        ref: "npx tsc --noEmit (apps/mobile) — clean compile of finish.tsx's SQLite-driven summary query + sessionHSSDetailed call"
        status: pass
    human_judgment: true
    rationale: "Requires running the app on-device to verify the summary renders correctly with real committed sets — no test harness exists for this screen yet"
  - id: D2
    description: "Discard lives behind a menu (never adjacent to Finish) with a confirm dialog, and is a soft delete (deletedAt) excluding the session from all history/HSS/load queries"
    requirement: "LIFT-07"
    verification:
      - kind: unit
        ref: "pnpm --filter @apsis/db test — soft-delete.test.ts (17 tests) confirms activeWorkoutFilter excludes deletedAt rows"
        status: pass
      - kind: other
        ref: "grep -n \"All logged sets will be removed and can't be recovered from the app\" apps/mobile/app/session/finish.tsx"
        status: pass
    human_judgment: true
    rationale: "Menu-not-adjacent-to-Done placement and the confirm-dialog visual flow need on-device verification"
  - id: D3
    description: "Tapping the live HSS opens a breakdown sheet showing per-exercise stress subtotals + set counts + session total, no raw formula internals"
    requirement: "LIFT-07"
    verification:
      - kind: unit
        ref: "npx tsc --noEmit (apps/mobile) — clean compile of HSSBreakdownSheet.tsx's per-exercise rollup"
        status: pass
      - kind: other
        ref: "grep -n \"kStrength\\|kEndurance\\|kCarry\" apps/mobile/components/session/HSSBreakdownSheet.tsx (no code matches, only doc-comment prose)"
        status: pass
    human_judgment: true
    rationale: "Visual verification of the bottom sheet's per-exercise list requires on-device rendering"
  - id: D4
    description: "Engine warnings surface as a subtle badge on the affected set row (tap for message) plus the full list on finish"
    requirement: "LIFT-07"
    verification:
      - kind: unit
        ref: "pnpm --filter @apsis/engine test (77 tests) — strengthStressDetailed/carryStressDetailed warnings[] behavior SetRow.tsx now calls directly"
        status: pass
    human_judgment: true
    rationale: "Badge visibility, tap-to-expand, and non-blocking behavior require on-device interaction to confirm"

duration: 15min
completed: 2026-07-09
status: complete
---

# Phase 03 Plan 08: Session Finish/Discard/Breakdown/Warnings Summary

**Finish summary, breakdown sheet, and warning badges all re-derive their numbers by calling the real engine functions (strengthStressDetailed/carryStressDetailed) directly, since sessionHSSDetailed's warnings/perSetStress carry no set id for attribution.**

## Performance

- **Duration:** ~15 min
- **Completed:** 2026-07-09
- **Tasks:** 2
- **Files modified:** 4 (1 created, 3 modified)

## Accomplishments
- `finishWorkout`/`discardWorkout` lib helpers close a real D-14 gap: the crash-resume "Finish Now" path never set `finishedAt` before this plan, now Done always does
- Finish summary re-queries SQLite directly (not sessionStore) so it's correct on both the normal Finish path and the "Finish Now" resume path where the store was never populated
- Discard is menu-gated (custom "..." dropdown, never adjacent to Done), confirmed with the exact UI-SPEC copy, and soft-deletes via the Plan 02 `softDeleteWorkout` builder
- HSS breakdown sheet rolls up per-exercise stress subtotals from committed sets using the same per-set formulas the real recompute uses, ending in the authoritative `liveHss` session total, with zero formula/config leakage
- Set-row warning badges are now driven by real engine output (re-running `strengthStressDetailed`/`carryStressDetailed` for the single set) instead of an always-empty stub field, with tap-to-expand and no blocking of the logging loop

## Task Commits

Each task was committed atomically:

1. **Task 1: Finish summary + finishWorkout + menu-gated confirmed soft-delete discard** - `a73d050` (feat)
2. **Task 2: HSS breakdown sheet (D-24) + set-row warning badges (D-29)** - `e604ea0` (feat)

## Files Created/Modified
- `apps/mobile/lib/finishWorkout.ts` - `finishWorkout` (sets `workout.finishedAt`) and `discardWorkout` (soft delete via `softDeleteWorkout`)
- `apps/mobile/app/session/finish.tsx` - Fleshed out: big HSS, per-exercise volume/set-count list, warnings list, "..." menu + confirm-dialog discard
- `apps/mobile/components/session/HSSBreakdownSheet.tsx` - Fleshed out: per-exercise subtotal rows + session total, `@gorhom/bottom-sheet` `BottomSheetScrollView`
- `apps/mobile/components/session/SetRow.tsx` - Warning badge now computed from real per-set engine warnings; tap toggles an inline message

## Decisions Made
- `finishWorkout` called from Done (not just session.tsx's Finish button) — fixes a pre-existing gap where "Finish Now" (crash-resume path) never set `finishedAt`
- Per-set/per-exercise warning and stress attribution done by re-running the engine's own detail functions on a subset of committed sets, because the engine's flat `warnings[]`/`perSetStress[]` carry no set id
- Custom Pressable dropdown + RN `Modal` for the discard menu/confirm dialog (no third-party menu library, per UI-SPEC's plain-RN-components rule)
- "Volume" = tonnage (loadKg × reps, warmups excluded) for reps-mode exercises, total duration for timed/carry exercises — not pinned down in CONTEXT.md, resolved as Claude's Discretion

## Deviations from Plan

None — plan executed exactly as written. The attribution mechanism (re-running engine functions locally instead of piping warnings through `sessionStore`) was an implementation-detail choice within the plan's stated files_modified scope, not a deviation from any stated must-have or acceptance criterion; `sessionStore.ts` was not touched.

## Issues Encountered
- `SetDraft.warning` (an optional field scaffolded by Plan 06, commented "populated by Plan 08") is left unpopulated — the actual warning badge in `SetRow.tsx` now computes its own warnings locally instead of reading that field, since the engine's warnings have no set id to attribute through the store. The field is harmless dead state; not removed since `sessionStore.ts` is outside this plan's `files_modified`.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- LIFT-07 (save/discard with confirm + session HSS on finish) is code-complete; on-device UAT still needed (all four coverage items above are `human_judgment: true`) to confirm visual placement, tap-to-expand badge behavior, and the confirm-dialog flow
- Plan 09 (if any remaining Phase 3 work) or Phase 4 (Home/readiness) can proceed — this plan didn't touch navigation, schema, or the engine's public contract

---
*Phase: 03-onboarding-lifting-logger*
*Completed: 2026-07-09*

## Self-Check: PASSED

All created/modified files found on disk; both task commits (`a73d050`, `e604ea0`) verified present in git history.
