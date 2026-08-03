---
phase: 08-share-card-social-overlay
plan: 01
subsystem: infra
tags: [expo, expo-image-picker, expo-file-system, expo-sharing, app.json, native-deps]

# Dependency graph
requires:
  - phase: 06-deploy-prep
    provides: existing app.json plugins array shape (expo-camera precedent), 06-06 production-build gate concept
provides:
  - expo-image-picker (~56.0.22), expo-file-system (~56.0.8), expo-sharing (~56.0.23) declared in apps/mobile/package.json
  - app.json expo-image-picker config plugin with photosPermission (NSPhotoLibraryUsageDescription)
  - app.json expo-sharing auto-registered plugin entry (no permission string needed)
  - pnpm-lock.yaml synced entries for all three packages
  - Three new native deps recorded as a 06-06 production-build gate item
affects: [08-02, 08-04, 06-06]

# Actuals (#2632)
actuals:
  tokens: 2797
  tasks: 2
  commits: 1

# Tech tracking
tech-stack:
  added: [expo-image-picker ~56.0.22, expo-file-system ~56.0.8, expo-sharing ~56.0.23]
  patterns: []

key-files:
  created: []
  modified:
    - apps/mobile/package.json
    - apps/mobile/app.json
    - pnpm-lock.yaml

key-decisions:
  - "All three packages installed via `npx expo install` (never hand-pinned) so each resolved to its Expo-SDK-56-compatible line, per Phase 03/07 precedent"
  - "expo-image-picker's cameraPermission/microphonePermission plugin options left unset (undefined) rather than explicitly false -- expo's applyPermissions helper falls back to the existing infoPlist value when an option is undefined, so the pre-existing expo-camera-owned NSCameraUsageDescription string is preserved untouched"
  - "expo-sharing needed no manual app.json edit -- expo install auto-registered a bare 'expo-sharing' plugin entry with no config options, confirming RESEARCH's prediction that it carries no permission string"

patterns-established: []

requirements-completed: [D-06, D-08, D-15]

coverage:
  - id: D1
    description: "expo-image-picker, expo-file-system, and expo-sharing appear in apps/mobile/package.json at their SDK-56 lines"
    requirement: "D-06"
    verification:
      - kind: unit
        ref: "node -e dependency-presence check (task 2 automated verify)"
        status: pass
    human_judgment: false
  - id: D2
    description: "app.json declares the expo-image-picker config plugin with a photo-library permission string (NSPhotoLibraryUsageDescription via photosPermission)"
    requirement: "D-06"
    verification:
      - kind: other
        ref: "manual read of node_modules/expo-image-picker/plugin/build/withImagePicker.js confirming photosPermission maps to NSPhotoLibraryUsageDescription, plus git diff review of app.json"
        status: pass
    human_judgment: false
  - id: D3
    description: "typecheck passes clean with the three new deps declared and pnpm-lock.yaml synced"
    requirement: "D-15"
    verification:
      - kind: unit
        ref: "pnpm run typecheck (tsc --build tsconfig.json)"
        status: pass
    human_judgment: false
  - id: D4
    description: "The three new native deps are recorded as a 06-06 production-build gate"
    requirement: "D-08"
    verification: []
    human_judgment: true
    rationale: "Recorded as a documentation note in this SUMMARY (below); actual enforcement of the 06-06 build gate happens when Phase 06 Wave 2 runs the production EAS build, which is outside this plan's scope to verify"

duration: 8min
completed: 2026-08-03
status: complete
---

# Phase 8 Plan 1: Native Share-Card Dependencies Summary

**Installed expo-image-picker, expo-file-system, and expo-sharing at SDK-56 lines and configured the expo-image-picker photo-library permission in app.json, gated behind a blocking-human package-legitimacy checkpoint.**

## Performance

- **Duration:** 8 min (continuation session; prior agent session was cut off before any changes landed)
- **Started:** 2026-08-03T17:22:00Z
- **Completed:** 2026-08-03T17:30:32Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- Ran `npx expo install expo-image-picker expo-file-system expo-sharing` from `apps/mobile`, resolving to expo-image-picker ~56.0.22, expo-file-system ~56.0.8, expo-sharing ~56.0.23 (SDK-56-compatible lines, never hand-pinned to a 57.x tag)
- Added an `expo-image-picker` config-plugin entry to `app.json`'s `plugins` array with `photosPermission: "Apsis uses your photo library only to let you pick a background photo for a share card image."` -- verified against the installed package's plugin source (`withImagePicker.js`) that this option key maps to `NSPhotoLibraryUsageDescription`
- `expo-sharing` self-registered a bare `"expo-sharing"` plugin entry during install (no permission string required, confirmed by RESEARCH and by the actual install output)
- `pnpm-lock.yaml` updated in the same install, keeping it in sync with `package.json` for EAS's `--frozen-lockfile` install mode
- `pnpm run typecheck` (root `tsc --build`) exits 0 with the three new deps declared

## Task Commits

Each task was committed atomically:

1. **Task 1: Package legitimacy verification (3 SUS packages)** - checkpoint only, no code change (resolved: user responded "approved" to a prior agent session before this continuation was dispatched)
2. **Task 2: Install native deps via expo install and configure app.json photo permission** - `08c9b92` (feat)

**Plan metadata:** (this commit, following SUMMARY)

_Note: Task 1 was a `checkpoint:human-verify` gate with no file changes of its own -- the approval was captured before this continuation agent was spawned; verified via `git status`/`git log` at the start of this session that no prior commits or working-tree changes existed for this plan._

## Files Created/Modified
- `apps/mobile/package.json` - Added `expo-image-picker: ~56.0.22`, `expo-file-system: ~56.0.8`, `expo-sharing: ~56.0.23` to `dependencies`
- `apps/mobile/app.json` - Added `expo-sharing` (bare, auto-registered) and `expo-image-picker` (with `photosPermission`) entries to the `plugins` array
- `pnpm-lock.yaml` - Resolved lockfile entries for all three new packages and their transitive dependencies

## Decisions Made
- Installed via `npx expo install` (not `pnpm add`) so each package resolved to its Expo-SDK-56-compatible line automatically, matching the Phase 03/07 convention of never hand-pinning a 57.x tag
- Left `cameraPermission`/`microphonePermission` unset in the new `expo-image-picker` plugin entry rather than setting them to `false` -- confirmed by reading `node_modules/@expo/config-plugins/build/ios/Permissions.js`'s `applyPermissions` helper that an `undefined` option value falls back to the pre-existing `infoPlist` value (already set by the existing `expo-camera` plugin entry), so the camera permission string is left untouched by this change
- Did not run `expo prebuild` locally -- per the plan's explicit instruction and Phase 04 P02 precedent, the Windows host cannot prebuild `ios/`; native linking is deferred to the next EAS cloud dev build

## Deviations from Plan

None - plan executed exactly as written. The legitimacy checkpoint (Task 1) was already resolved as "approved" by the user in a prior session before this continuation agent was dispatched, per the checkpoint_state provided at spawn time; this continuation proceeded directly to Task 2 without re-asking.

## Issues Encountered
None. The `pnpm add` step run internally by `expo install` printed a routine "lockfile-only installation" warning (harmless, `node_modules` is hoisted at the monorepo root) and 5 pre-existing deprecated-subdependency warnings unrelated to this plan's packages -- neither blocked the install or typecheck.

## User Setup Required

None required for this plan specifically. Per 08-01's `user_setup` frontmatter and STATE.md's existing Phase 04/05 lesson, the three new native modules only link into the app after a fresh EAS dev-client build -- this is deferred to the on-device UAT step in a later Phase 8 plan (08-02/08-04), consistent with the existing Blockers/Concerns note that budgets an EAS build cycle per phase with new native deps.

**06-06 production-build gate:** expo-image-picker, expo-file-system, and expo-sharing are now added to the list of native dependencies that MUST all land in the single fresh Phase 06 Wave 2 (06-06) production EAS build, alongside the already-listed native deps from Phases 03/04/05/07 (react-native-svg, @shopify/react-native-skia, @kingstinct/react-native-healthkit, expo-camera, @sentry/react-native, etc.). No separate build was triggered by this plan (Windows host cannot prebuild `ios/` locally); this is a documentation-only gate entry for the eventual 06-06 build.

## Next Phase Readiness
- The native dependency surface for Phase 8 (photo picker, file I/O, native share sheet) is now declared and lockfile-synced -- Plan 08-02 (render/export pipeline) and Plan 08-04 (photo-first compose flow) can now write code against these packages' TypeScript APIs, though the actual native modules are not yet linked into a dev-client binary (requires an EAS build, deferred per Phase 04 P02 precedent)
- No blockers introduced by this plan. The existing Phase 06 Wave 2 blockers (Apple Developer membership confirmation, ASC app record, docs-site privacy page publish) remain outstanding and unrelated to this plan's scope

---
*Phase: 08-share-card-social-overlay*
*Completed: 2026-08-03*

## Self-Check: PASSED

- FOUND: apps/mobile/package.json
- FOUND: apps/mobile/app.json
- FOUND: pnpm-lock.yaml
- FOUND: commit 08c9b92
