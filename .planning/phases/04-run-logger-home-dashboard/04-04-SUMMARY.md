---
phase: 04-run-logger-home-dashboard
plan: 04
subsystem: ui
tags: [react-native, react-native-svg, reanimated, typography, home-dashboard]

requires:
  - phase: 04-02
    provides: react-native-svg 15.15.4, victory-native + Skia + reanimated peer deps installed
provides:
  - HssRing.tsx (shared 200px home / 84px finish mini ring, capped-fill volt arc + calibrating variant)
  - PlateOrbit.tsx (calibrating-state rotating bone plate mark)
  - ReadinessLight.tsx (pulsing semantic status dot + mono label)
  - StatTiles.tsx (ATL/CTL/TSB tap-to-explain tiles)
  - Typography.displayXl (60px Archivo_900Black role)
affects: [04-06 (finish screen retrofit), 04-07 (TODAY screen)]

tech-stack:
  added: []
  patterns:
    - "SVG stroke-dashoffset ring shared across two sizes via a size>=200 home/mini branch, with RING_FILL_REFERENCE_HSS=200 capping only the visual fill fraction, never the displayed number"
    - "Reanimated withRepeat(withTiming(...), -1, true) for calm pulse/rotation loops (ReadinessLight, PlateOrbit), matching LiveHssHeader's existing withTiming count-up convention"

key-files:
  created:
    - apps/mobile/components/home/HssRing.tsx
    - apps/mobile/components/home/PlateOrbit.tsx
    - apps/mobile/components/home/ReadinessLight.tsx
    - apps/mobile/components/home/StatTiles.tsx
  modified:
    - apps/mobile/constants/theme.ts

key-decisions:
  - "HssRing branches home-vs-mini styling on `size >= 200` rather than a separate boolean prop -- matches the plan's exact two-values-only contract (200 | 84) and avoids an extra prop"
  - "Mini ring (84px) sub-label placed BELOW the ring, not inside -- executor discretion explicitly granted in 04-UI-SPEC.md since 84px is too small for a 22px number + legible mono line together"
  - "StatTiles tap-to-explain uses a Reanimated opacity cross-fade (~200ms) rather than RN LayoutAnimation -- no existing crossfade precedent in the codebase, and Reanimated is already the project's animation library (LiveHssHeader)"

requirements-completed: [HOME-01, HOME-02]

coverage:
  - id: D1
    description: "HssRing renders the capped-fill volt arc + exact-rounded count-up number at both 200px and 84px from one component"
    requirement: "HOME-01"
    verification:
      - kind: manual_procedural
        ref: "grep RING_FILL_REFERENCE_HSS/react-native-svg in HssRing.tsx (task verify); on-device UAT deferred to phase gate"
        status: pass
    human_judgment: true
    rationale: "Visual fill-cap/count-up animation and calibrating-variant correctness require on-device rendering; phase UAT gate is the verification point per plan's own <verification> section."
  - id: D2
    description: "HssRing calibrating variant (all-steel ring + PlateOrbit + BUILDING TREND/DAY N caption, no volt arc)"
    requirement: "HOME-01"
    verification: []
    human_judgment: true
    rationale: "Requires visual on-device confirmation that no volt arc renders and PlateOrbit mounts/rotates correctly; deferred to phase UAT per plan."
  - id: D3
    description: "ReadinessLight maps green/amber/red to volt/amber/molten with exact PRIMED/CAUTION/OVERREACHING copy and hides during calibration"
    requirement: "HOME-01"
    verification:
      - kind: unit
        ref: "grep PRIMED/CAUTION/OVERREACHING in ReadinessLight.tsx (task verify)"
        status: pass
    human_judgment: true
    rationale: "Pulse timing/visual color correctness on-device still needs human confirmation per phase UAT gate; the copy/logic grep only proves strings exist, not rendered behavior."
  - id: D4
    description: "StatTiles renders ATL/CTL/TSB with bone numbers, mono captions, sign-prefixed TSB, and tap-to-explain flip"
    requirement: "HOME-02"
    verification:
      - kind: unit
        ref: "grep ACUTE/CHRONIC/BALANCE in StatTiles.tsx (task verify)"
        status: pass
    human_judgment: true
    rationale: "Tap-flip animation and visual bone-vs-volt color correctness require on-device confirmation; deferred to phase UAT gate per plan's <verification> section."

duration: ~12min
completed: 2026-07-10
status: complete
---

# Phase 04 Plan 04: Home Hero Components Summary

**Four palette-correct, props-driven home components (HssRing, PlateOrbit, ReadinessLight, StatTiles) sharing one new Typography.displayXl role, ready to be consumed by the TODAY screen and finish mini-ring.**

## Performance

- **Duration:** ~12 min
- **Tasks:** 3
- **Files modified:** 5 (4 created, 1 modified)

## Accomplishments
- `HssRing.tsx`: a single react-native-svg stroke-ring component serving both the 200px home hero and the 84px finish mini-ring, with `RING_FILL_REFERENCE_HSS = 200` capping only the visual arc (`fillFraction = Math.min(hss/200, 1)`) while the displayed number is always the exact `Math.round(hss)`; a calibrating variant renders an all-steel ring with `PlateOrbit` + "BUILDING TREND · DAY N/14" in place of the volt arc and number.
- `PlateOrbit.tsx`: two nested bone SVG ellipses tilted -30deg with a continuous 6s linear Reanimated rotation, no runner glyph (D-08).
- `ReadinessLight.tsx`: 8px pulsing dot + mono label mapping green/amber/red to volt/amber/molten with the exact "PRIMED · GREEN LIGHT" / "CAUTION · HOLD STEADY" / "OVERREACHING · RED ZONE" copy; renders `null` when calibrating; same calm ~1.2s pulse rate for every band (no red speed-up).
- `StatTiles.tsx`: three equal-width carbon tiles for ATL/CTL/TSB with heading-size bone numbers (One-Volt Discipline) and mono ash captions; TSB always shows an explicit sign; tapping a tile ~200ms opacity cross-fades to its verbatim UI-SPEC explainer line.
- `Typography.displayXl` added to `constants/theme.ts` (60px Archivo_900Black, uppercase, ~54 line-height) for the home ring's count-up number only — no existing role sizes were touched.

## Task Commits

1. **Task 1: Typography.displayXl + HssRing + PlateOrbit** - `15862df` (feat)
2. **Task 2: ReadinessLight** - `0336e23` (feat)
3. **Task 3: StatTiles** - `0221cbe` (feat)

**Plan metadata:** (pending — this commit)

## Files Created/Modified
- `apps/mobile/components/home/HssRing.tsx` - shared SVG ring (200px home / 84px mini), capped-fill arc, count-up, calibrating variant, ring-tap Pressable
- `apps/mobile/components/home/PlateOrbit.tsx` - rotating nested-ellipse plate mark for the calibrating state
- `apps/mobile/components/home/ReadinessLight.tsx` - pulsing semantic status dot + mono label
- `apps/mobile/components/home/StatTiles.tsx` - ATL/CTL/TSB tiles with tap-to-explain flip
- `apps/mobile/constants/theme.ts` - added `Typography.displayXl` role

## Decisions Made
- HssRing determines home-vs-mini styling via `size >= 200` (no separate boolean prop) since the contract only ever passes 200 or 84.
- Mini ring's "HYBRID STRESS" sub-label renders below the ring rather than inside it — the UI-SPEC explicitly leaves this as executor discretion for the 84px size only (the 200px home ring's label MUST be inside, and is).
- StatTiles' tap-to-explain animation uses Reanimated's `useSharedValue`/`withTiming` for the ~200ms opacity cross-fade rather than RN's `LayoutAnimation`, matching the project's existing Reanimated-only animation convention (`LiveHssHeader.tsx`).

## Deviations from Plan

None - plan executed exactly as written. All four components and the new typography role match the plan's `must_haves`, `artifacts_produced`, and per-task `acceptance_criteria` verbatim.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- All four components are pure, props-driven, and have zero DB/store dependencies, so they're ready for direct consumption by 04-06 (finish screen mini-ring retrofit) and 04-07 (TODAY screen assembly).
- `apps/mobile` typechecks with no NEW errors introduced by this plan's files (the two pre-existing `router.push` typed-route errors in `app/onboarding/review.tsx` and `components/ExternalLink.tsx`, already logged in STATE.md/03 deferred-items.md, are unchanged).
- On-device UAT for ring animation, calibrating-state rendering, readiness-light color/pulse, and stat-tile flip is explicitly deferred to the phase gate per this plan's own `<verification>` section — not a blocker for handing components to downstream plans, but should be confirmed before Phase 04 is marked complete.

---
*Phase: 04-run-logger-home-dashboard*
*Completed: 2026-07-10*

## Self-Check: PASSED

All 6 created/modified files confirmed present on disk; all 3 task commit hashes (`15862df`, `0336e23`, `0221cbe`) confirmed in git log.
