---
phase: 06-polish-app-store-submission
plan: 02
subsystem: infra
tags: [sentry, crash-reporting, expo-config-plugin, metro, privacy, allowlist]

requires:
  - phase: 05-healthkit-integration
    provides: T-05-01 no-raw-health-values-in-logs convention (extended to the SDK-event layer here)
provides:
  - Pure, vitest-tested sanitizeSentryEvent allowlist function (lib/sentrySanitize.ts)
  - @sentry/react-native installed with Expo config plugin registered and metro wrapped
  - Sentry.init + Sentry.wrap wired into the root layout with the allowlist beforeSend
affects: [06-03, 06-04, 06-07]

tech-stack:
  added: ["@sentry/react-native ~7.11.0 (Expo SDK 56 compat-resolved, not RESEARCH.md's 8.18.0 line)"]
  patterns:
    - "Explicit allowlist reconstruction (never spread event.extra/contexts/breadcrumbs) for any SDK-boundary event"
    - "Module-scope Sentry.init alongside SplashScreen.preventAutoHideAsync(), Sentry.wrap(RootLayout) as the default export"

key-files:
  created:
    - apps/mobile/lib/sentrySanitize.ts
    - apps/mobile/lib/__tests__/sentrySanitize.test.ts
    - .planning/phases/06-polish-app-store-submission/06-USER-SETUP.md
  modified:
    - apps/mobile/app/_layout.tsx
    - apps/mobile/app.json
    - apps/mobile/metro.config.js
    - apps/mobile/package.json
    - pnpm-lock.yaml

key-decisions:
  - "npx expo install resolved @sentry/react-native to ~7.11.0 (Expo SDK 56 compatibility table), not RESEARCH.md's 8.18.0 line -- followed the established expo-resolved-version convention (Phase 04 P02 precedent) rather than hand-pinning a newer version"
  - "app.json plugin entry uses the bare \"@sentry/react-native\" tuple (org/project/url), not \"@sentry/react-native/expo\" -- v7.11.0 ships its Expo config plugin at the package root (app.plugin.js -> expo.js), there is no /expo subpath in this version"
  - "Sentry.init's integrations callback filters out the 'Breadcrumbs' integration, not 'Console' -- this SDK line has no default integration literally named 'Console'; breadcrumbsIntegration (name 'Breadcrumbs') is the one with console:true by default that actually captures console.* output, confirmed by reading the SDK source directly"

requirements-completed: [REL-03]

coverage:
  - id: D1
    description: "Pure, vitest-tested sanitizeSentryEvent allowlist function -- exception preserved, contexts trimmed to device/app, user/extra always undefined, breadcrumbs always emptied"
    requirement: "REL-03"
    verification:
      - kind: unit
        ref: "apps/mobile/lib/__tests__/sentrySanitize.test.ts (7 tests, all describe blocks)"
        status: pass
    human_judgment: false
  - id: D2
    description: "@sentry/react-native installed via expo install; Expo config plugin registered in app.json; metro.config.js wrapped via getSentryExpoConfig with .sql sourceExt preserved; sentry-expo absent; encryption flag intact"
    requirement: "REL-03"
    verification:
      - kind: other
        ref: "grep checks: package.json/@sentry/react-native, metro.config.js/getSentryExpoConfig+sourceExts.push('sql'), app.json/@sentry/react-native plugin tuple, absence of sentry-expo, ITSAppUsesNonExemptEncryption:false"
        status: pass
      - kind: other
        ref: "npx expo config --type public (from apps/mobile) -- resolves without a plugin-resolution error"
        status: pass
    human_judgment: false
  - id: D3
    description: "Sentry.init wired at module scope with allowlist beforeSend, sendDefaultPii false, tracesSampleRate 0, attachScreenshot/attachViewHierarchy false, Breadcrumbs integration filtered; default export is Sentry.wrap(RootLayout); all existing boot gates unchanged"
    requirement: "REL-03"
    verification:
      - kind: other
        ref: "grep checks: Sentry.init, beforeSend, sanitizeSentryEvent, Sentry.wrap(RootLayout) all present in _layout.tsx"
        status: pass
      - kind: unit
        ref: "pnpm --filter @apsis/mobile test (37/37 tests, full suite)"
        status: pass
    human_judgment: false
  - id: D4
    description: "Real on-device confirmation that a crash/error actually reaches Sentry and arrives scrubbed (end-to-end, with a live DSN and a fresh EAS build)"
    verification: []
    human_judgment: true
    rationale: "Requires a real Sentry project/DSN (deferred to 06-USER-SETUP.md, human account creation) and a fresh EAS build cycle per the project's established native-module-change pattern (Pitfall 3) -- not achievable inside this execution session; the code-level plumbing (D1-D3) is fully proven, but the live end-to-end path is not."

duration: 15min
completed: 2026-07-12
status: complete
---

# Phase 06 Plan 02: Sentry Crash Reporting with Allowlist Scrubbing Summary

**Real crash/error reporting via @sentry/react-native, gated behind a pure, unit-tested allowlist `beforeSend` that structurally strips every health-derived field before an event ever leaves the device.**

## Performance

- **Duration:** 15 min
- **Started:** 2026-07-12T11:16:00-04:00 (approx)
- **Completed:** 2026-07-12T11:24:32-04:00
- **Tasks:** 3
- **Files modified:** 7 (2 new lib files, 5 modified config/app files) + 1 planning artifact (06-USER-SETUP.md)

## Accomplishments
- `sanitizeSentryEvent` (apps/mobile/lib/sentrySanitize.ts) — pure, native-import-free allowlist reconstruction, proven by 7 unit tests including adversarial poisoned-input cases (heart rate, HSS, bodyweight, distance, duration all confirmed non-forwardable)
- `@sentry/react-native` installed via `npx expo install`, Expo config plugin registered in app.json, `metro.config.js` wrapped via `getSentryExpoConfig` with the drizzle-critical `.sql` sourceExt push preserved
- `Sentry.init` wired at module scope in `_layout.tsx` with the allowlist `beforeSend`, no performance tracing (`tracesSampleRate: 0`), no PII, no screenshots/view hierarchy, and the console-capturing `Breadcrumbs` integration filtered out; default export is now `Sentry.wrap(RootLayout)`

## Task Commits

Each task was committed atomically:

1. **Task 1: Pure Sentry allowlist sanitizer + tests (RED→GREEN)** - `3e8d708` (test), `ff0ba69` (feat)
2. **Task 2: Install @sentry/react-native + config plugin + metro wrap** - `851510b` (feat)
3. **Task 3: Sentry.init + Sentry.wrap in root layout (D-02/D-03)** - `3f68d9c` (feat)

**Plan metadata:** (pending — this commit)

_Note: Task 1 followed the full RED (failing test) → GREEN (implementation) TDD cycle as required by `tdd="true"`._

## Files Created/Modified
- `apps/mobile/lib/sentrySanitize.ts` - Pure allowlist `beforeSend` filter (D-03)
- `apps/mobile/lib/__tests__/sentrySanitize.test.ts` - 7 unit tests, allowlist + adversarial coverage
- `apps/mobile/app/_layout.tsx` - Sentry.init + Sentry.wrap(RootLayout), existing boot sequence unchanged
- `apps/mobile/app.json` - `@sentry/react-native` Expo config plugin tuple (org/project/url placeholders)
- `apps/mobile/metro.config.js` - Base config now sourced from `getSentryExpoConfig`, `.sql` sourceExt preserved
- `apps/mobile/package.json` - `@sentry/react-native: ~7.11.0` dependency
- `pnpm-lock.yaml` - Synced for the new dependency (verified `pnpm install --frozen-lockfile` succeeds)
- `.planning/phases/06-polish-app-store-submission/06-USER-SETUP.md` - Sentry account/project/DSN/auth-token setup checklist

## Decisions Made

- **Expo-resolved package version over RESEARCH's stated version:** `npx expo install @sentry/react-native` resolved `~7.11.0` per Expo SDK 56's bundled compatibility table, not RESEARCH.md's researched-current `8.18.0` line. Followed this project's established precedent (Phase 04 Plan 02: `react-native-svg` kept at expo-resolved `15.15.4` over RESEARCH's `15.15.5`) — the SDK-56-line convention wins over a manually-researched version number, since `expo install` is the authoritative compatibility resolver for this stack. Same package/npm registry entry, so the Phase 6 RESEARCH.md Package Legitimacy Audit (verdict OK/Approved) still applies unchanged.
- **Config plugin registration adapted to the installed version's actual API shape:** RESEARCH.md/the plan specified `["@sentry/react-native/expo", {...}]`. Reading the installed `~7.11.0` package directly showed there is no `/expo` subpath in this version — the Expo config plugin is exposed via `app.plugin.js` → `expo.js` at the package root, and `npx expo install` itself auto-registered the plugin as the bare string `"@sentry/react-native"`. Verified via `npx expo config --type public` (no plugin-resolution error) since Windows cannot locally prebuild `ios/`.
- **Integration filtered by name is 'Breadcrumbs', not 'Console':** Reading the installed SDK's `getDefaultIntegrations` source showed this version has no default integration literally named `'Console'` — the actual console-capturing default is `breadcrumbsIntegration()` (registered under the name `'Breadcrumbs'`, defaulting `console: true`). Filtered that integration out instead, and kept `sanitizeSentryEvent`'s unconditional `breadcrumbs: []` reset as the second defense-in-depth layer per RESEARCH Pitfall 6 ("verify both, not just one").

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Adapted app.json plugin registration to the actually-installed SDK version's API shape**
- **Found during:** Task 2 (Install @sentry/react-native + config plugin + metro wrap)
- **Issue:** The plan's literal acceptance criterion (`grep -q "@sentry/react-native/expo" apps/mobile/app.json`) targets a plugin subpath (`/expo`) that does not exist in the version Expo's SDK 56 compatibility table actually resolved (`~7.11.0`). Registering the plugin with a non-existent subpath would break config-plugin resolution at `expo prebuild`/EAS build time.
- **Fix:** Registered the plugin using the version's real API — the bare `"@sentry/react-native"` tuple with `{organization, project, url}` config (same fields, different plugin identifier string). Confirmed correct via `npx expo config --type public`, which resolves cleanly with no plugin error.
- **Files modified:** apps/mobile/app.json
- **Verification:** `npx expo config --type public` succeeds; full mobile test suite green.
- **Committed in:** 851510b (Task 2 commit)

**2. [Rule 1 - Bug] Filtered the actual console-capturing integration ('Breadcrumbs'), not 'Console'**
- **Found during:** Task 3 (Sentry.init + Sentry.wrap in root layout)
- **Issue:** The plan/RESEARCH's Pitfall 6 mitigation instructs filtering the default `'Console'` integration out of Sentry's `integrations` array. Reading the installed SDK (`~7.11.0`) source directly showed no default integration is named `'Console'` in this version — filtering by that literal name would be a silent no-op, leaving the actual console-capturing integration (`breadcrumbsIntegration`, name `'Breadcrumbs'`, `console: true` by default) active at the integration layer (though still neutralized by `sanitizeSentryEvent`'s unconditional `breadcrumbs: []`).
- **Fix:** Changed the integrations filter predicate to `integration.name !== 'Breadcrumbs'`, matching this SDK version's real default-integration name for the console-capturing behavior. Documented the version-specific finding in the `_layout.tsx` module doc comment so a future SDK upgrade doesn't silently reintroduce the gap.
- **Files modified:** apps/mobile/app/_layout.tsx
- **Verification:** Full mobile test suite green (37/37); `sanitizeSentryEvent`'s breadcrumb-clearing test still covers the belt-and-suspenders layer regardless of integration-layer correctness.
- **Committed in:** 3f68d9c (Task 3 commit)

---

**Total deviations:** 2 auto-fixed (both Rule 1 — bugs caused by RESEARCH.md/the plan's assumptions not matching the actual SDK version Expo's compatibility resolver installed)
**Impact on plan:** Both fixes were necessary for the Sentry integration to actually function/protect as intended in the version that was legitimately installed by following the plan's own instructed command (`npx expo install`). No scope creep — same files, same plan intent, corrected to match reality.

## Issues Encountered

- `npx expo install` printed a Node.js version warning (`Node.js v20.16.0 is outdated ... required: >=20.19.4`) — informational only, install succeeded; not addressed (out of scope, pre-existing environment condition unrelated to this plan's task).
- Root `pnpm run typecheck` shows the same 2 pre-existing typed-route errors already documented as a deferred item in STATE.md (`app/onboarding/review.tsx`, `components/ExternalLink.tsx`) — confirmed via `git stash` that these errors exist identically without this plan's changes; out of scope per the scope-boundary rule.

## User Setup Required

**External services require manual configuration.** See [06-USER-SETUP.md](./06-USER-SETUP.md) for:
- Creating a Sentry project (React Native platform) and noting the org/project slugs (app.json currently has placeholder values `"apsis"`/`"apsis-mobile"`)
- Retrieving `EXPO_PUBLIC_SENTRY_DSN` and creating `SENTRY_AUTH_TOKEN` (store as an EAS secret, never commit)

## Next Phase Readiness

- REL-03's code-level plumbing is complete and unit-tested: the allowlist sanitizer, SDK install, config plugin, metro wrap, and root-layout wiring are all in place and verified.
- Blocked on human action before the crash-reporting path can be exercised end-to-end: Sentry project creation (06-USER-SETUP.md) and a fresh EAS build cycle (native module change — established Phase 4/5 pattern) are both required before a real crash reaches the Sentry dashboard scrubbed as expected.
- app.json's Sentry plugin org/project slugs are placeholders (`"apsis"`/`"apsis-mobile"`) and must be updated once the real Sentry project exists — flagged in 06-USER-SETUP.md.
- Ready for 06-03 (or the next plan in this phase's wave).

## TDD Gate Compliance

Task 1 (`tdd="true"`) followed the required RED→GREEN sequence:
- RED: `3e8d708 test(06-02): add failing test for Sentry beforeSend allowlist sanitizer` (confirmed failing — module did not exist — before this commit)
- GREEN: `ff0ba69 feat(06-02): implement Sentry beforeSend allowlist sanitizer` (confirmed all 7 tests passing after this commit)
- No REFACTOR commit needed — implementation was minimal and clean on first GREEN pass.

## Self-Check: PASSED

- All 4 created/modified key files verified present on disk (`[ -f ]` checks above).
- All 4 task commit hashes verified present in `git log --oneline --all`.
- Re-ran plan-level `<verification>` commands: `pnpm --filter @apsis/mobile test -- sentrySanitize` (7/7 pass), full `pnpm --filter @apsis/mobile test` (37/37 pass), `.sql` sourceExt preserved in metro.config.js, `_layout.tsx` wires `beforeSend: sanitizeSentryEvent` and exports `Sentry.wrap(RootLayout)` — all confirmed.
- Re-ran all task-level `<acceptance_criteria>` — all pass (see Deviations section for the 2 criteria that required adapting to the actually-installed SDK version's API shape, both verified working via functional checks instead of the literal grep string).

---
*Phase: 06-polish-app-store-submission*
*Completed: 2026-07-12*
