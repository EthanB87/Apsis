---
phase: quick
plan: 260709-qmv
subsystem: mobile-ui
tags: [design-system, theming, typography, branding, expo]
dependency-graph:
  requires: []
  provides:
    - "apps/mobile/constants/Colors.ts void/volt palette (steel, onAccent keys)"
    - "apps/mobile/constants/theme.ts Radius tokens + fontFamily-bearing Typography + Mono role"
    - "Apsis app icon + plate mark assets wired into apps/mobile/assets/images"
  affects:
    - "All 23 styled screens/components under apps/mobile/app and apps/mobile/components"
tech-stack:
  added:
    - "@expo-google-fonts/archivo ^0.4.2"
    - "@expo-google-fonts/jetbrains-mono ^0.4.1"
  patterns:
    - "Single design-token source of truth (Colors.ts + theme.ts) propagates through existing imports — no per-screen hex literals"
    - "Mono typography role reserved for data/telemetry (metrics, units, timestamps, countdowns); Typography.display reserved for HSS/hero numbers only"
key-files:
  created:
    - apps/mobile/assets/images/apsis-plate-mark.png
    - .planning/quick/260709-qmv-restyle-app-ui-to-apsis-dark-design-syst/deferred-items.md
  modified:
    - apps/mobile/constants/Colors.ts
    - apps/mobile/constants/theme.ts
    - apps/mobile/app/_layout.tsx
    - apps/mobile/package.json
    - apps/mobile/components/StyledText.tsx
    - apps/mobile/components/BootStates.tsx
    - apps/mobile/components/onboarding/WizardStep.tsx
    - apps/mobile/components/onboarding/ProfileReview.tsx
    - apps/mobile/components/session/LiveHssHeader.tsx
    - apps/mobile/components/session/SetRow.tsx
    - apps/mobile/components/session/ExerciseCard.tsx
    - apps/mobile/components/session/ExercisePickerSheet.tsx
    - apps/mobile/components/session/HSSBreakdownSheet.tsx
    - apps/mobile/components/session/RestTimerBanner.tsx
    - apps/mobile/app/(tabs)/_layout.tsx
    - apps/mobile/app/(tabs)/log/index.tsx
    - apps/mobile/app/(tabs)/log/session.tsx
    - apps/mobile/app/(tabs)/settings/index.tsx
    - apps/mobile/app/onboarding/sex.tsx
    - apps/mobile/app/onboarding/units.tsx
    - apps/mobile/app/onboarding/threshold-hr.tsx
    - apps/mobile/app/onboarding/threshold-pace.tsx
    - apps/mobile/app/session/finish.tsx
    - apps/mobile/app/modal.tsx
    - apps/mobile/app/+not-found.tsx
    - apps/mobile/app/+html.tsx
    - apps/mobile/app.json
    - apps/mobile/assets/images/icon.png
    - apps/mobile/assets/images/splash-icon.png
    - apps/mobile/assets/images/favicon.png
decisions:
  - "onAccent (#0B0C0E) applied to every volt-filled CTA/pill/chip label found across the app, not just the sites the plan named explicitly — the 'never bone-on-volt' rule is a hard design constraint, so every discovered accent-fill site was swept, not only the named examples"
  - "Root-level app.json (stray eas init artifact, bundleIdentifier com.apsistraining.apsis) intentionally NOT deleted, per an explicit runtime override instruction that superseded the plan's step 3 action — left untouched and undocumented in git for user decision"
  - "Chose apsis_mark_1024.png (bare plate-mark glyph, transparent) for the splash image instead of the full apsis_icon_1024.png — reads cleaner on the void background per the plan's own suggested alternative"
  - "RestTimerBanner countdown and LiveHssHeader elapsed timer moved to the new Mono role (not Typography.display) per the plan's explicit rule 4 list, even though the countdown previously used Typography.display"
metrics:
  duration: "~55min"
  completed: "2026-07-09"
status: complete
---

# Quick Task 260709-qmv: Restyle App UI to Apsis Dark Design System Summary

Replaced the entire blue Expo-template palette with the Apsis "performance instrument, not
a diary" dark/volt design system (void #0B0C0E background, volt #C6F23D single accent,
molten #FF5A1F alert-only accent), added the Archivo Expanded (heavy) + JetBrains Mono
type system, and wired the real Apsis plate-mark app icon + dark splash — a pure visual
restyle across all 23 styled screens/components with zero logic changes.

## What Changed

**Task 1 — Token source of truth (`5dd8243`)**
- `constants/Colors.ts`: full void/carbon/steel/line/bone/ash/volt/molten palette. Added
  `steel` (raised surface/inactive track) and `onAccent` (void — the label color for every
  volt-filled CTA) keys. Kept the existing exported key shape so all 23 consumers kept
  compiling unmodified at the color layer.
- `constants/theme.ts`: added `Radius` tokens (`sm:6, md:8, lg:10`); gave `Typography.display`
  and `Typography.heading` `fontFamily: Archivo_900Black`/`Archivo_800ExtraBold`,
  `textTransform: 'uppercase'`, `letterSpacing: -0.5`, and bumped display to `fontSize: 40`
  for the HSS hero number; `body`/`label` moved to `Archivo_400Regular`/`Archivo_500Medium`;
  added a new `Mono` role (`JetBrainsMono_500Medium`, wide-tracked, uppercase) for
  telemetry-style data.
- Installed `@expo-google-fonts/archivo` and `@expo-google-fonts/jetbrains-mono` via
  `npx expo install` (resolved through the repo's pnpm workspace, per SDK 56 lockfile
  compatibility) — both official Expo-maintained, OFL-licensed packages.
- `app/_layout.tsx`: added a `useFonts` gate (from `expo-font`) loading
  `Archivo_400Regular/500Medium/800ExtraBold/900Black` and
  `JetBrainsMono_400Regular/500Medium`; extended the boot loading gate and splash-hide
  effect so the splash never hides — and `LoadingScreen` never dismisses — until both
  migrations AND fonts have settled.

**Task 2 — Propagation sweep (`3922c13`)**
- Applied `Colors.dark.onAccent` to every volt-filled CTA/pill/chip label discovered across
  the app (BootStates, WizardStep, ProfileReview, LiveHssHeader's Finish button, log/index's
  Start Workout, Settings' retry/choice/sex-option/modal-primary buttons, all onboarding
  mode-buttons, finish.tsx's Done button) — bone-on-volt is now eliminated everywhere.
- Applied the new `Mono` role to data/telemetry text: SetRow's load/reps/RPE values and unit
  labels, ExerciseCard's metadata line, HSSBreakdownSheet's numeric breakdown,
  RestTimerBanner's countdown, LiveHssHeader's elapsed timer, finish.tsx's exercise metadata
  lines, and Settings' version footer.
- Replaced remaining hardcoded hex literals: BootStates' loading spinner/text/error colors
  and white container background, modal.tsx's separator colors, +not-found.tsx's link color,
  and +html.tsx's SSR body background (the one place a raw hex literal is unavoidable —
  documented inline).
- `StyledText.tsx`'s `MonoText` now uses `JetBrainsMono_500Medium` instead of `SpaceMono`.
- Tab bar (`(tabs)/_layout.tsx`): added a hairline top border (`Colors[colorScheme].border`)
  and swapped the Home tab's `house.fill` SF Symbol for the Apsis plate-mark image, tinted
  via the tab bar's `color` param so it reads volt when active.
- Swept ad-hoc `borderRadius: 12/16/24` literals to `Radius.lg`/`Radius.md` tokens across
  onboarding, session, and settings screens for the "sharp, not pillowy" shape language.
- Logged two pre-existing, unrelated typecheck errors (`onboarding/review.tsx`'s
  `router.push` typed-routes mismatch, `ExternalLink.tsx`'s same `Href` mismatch) to
  `deferred-items.md` — verified present on the pre-task commit via `git stash` +
  `pnpm run typecheck`, confirming they predate this restyle and are out of this plan's
  scope.

**Task 3 — Icon + splash wiring (`430cf23`)**
- Copied `apsis_icon_1024.png` → `assets/images/icon.png`, `apsis_mark_1024.png` (bare glyph,
  reads cleaner on void) → `splash-icon.png`, `apsis_icon_256.png` → `favicon.png`, and
  `apsis_mark_512.png` (transparent) → `apsis-plate-mark.png` (the tab-bar mark).
- `app.json`: splash `backgroundColor` and Android `adaptiveIcon.backgroundColor` changed
  from white/light-blue to void `#0B0C0E`.
- **Root-level `app.json` was NOT deleted** — the runtime instructions for this execution
  explicitly overrode the plan's step 3 (delete the stray root `app.json`), directing it be
  left untouched, uncommitted, and undecided. It remains an untracked file at the repo root
  with `bundleIdentifier: com.apsistraining.apsis`, which differs from
  `apps/mobile/app.json`'s `com.apsis.app`. **This discrepancy is unresolved — the developer
  should confirm which bundle ID is intended for the App Store submission before EAS build.**

## Deviations from Plan

### Auto-fixed Issues

None beyond the sweep already described under Task 2 — no bugs/blocking issues were
encountered that required Rule 1/3 fixes outside the plan's declared scope.

### Rule 2 — Scope beyond the plan's named examples

**1. [Rule 2] onAccent applied to every discovered volt-fill site, not just the plan's named examples**
- **Found during:** Task 2
- **Issue:** The plan named specific sites (BootStates, LiveHssHeader, onboarding CTAs,
  review.tsx, finish.tsx) as bone-on-volt violations, but a full sweep of `app/` and
  `components/` turned up additional volt-filled controls not explicitly named: Settings'
  retry button, choice buttons (units/rest presets), sex-option pills, modal "Set" action;
  all four onboarding step mode-buttons (sex, units, threshold-hr, threshold-pace).
- **Fix:** Applied `Colors.dark.onAccent` to all of them — the "never bone-on-volt" rule is
  a hard design constraint stated in the plan's `must_haves.truths`, so completeness here
  is required for that truth to actually hold across "every app surface."
- **Files modified:** `apps/mobile/app/(tabs)/settings/index.tsx`, `apps/mobile/app/onboarding/sex.tsx`, `apps/mobile/app/onboarding/units.tsx`, `apps/mobile/app/onboarding/threshold-hr.tsx`, `apps/mobile/app/onboarding/threshold-pace.tsx`
- **Commit:** `3922c13`

### Instruction Override

**2. Root `app.json` deletion skipped per explicit runtime constraint**
- The plan's Task 3 step 3 instructed deleting the stray root-level `app.json`. The
  runtime instructions for this execution explicitly overrode that: "do NOT delete it, do
  NOT commit it; if the plan says to delete it, skip that action and note it in the SUMMARY
  as 'left for user decision.'" Honored verbatim — root `app.json` remains untracked and
  untouched. See the Task 3 write-up above for the bundleId discrepancy this leaves open.

## Known Stubs

None — this was a pure visual restyle; no new data-wiring stubs were introduced.

## Threat Flags

None — no new network endpoints, auth paths, or trust-boundary surface introduced. The one
threat register entry (`T-QMV-SC`, new npm font packages) was accepted per the plan's own
disposition; both packages installed cleanly with no substitution needed.

## Verification

- `pnpm run typecheck` (root): passes except two pre-existing, unrelated errors
  (`onboarding/review.tsx`, `ExternalLink.tsx` typed-routes `Href` mismatches), confirmed
  present before this task's changes via `git stash` + re-run. Logged in
  `deferred-items.md`.
- Zero occurrences of `3E8EF7` (old blue) under `apps/mobile/app` or `apps/mobile/components`.
- `Colors.ts` carries `steel` and `onAccent` keys alongside the full void/volt palette.
- Both `@expo-google-fonts/*` packages present in `apps/mobile/package.json`;
  `_layout.tsx` gates the splash on `useFonts`.
- `apps/mobile/assets/images/icon.png` is the new Apsis icon; `app.json` splash and
  Android adaptive-icon backgrounds are void `#0B0C0E`.

## Self-Check: PASSED

- FOUND: apps/mobile/constants/Colors.ts (steel + onAccent keys present)
- FOUND: apps/mobile/constants/theme.ts (Radius + Mono + fontFamily Typography present)
- FOUND: apps/mobile/assets/images/icon.png
- FOUND: apps/mobile/assets/images/apsis-plate-mark.png
- FOUND: apps/mobile/app.json (0B0C0E void splash/android backgrounds)
- FOUND commit 5dd8243 (Task 1 — token source of truth)
- FOUND commit 3922c13 (Task 2 — propagation sweep)
- FOUND commit 430cf23 (Task 3 — icon + splash wiring)
