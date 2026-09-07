---
phase: 04-run-logger-home-dashboard
plan: 02
subsystem: infra
tags: [victory-native, react-native-skia, react-native-svg, datetimepicker, expo, pnpm, supply-chain]

# Dependency graph
requires:
  - phase: 01-foundation
    provides: Expo SDK 56 monorepo scaffold, EAS dev profile, prebuild precedent (android local / ios via EAS cloud)
provides:
  - victory-native 41.26.0 installed (trend chart, HOME-03)
  - "@shopify/react-native-skia exact-pinned 2.6.9 (GPU canvas peer dep, human-verified legitimate)"
  - react-native-svg 15.15.4 installed (HSS ring primitive)
  - "@react-native-community/datetimepicker 9.1.0 installed + config plugin registered (RUN-04 date sheet)"
  - Native project prebuilt; Metro resolution gate passed for all four modules
affects: [04-03, 04-04, 04-05, 04-07, 04-08, home-dashboard, run-logger, trend-chart]

# Tech tracking
tech-stack:
  added: [victory-native@41.26.0, "@shopify/react-native-skia@2.6.9 (exact)", react-native-svg@15.15.4, "@react-native-community/datetimepicker@9.1.0"]
  patterns: [SUS-flagged packages gated behind blocking-human npmjs.com legitimacy checkpoint before install, exact-pin (no caret) for packages with frequent patch cadence until on-device verification]

key-files:
  created: []
  modified: [apps/mobile/package.json, apps/mobile/app.json, pnpm-lock.yaml]

key-decisions:
  - "react-native-svg resolved to 15.15.4 (expo install's SDK-56-compatible pick) rather than RESEARCH's 15.15.5 registry-latest — plan mandates expo-resolved versions, Phase 03 precedent"
  - "iOS prebuild not generatable on Windows host — android/ regenerated locally, ios/ deferred to EAS cloud build per Phase 1 precedent (c723e11); Metro export gate used as the local linking verification"
  - "@shopify/react-native-skia human-approved as legitimate (SUS flag = false positive from Shopify's frequent patch cadence) before install"

patterns-established:
  - "Supply-chain gate: SUS-audited packages require a blocking-human npmjs.com verification checkpoint that is never auto-approved"
  - "Pitfall-7 pinning: Skia stays literally 2.6.9 in package.json (no ^/~) until the phase is verified on-device"

requirements-completed: [RUN-04, HOME-03]

coverage:
  - id: D1
    description: "Four native modules (victory-native, Skia, react-native-svg, datetimepicker) installed at RESEARCH-verified versions with Skia exact-pinned to 2.6.9"
    verification:
      - kind: other
        ref: "node -e assert on apps/mobile/package.json dependencies (plan's automated verify) — skia === '2.6.9', other three present"
        status: pass
    human_judgment: false
  - id: D2
    description: "Native modules link and bundle — no missing-native-module error on device"
    requirement: HOME-03
    verification:
      - kind: other
        ref: "npx expo export --platform ios (Metro resolution gate, exit 0) + require.resolve on all four modules"
        status: pass
    human_judgment: true
    rationale: "Metro bundling proves JS resolution only; actual native linking (Skia GPU canvas, datetimepicker sheet) is only provable on a physical iOS device via an EAS dev build — Windows host cannot generate ios/ or run pods"

# Metrics
duration: 4min
completed: 2026-07-10
status: complete
---

# Phase 4 Plan 02: Native Deps for Chart/Ring/Date-Sheet Summary

**victory-native 41.26.0 + Skia exact-pinned 2.6.9 (human-verified legitimate) + react-native-svg 15.15.4 + datetimepicker 9.1.0 installed and Metro-gate verified; iOS native link deferred to EAS cloud build per Phase 1 Windows precedent**

## Performance

- **Duration:** 4 min (excluding checkpoint wait)
- **Started:** 2026-07-10T20:43:31Z
- **Completed:** 2026-07-10T20:47:51Z
- **Tasks:** 2 (1 blocking-human checkpoint + 1 auto)
- **Files modified:** 3

## Accomplishments

- Human legitimacy checkpoint on `@shopify/react-native-skia` (flagged SUS by the 04-RESEARCH audit) resolved: user confirmed on npmjs.com it is Shopify's official library and approved the pinned install — T-04-SC mitigation executed exactly as the threat model required
- All four Phase-4 native deps installed: `victory-native ^41.26.0` (resolved 41.26.0), `react-native-svg 15.15.4`, `@react-native-community/datetimepicker 9.1.0` via `npx expo install`; `@shopify/react-native-skia` at literal `2.6.9` (no caret) via `pnpm add --save-exact` per RESEARCH Pitfall 7
- Resolved Skia version confirmed inside victory-native's peer range `>=1.2.3 <3.0.0`; `react-native-reanimated` (4.3.1) and `react-native-gesture-handler` (~3.0.2) untouched — both already satisfy every peer requirement
- `expo install` auto-registered the `@react-native-community/datetimepicker` config plugin in app.json
- Prebuild ran (`npx expo prebuild --no-install`): android/ regenerated; Metro resolution gate (`npx expo export --platform ios`) exited 0 with all four modules resolving

## Task Commits

Each task was committed atomically:

1. **Checkpoint: Human-verify @shopify/react-native-skia legitimacy** - no commit (pre-install gate; user replied "approved")
2. **Task 1: Install the four native deps (Skia pinned exact) and prebuild** - `c9d2538` (chore)

## Files Created/Modified

- `apps/mobile/package.json` - four new dependencies; Skia literally `2.6.9`
- `apps/mobile/app.json` - `@react-native-community/datetimepicker` config plugin appended to plugins array
- `pnpm-lock.yaml` - lockfile resolution for the four packages

## Decisions Made

- **react-native-svg 15.15.4, not 15.15.5:** `npx expo install` resolved the SDK-56-compatible 15.15.4 instead of RESEARCH's registry-latest 15.15.5. Kept expo's resolution — the plan's action explicitly calls these "the three expo-resolved native deps," and Phase 03 established the "SDK-56-line versions via expo install, never hand-pinned" convention.
- **iOS prebuild deferred to EAS cloud:** `expo prebuild --platform ios` refuses to generate iOS project files on Windows. Followed Phase 1 precedent (commit c723e11): android/ generated locally (gitignored), ios/ produced by EAS cloud dev build, local linking verified via the Metro export gate.

## Deviations from Plan

None - plan executed exactly as written. (The iOS-prebuild-on-Windows limitation is not a deviation — it is the documented Phase 1 precedent the plan itself cites as "the existing dev-build step.")

## Issues Encountered

- **Node version warning (anticipated by plan):** Node 20.16.0 is installed; Expo CLI requests >=20.19.4 and printed "outdated and unsupported" warnings on every `expo` invocation. Nothing failed — install, prebuild, and export all completed with exit 0. Plan instructed to note and proceed. Recommend upgrading Node before the on-device EAS build wave.

## Known Stubs

None — this plan intentionally contains no product code.

## User Setup Required

None locally. The four native modules cannot run in Expo Go — the next on-device session requires a fresh EAS dev build (`eas build --profile development --platform ios`) so the new native code is compiled in.

## Next Phase Readiness

- Wave-1 dep work complete: 04-03/04-04 (HSS ring via react-native-svg), 04-05 (datetimepicker date sheet), and 04-07 (victory-native trend chart) can now import their libraries
- Skia pin must stay literal `2.6.9` until phase UAT passes on-device (RESEARCH Pitfall 7)
- On-device verification of native linking is deferred to the phase's EAS dev build / UAT (coverage D2 flagged human_judgment)

## Self-Check: PASSED

- apps/mobile/package.json — FOUND (skia === "2.6.9", all four deps present, reanimated/gesture-handler unchanged)
- Commit c9d2538 — FOUND in git log
- Plan's automated verify — "deps ok" (exit 0)

---
*Phase: 04-run-logger-home-dashboard*
*Completed: 2026-07-10*
