---
phase: 07-nutrition-tracking
plan: 07
subsystem: infra
tags: [expo-camera, expo-text-extractor, apple-vision, ocr, barcode, camera-permission, pnpm, eas]

# Dependency graph
requires:
  - phase: 07-05
    provides: nutrition target recompute wrapper + setup flow the camera features' logging flows depend on
  - phase: 07-06
    provides: manual food logging (search/confirm/log) surfaces that 07-08 barcode and 07-09 label-scan feed into
provides:
  - expo-camera ~56.0.8 installed (CameraView barcode detection + takePictureAsync photo capture)
  - expo-text-extractor ^2.0.0 installed (Apple Vision VNRecognizeTextRequest on-device OCR)
  - NSCameraUsageDescription declared in app.json (infoPlist + expo-camera plugin tuple, mic disabled)
  - requestCameraPermission() never-throw gate in apps/mobile/lib/nutritionCameraAuth.ts
  - pnpm-lock.yaml synced — `pnpm install --frozen-lockfile` passes (EAS build gate)
affects: [07-08, 07-09, eas-dev-build, 06-07-submission-privacy-labels]

# Tech tracking
tech-stack:
  added: [expo-camera ~56.0.8, expo-text-extractor ^2.0.0]
  patterns: [never-throw native-permission gate (healthkitAuth analog) reused for camera]

key-files:
  created:
    - apps/mobile/lib/nutritionCameraAuth.ts
  modified:
    - apps/mobile/package.json
    - apps/mobile/app.json
    - pnpm-lock.yaml

key-decisions:
  - "expo-camera resolved to ~56.0.8 and expo-text-extractor to ^2.0.0 via npx expo install — SDK-56 resolver versions accepted, never hand-pinned to 57.x (Phase 03/04 precedent)"
  - "Camera plugin configured with microphonePermission:false + recordAudioAndroid:false — barcode scan and still-photo capture need no mic; avoids an undisclosed-permission App Store review surface"
  - "nutritionCameraAuth uses Camera.requestCameraPermissionsAsync() (non-hook API, verified against installed 56.0.8 .d.ts) so the gate is a plain async function like requestHealthKitAuthorization"
  - "NUTR-08/NUTR-11 NOT marked complete by this plan — it ships only their native prerequisites; 07-08 and 07-09 own those requirements and will mark them when the features exist"

patterns-established:
  - "Camera permission gate: all camera call sites (07-08 scan, 07-09 label-scan) must go through requestCameraPermission(), never call expo-camera permission APIs ad hoc"

requirements-completed: []

coverage:
  - id: D1
    description: "expo-camera + expo-text-extractor installed at SDK-56-resolved versions with synced pnpm-lock.yaml"
    verification:
      - kind: other
        ref: "grep -c 'expo-camera|expo-text-extractor' apps/mobile/package.json → 2; pnpm install --frozen-lockfile → clean"
        status: pass
    human_judgment: false
  - id: D2
    description: "iOS camera permission declared (NSCameraUsageDescription in app.json infoPlist + expo-camera plugin tuple)"
    requirement: NUTR-08
    verification:
      - kind: other
        ref: "grep -c NSCameraUsageDescription apps/mobile/app.json → 1"
        status: pass
    human_judgment: true
    rationale: "The permission prompt's legality/non-crash behavior is only observable on device after the fresh EAS dev build embeds the new native modules — cannot be proven from config alone."
  - id: D3
    description: "Never-throw requestCameraPermission() wrapper (returns boolean, logs [Apsis]-prefixed error, never throws)"
    verification:
      - kind: other
        ref: "pnpm --filter @apsis/mobile exec tsc --noEmit → clean; grep -c requestCameraPermission apps/mobile/lib/nutritionCameraAuth.ts → 3"
        status: pass
    human_judgment: false

# Metrics
duration: 9min
completed: 2026-07-13
status: complete
---

# Phase 07 Plan 07: Camera/OCR Native Modules Summary

**expo-camera ~56.0.8 + expo-text-extractor ^2.0.0 installed after human legitimacy approval, NSCameraUsageDescription declared (mic disabled), never-throw requestCameraPermission() gate added, lockfile synced for the EAS dev build**

## Performance

- **Duration:** ~9 min (excluding checkpoint wait)
- **Started:** 2026-07-13T22:11:32Z
- **Completed:** 2026-07-13T22:20:30Z
- **Tasks:** 2 (1 blocking-human checkpoint + 1 auto)
- **Files modified:** 4

## Accomplishments

- Both camera-dependent native modules installed via `npx expo install` at SDK-56-resolver versions (expo-camera ~56.0.8, expo-text-extractor ^2.0.0) — the native prerequisite for NUTR-08 (barcode) and NUTR-11 (label OCR)
- Package-legitimacy checkpoint (T-07-SC) resolved: user verified both npm pages and approved the exact package names; expo-text-extractor confirmed to have no postinstall script in the installed artifact
- iOS camera permission declared twice-consistently: static `ios.infoPlist.NSCameraUsageDescription` plus the expo-camera config plugin tuple with identical prompt copy; microphone/RECORD_AUDIO explicitly disabled (barcode + still photo need no audio)
- `apps/mobile/lib/nutritionCameraAuth.ts` ships the house never-throw permission gate (`requestCameraPermission(): Promise<boolean>`) that 07-08 scan and 07-09 label-scan will consume
- `pnpm install --frozen-lockfile` passes — the EAS build's install step will not reject the lockfile (Pitfall 1 / Phase 04 ec76663 precedent)

## Task Commits

Each task was committed atomically:

1. **Task 1: Package legitimacy verification** — no commit (blocking-human checkpoint; user replied "approved" for both packages exactly as named)
2. **Task 2: Install native modules + camera permission + permission wrapper + lock sync** — `4b578c1` (feat)

## Files Created/Modified

- `apps/mobile/package.json` — adds `expo-camera ~56.0.8`, `expo-text-extractor ^2.0.0`; expo-barcode-scanner and react-native-vision-camera confirmed absent
- `apps/mobile/app.json` — `NSCameraUsageDescription` under ios.infoPlist + `expo-camera` plugin tuple (`cameraPermission` copy, `microphonePermission: false`, `recordAudioAndroid: false`); `ITSAppUsesNonExemptEncryption` unchanged
- `apps/mobile/lib/nutritionCameraAuth.ts` — `requestCameraPermission()` never-throw gate (healthkitAuth try/catch/`[Apsis]` console.error/return-false shape)
- `pnpm-lock.yaml` — synced (+79/-2, additive only)

## Decisions Made

- Accepted `expo install`'s SDK-56 resolution (~56.0.8 / ^2.0.0), never hand-pinning 57.x — Phase 03/04 precedent
- Disabled microphone permission and Android RECORD_AUDIO in the camera plugin: neither barcode detection nor `takePictureAsync` still capture uses audio, and an unused mic permission is App Store review surface with no benefit
- Used `Camera.requestCameraPermissionsAsync()` (verified against installed 56.0.8 `.d.ts` — `requestCameraPermissionsAsync` is not a bare named export, only reachable via the `Camera` namespace object) instead of the `useCameraPermissions` hook, keeping the gate a plain async function callable outside React, matching `requestHealthKitAuthorization`
- Did NOT run `requirements mark-complete` for NUTR-08/NUTR-11: this plan delivers only their native prerequisites; 07-08 and 07-09 declare and own those requirement IDs and will mark them when barcode scan / label OCR actually ship. Marking now would falsely satisfy them if the phase tail is cut under deadline pressure (07-CONTEXT cut-line policy).

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- First `npx expo install` attempt failed at the node_modules link step with a Windows `EPERM` rename on `node_modules/zxing-wasm` (expo-camera's web-barcode transitive dep) — consistent with the running Metro dev server's file watcher holding handles (known environment condition; orchestrator owns Metro). package.json changes were rolled back by pnpm. A straight retry succeeded in 5.9s with identical resolution. No workaround code needed.

## User Setup Required

**External services require manual configuration** (from this plan's `user_setup` frontmatter):

1. **USDA FoodData Central API key** — `EXPO_PUBLIC_USDA_FDC_API_KEY` from https://fdc.nal.usda.gov/api-key-signup (free self-serve; store as an EAS secret). DEMO_KEY (30/hr) is dev-only.
2. **EAS dev build (BLOCKING for on-device camera/OCR testing)** — expo-camera and expo-text-extractor are native modules the current dev client does not contain. Run `eas build --profile development --platform ios` now that the lockfile is synced (`--frozen-lockfile` verified passing). This is an external action for the user/orchestrator — deliberately NOT run by this executor. Same gate as Phase 04 Skia / Phase 05 HealthKit.

## Next Phase Readiness

- 07-08 (barcode scan) and 07-09 (label OCR) can now import `CameraView`/`scanFromURLAsync` from expo-camera and `extractTextFromImage` from expo-text-extractor, and must gate camera access through `requestCameraPermission()`
- On-device testing of anything camera-dependent is blocked until the fresh EAS dev build lands on the device (user_setup item 2)
- Reminder for 06-07 privacy labels: camera usage (on-device only, no capture leaves the device) is a new App Store privacy-label consideration alongside the already-flagged OFF/USDA network lookups

## Self-Check: PASSED

- FOUND: apps/mobile/lib/nutritionCameraAuth.ts
- FOUND: commit 4b578c1

---
*Phase: 07-nutrition-tracking*
*Completed: 2026-07-13*
