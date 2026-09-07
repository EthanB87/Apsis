---
phase: 05-healthkit-integration
plan: 01
subsystem: infra
tags: [healthkit, nitro-modules, expo-config-plugin, eas-build, ios]

# Dependency graph
requires:
  - phase: 04-hss-dashboard
    provides: op-sqlite/drizzle db layer, Skia/victory-native charts, EAS dev build + prebuild pipeline established
provides:
  - "@kingstinct/react-native-healthkit@^14.0.2 + react-native-nitro-modules@^0.36.1 installed and linked"
  - "Expo config plugin wired with HealthKit entitlement + NSHealthShareUsageDescription/NSHealthUpdateUsageDescription, background delivery explicitly disabled"
  - "pnpm-lock.yaml regenerated and verified against --frozen-lockfile"
  - "First Nitro-based EAS dev build validated on a physical iOS device with HealthKit capability enabled on the Apple Developer bundle id"
affects: [05-02, 05-03, 05-04, 05-05, 05-06, 05-07, 05-08, 05-09]

# Tech tracking
tech-stack:
  added: ["@kingstinct/react-native-healthkit@^14.0.2", "react-native-nitro-modules@^0.36.1"]
  patterns:
    - "Package-legitimacy checkpoint (gate=blocking-human) required before any [SUS]-flagged dependency install, never auto-approved even under auto_advance"
    - "HealthKit capability must be added to the Apple Developer App ID (com.apsis.app) and a fresh provisioning profile regenerated before an EAS build embeds the entitlement — cannot be discovered until the build fails"

key-files:
  created: []
  modified:
    - apps/mobile/package.json
    - apps/mobile/app.json
    - pnpm-lock.yaml

key-decisions:
  - "Installed @kingstinct/react-native-healthkit@^14.0.2 (Nitro rewrite) per RESEARCH Pitfall 1, overriding the CLAUDE.md-stated ~8.2.0 pin which predates the Nitro architecture"
  - "Explicitly set background:false on the config plugin since its default is background-delivery enabled, which would violate D-02 (Rule 2 deviation, documented in the Task 2 commit)"
  - "EAS provisioning-profile failures required an interactive `eas build` run (not the scripted/CI path) so the developer could authenticate to Apple, add the HealthKit capability to com.apsis.app, and regenerate the AdHoc profile before a build could embed the entitlement"

patterns-established:
  - "When an EAS build fails with a missing-entitlement provisioning error, the fix is Apple-Developer-side (add capability + regenerate profile) and requires an interactive `eas build` session, not a scripted retry"

requirements-completed: [HK-01]

coverage:
  - id: D1
    description: "HealthKit + Nitro dependencies installed, config plugin wired with entitlement/usage strings and background delivery disabled, lockfile regenerated"
    requirement: "HK-01"
    verification:
      - kind: unit
        ref: "node -e version-assertion script over apps/mobile/package.json dependencies (Task 2 <verify> block)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Fresh EAS dev build with HealthKit entitlement boots on a physical iOS device with no Nitro/HealthKit native crash"
    verification:
      - kind: manual_procedural
        ref: "EAS build 694ca7a8-8b2a-4a4c-8c93-53823c49df35 installed on physical iPhone; user confirmed app launches with no redbox/crash"
        status: pass
    human_judgment: true
    rationale: "On-device native module boot verification cannot be automated — requires physical hardware and human observation of app launch behavior"

duration: ~35min (across two executor sessions, includes two failed EAS builds + provisioning profile fix)
completed: 2026-07-11
status: complete
---

# Phase 05 Plan 01: HealthKit + Nitro Native Stack Summary

**Installed @kingstinct/react-native-healthkit@^14.0.2 (Nitro-based) with its react-native-nitro-modules peer, wired the Expo config plugin with read/write usage descriptions and background delivery disabled, and validated the first Nitro-based EAS dev build on a physical device after fixing a missing HealthKit provisioning-profile entitlement.**

## Performance

- **Duration:** ~35 min across two executor sessions (continuation resumed after two checkpoints)
- **Started:** 2026-07-11T18:40:00Z (approx, first session)
- **Completed:** 2026-07-11T23:50:00Z (approx, continuation session)
- **Tasks:** 3/3 (1 package-legitimacy checkpoint, 1 auto install task, 1 human-verify build checkpoint)
- **Files modified:** 3 (apps/mobile/package.json, apps/mobile/app.json, pnpm-lock.yaml)

## Accomplishments
- `@kingstinct/react-native-healthkit@^14.0.2` and its mandatory `react-native-nitro-modules@^0.36.1` peer installed via pnpm and verified against `--frozen-lockfile`
- Expo config plugin wired into `app.json` with `NSHealthShareUsageDescription` and `NSHealthUpdateUsageDescription` strings and `background: false` explicitly set (plugin default is background-delivery enabled, which would violate D-02)
- Package-legitimacy checkpoint for `react-native-nitro-modules` [SUS] resolved — developer confirmed ~1M weekly downloads, maintainer `mrousavy` (VisionCamera author), legitimate npm/GitHub presence
- Discovered and fixed a real-world EAS provisioning gap: the first two dev builds failed because the com.apsis.app App ID lacked the HealthKit capability; the developer ran an interactive `eas build` session to authenticate to Apple, enable the capability, and regenerate the AdHoc profile
- Fresh EAS dev build (694ca7a8-8b2a-4a4c-8c93-53823c49df35, FINISHED) installed on a physical iPhone; developer confirmed the app boots with the HealthKit/Nitro native module linked and no redbox/crash

## Task Commits

Each task was committed atomically:

1. **Task 1: Package legitimacy checkpoint — react-native-nitro-modules [SUS]** - resolved via checkpoint approval (no commit; verification-only gate)
2. **Task 2: Install HealthKit + Nitro deps and wire the config plugin** - `b699516` (feat)
3. **Task 3: Fresh EAS dev build + on-device HealthKit-availability smoke check** - resolved via checkpoint approval after two failed builds + interactive provisioning-profile fix (no code commit; build/provisioning artifacts live in the EAS project, not the repo)

**Plan metadata:** (this commit) `docs(05-01): complete HealthKit + Nitro install plan`

## Files Created/Modified
- `apps/mobile/package.json` - Added `@kingstinct/react-native-healthkit@^14.0.2` and `react-native-nitro-modules@^0.36.1` dependencies
- `apps/mobile/app.json` - Added the `@kingstinct/react-native-healthkit` config plugin entry with usage-description strings and `background: false`
- `pnpm-lock.yaml` - Regenerated to keep EAS's `--frozen-lockfile` install in sync (Phase 04 failure precedent)

## Decisions Made
- Installed the `^14.0.2` Nitro-rewrite line of `@kingstinct/react-native-healthkit` instead of the CLAUDE.md-stated `~8.2.0` pin, per RESEARCH.md Pitfall 1 — the 8.x line predates the Nitro architecture and would not match the `react-native-nitro-modules` peer dependency.
- Explicitly set `background: false` on the config plugin (Rule 2 deviation) because the plugin defaults background delivery to `true`, which would violate decision D-02 (no background HealthKit delivery in v1.0).
- Did not request or configure any bodyweight WRITE permission, per D-18 (bodyweight import is one-way, read-only).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Explicitly disabled background delivery on the config plugin**
- **Found during:** Task 2
- **Issue:** The `@kingstinct/react-native-healthkit` Expo config plugin defaults `background` to `true`, which would silently enable HealthKit background delivery — violating D-02.
- **Fix:** Added `"background": false` to the plugin config array in `app.json`.
- **Files modified:** `apps/mobile/app.json`
- **Verification:** Plugin config reviewed; `background: false` present in the committed `app.json`.
- **Committed in:** `b699516` (Task 2 commit)

### Deferred / Escalated Issues (not auto-fixable — Rule 3 exclusion)

**2. [Blocking, package-manager-adjacent — not auto-fixed] EAS provisioning profile missing HealthKit entitlement**
- **Found during:** Task 3
- **Issue:** The first two EAS dev builds (`c3cf3620`, `25c71c5c`) failed because the AdHoc provisioning profile for `com.apsis.app` did not include the HealthKit capability — Apple Developer account configuration, not a code defect, and outside auto-fix scope (this is an Apple-account-side change requiring interactive authentication, not something the executor can perform non-interactively).
- **Fix:** The developer ran `eas build -p ios --profile development` interactively, which authenticated to Apple, added the HealthKit capability to the `com.apsis.app` App ID, and regenerated the provisioning profile. The resulting build (`694ca7a8-8b2a-4a4c-8c93-53823c49df35`) finished successfully and was installed on a physical device.
- **Files modified:** None (Apple Developer Portal configuration change; no repo files affected)
- **Verification:** Build status `FINISHED`; developer confirmed on-device boot with no HealthKit/Nitro native crash ("approved").
- **Committed in:** N/A — no repo-side commit for this fix; captured here and in STATE.md as a lesson for future native-capability additions.

---

**Total deviations:** 2 (1 auto-fixed via Rule 2, 1 escalated to the human developer as an Apple-Developer-account-side blocker outside auto-fix scope)
**Impact on plan:** Both necessary — the background-delivery fix enforces an existing decision (D-02); the provisioning-profile fix was mandatory to unblock Task 3's on-device verification and is not something the executor can perform (requires interactive Apple authentication).

## Issues Encountered
- Two EAS dev builds failed back-to-back (`c3cf3620`, `25c71c5c`) due to the missing HealthKit capability on the App ID's provisioning profile. Resolved by the developer running an interactive `eas build` session that regenerated the profile with the capability included. See "Deviations from Plan" above for full detail. This is now a documented lesson (see STATE.md Blockers/Concerns) for any future plan that adds a new native capability/entitlement for the first time — budget for at least one provisioning-profile regeneration cycle.

## User Setup Required
None further required for this plan — the Apple Developer HealthKit capability (originally listed as `user_setup` in 05-01-PLAN.md) is now enabled on `com.apsis.app`, confirmed by the successful build.

## Next Phase Readiness
- HealthKit + Nitro native stack is installed, linked, and validated on a physical device — all downstream Phase 05 plans (05-02 through 05-09) that import/write/delete HealthKit samples are unblocked.
- The dev build used for Task 3 verification (`694ca7a8-8b2a-4a4c-8c93-53823c49df35`) is the current baseline dev client on the test device; subsequent plans that add further native changes should still budget for a fresh EAS build per the established Phase 04 precedent (lockfile sync + fresh build before on-device testing).
- No blockers for continuing into 05-02 (already executed per phase directory — this SUMMARY closes out 05-01 retroactively after the rest of the phase's plans had already landed).

---
*Phase: 05-healthkit-integration*
*Completed: 2026-07-11*
