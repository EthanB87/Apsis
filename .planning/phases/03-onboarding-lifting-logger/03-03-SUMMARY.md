---
phase: 03-onboarding-lifting-logger
plan: 03
subsystem: ui
tags: [expo-router, react-native, design-system, bottom-sheet, expo-notifications, expo-haptics, expo-crypto, zustand]

# Dependency graph
requires:
  - phase: 01-foundation
    provides: Expo SDK 56 app scaffold with expo-router tabs template, op-sqlite wired
  - phase: 02-hss-engine
    provides: pure-TS HSS engine (not consumed directly by this plan, but the Home tab this plan stubs is where it will eventually surface)
provides:
  - Five vetted npm dependencies installed at SDK-56-aligned versions (@gorhom/bottom-sheet, zustand, expo-crypto, expo-notifications, expo-haptics)
  - Dark-only design token system (constants/Colors.ts palette + constants/theme.ts spacing/typography/hit-target/tabularNums)
  - Three-tab app shell (Home/Log/Settings) replacing the default Expo template
  - Branded Home placeholder satisfying ONB-03 structurally (no readiness UI exists yet)
affects: [03-04, 03-05, 03-06, 03-07, 03-08, 03-09, phase-04-home-readiness]

# Tech tracking
tech-stack:
  added: ["@gorhom/bottom-sheet ^5.2.14", "zustand ^5.0.14", "expo-crypto ~56.0.4", "expo-notifications ~56.0.20", "expo-haptics ~56.0.3"]
  patterns: ["Dark-only theme: Colors.ts light/dark keys both resolve to the same palette object", "constants/theme.ts as the single source for spacing/typography/hit-target tokens, spread into StyleSheet.create() objects", "tabularNums style helper for all numeric UI per UI-SPEC"]

key-files:
  created: [apps/mobile/constants/theme.ts]
  modified: [apps/mobile/package.json, apps/mobile/app.json, apps/mobile/constants/Colors.ts, "apps/mobile/app/(tabs)/_layout.tsx", "apps/mobile/app/(tabs)/index.tsx"]

key-decisions:
  - "Used pnpm (not npm) to install @gorhom/bottom-sheet — the monorepo is pnpm-workspace-driven (pnpm-workspace.yaml + pnpm-lock.yaml); npm install would have written a conflicting package-lock.json and diverged from the workspace's single lockfile"
  - "All five deps resolved to SDK-56-line versions via npx expo install / pnpm add, never hand-pinned to the 57.x npm 'latest' tags, per RESEARCH.md's version-verification note"
  - "log and settings Tabs.Screen entries reference route groups that don't exist yet (created in Plans 06/09) — expo-router warns until then; this is expected within this wave"

patterns-established:
  - "Pattern: numeric UI must spread the tabularNums helper from constants/theme.ts alongside its typography role"

requirements-completed: [ONB-03]

coverage:
  - id: D1
    description: "Five new dependencies (@gorhom/bottom-sheet, zustand, expo-crypto, expo-notifications, expo-haptics) installed at SDK-56-aligned versions after a blocking human-verify legitimacy checkpoint"
    verification:
      - kind: other
        ref: "apps/mobile/package.json dependency block + `npx tsc --noEmit` clean"
        status: pass
    human_judgment: false
  - id: D2
    description: "Dark-only design token system: Colors.ts collapsed to the UI-SPEC palette, theme.ts exports spacing/typography/hit-target/tabularNums"
    requirement: "ONB-03"
    verification:
      - kind: other
        ref: "grep for #0C0E12/#181B20/#3E8EF7/#E5484D/#D9A441 in Colors.ts; `npx tsc --noEmit` clean"
        status: pass
    human_judgment: false
  - id: D3
    description: "Three-tab shell (Home/Log/Settings) with dark accent tint + surface tab bar background; Home tab is a branded placeholder with no session-summary UI"
    requirement: "ONB-03"
    verification:
      - kind: other
        ref: "grep for readiness/band/trend/chart in index.tsx returns nothing; `npx tsc --noEmit` clean"
        status: pass
    human_judgment: true
    rationale: "Visual rendering of the tab bar and placeholder screen (dark palette, correct tab icons, safe-area layout) requires a human to launch the app and look — this is deferred to phase UAT per the plan's own verification block."

duration: 6min
completed: 2026-07-09
status: complete
---

# Phase 03 Plan 03: App Shell & Dark Theme Foundation Summary

**Installed five vetted native-module deps via pnpm, collapsed the theme to a dark-only UI-SPEC design system, and replaced the default two-tab Expo template with the real Home/Log/Settings tab bar whose Home tab is a branded no-readiness placeholder.**

## Performance

- **Duration:** 6 min (continuation from Task 1 checkpoint)
- **Started:** 2026-07-09T19:58:37Z
- **Completed:** 2026-07-09T20:04:28Z
- **Tasks:** 3 (1 checkpoint + 2 auto, this session executed Tasks 2-3)
- **Files modified:** 8 (package.json, app.json, Colors.ts, theme.ts, pnpm-lock.yaml, _layout.tsx, index.tsx, two.tsx deleted)

## Accomplishments
- Installed @gorhom/bottom-sheet, zustand, expo-crypto, expo-notifications, expo-haptics at SDK-56-aligned versions after human approval of the package-legitimacy checkpoint
- Collapsed constants/Colors.ts to the exact UI-SPEC dark palette (#0C0E12/#181B20/#3E8EF7/#E5484D/#D9A441) and created constants/theme.ts with the spacing scale, 44pt hit-target constant, typography roles, and tabularNums helper
- Replaced the default two-tab template with a real Home/Log/Settings tab shell and rebuilt the Home tab as a branded "coming soon" placeholder that renders no readiness/session UI (ONB-03 satisfied structurally)

## Task Commits

Each task was committed atomically:

1. **Task 1: [BLOCKING] Package legitimacy verification** - checkpoint only, no commit (human approved all five packages)
2. **Task 2: Install deps via expo, dark-only theme tokens** - `cf1ccb8` (feat)
3. **Task 3: Home/Log/Settings tab shell + branded Home placeholder** - `fcc7968` (feat)

_Note: Task 1 was a blocking human-verify checkpoint with no file changes to commit._

## Files Created/Modified
- `apps/mobile/package.json` - Added @gorhom/bottom-sheet, zustand, expo-crypto, expo-notifications, expo-haptics
- `apps/mobile/app.json` - Added expo-notifications config plugin
- `apps/mobile/constants/Colors.ts` - Collapsed light/dark scaffold to a single dark palette
- `apps/mobile/constants/theme.ts` - New: spacing scale, HIT_TARGET_MIN, Typography roles, tabularNums helper
- `apps/mobile/app/(tabs)/_layout.tsx` - Three Tabs.Screen (index/log/settings), dark accent tint, surface tab bar
- `apps/mobile/app/(tabs)/index.tsx` - Rebuilt as the D-31 Home placeholder
- `apps/mobile/app/(tabs)/two.tsx` - Deleted (replaced by log/settings route groups in later plans)
- `pnpm-lock.yaml` - Updated for the five new dependencies

## Decisions Made
- Used `pnpm add` instead of the plan's literal `npm install @gorhom/bottom-sheet` — this monorepo is pnpm-workspace-driven (pnpm-workspace.yaml + pnpm-lock.yaml present, and `npx expo install` itself invoked pnpm); running npm would have written a second, conflicting lockfile
- `log` and `settings` Tabs.Screen entries point at route groups that don't exist until Plans 06/09 — expo-router will emit a route-not-found warning until then, which is expected and explicitly called out in the plan

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Used pnpm instead of npm for @gorhom/bottom-sheet**
- **Found during:** Task 2 (dependency install)
- **Issue:** Plan instructed `npm install @gorhom/bottom-sheet`, but the repo is a pnpm workspace (pnpm-workspace.yaml, pnpm-lock.yaml, and expo install itself used pnpm under the hood for the other four packages)
- **Fix:** Ran `pnpm add @gorhom/bottom-sheet` instead, keeping a single consistent lockfile
- **Files modified:** apps/mobile/package.json, pnpm-lock.yaml
- **Verification:** `npx tsc --noEmit` clean; package.json shows @gorhom/bottom-sheet ^5.2.14 alongside the other four deps
- **Committed in:** cf1ccb8 (Task 2 commit)

**2. [Rule 1 - Bug] Fixed invalid Android SF-Symbols-style icon name**
- **Found during:** Task 3 (tab shell)
- **Issue:** Used `android: 'add-circle'` (hyphenated) for the Log tab icon; expo-symbols' Android icon type only accepts Material-icon-style snake_case names, causing a TS2820 type error
- **Fix:** Changed to `android: 'add_circle'` / `web: 'add_circle'`
- **Files modified:** apps/mobile/app/(tabs)/_layout.tsx
- **Verification:** `npx tsc --noEmit` exits 0
- **Committed in:** fcc7968 (Task 3 commit)

---

**Total deviations:** 2 auto-fixed (1 blocking/package-manager, 1 bug/type-error)
**Impact on plan:** Both fixes were necessary to complete the tasks correctly; no scope creep, no architectural changes.

## Issues Encountered
None beyond the two auto-fixed deviations above.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Dark design tokens (Colors.ts, theme.ts) are ready for every subsequent screen in this phase (onboarding wizard, logger, settings)
- Three-tab shell is in place; Plans 06 and 09 need to create the `log/` and `settings/` route groups expo-router is currently warning about
- expo-crypto is installed and ready for CSPRNG-backed UUID generation in later data-writing plans (T-03-06 mitigation)
- @gorhom/bottom-sheet is installed and ready for the exercise picker and breakdown sheet (D-10, D-24)

---
*Phase: 03-onboarding-lifting-logger*
*Completed: 2026-07-09*

## Self-Check: PASSED

All created/modified files confirmed present on disk (theme.ts, Colors.ts, app.json, _layout.tsx, index.tsx, SUMMARY.md), two.tsx confirmed deleted, and both task commits (cf1ccb8, fcc7968) confirmed present in git log.
