<!-- GSD:project-start source:PROJECT.md -->

## Project

**Apsis**

Apsis (working title "CONCURRENT") is a hybrid-athlete training tracker for iOS. It logs
**lifting and running in one app**, computes **one unified training-load number** (the Hybrid
Stress Score / HSS), and surfaces a **readiness trend** (green/amber/red). It is built for
serious HYROX and tactical athletes who currently duct-tape Strong/Hevy + Strava + a macro
app together and have no shared unit for total training stress.

**Core Value:** Log both lifting and running, instantly see one honest combined training-load number (HSS)
and a readiness band — fully offline. If everything else fails, this must work.

### Constraints

- **Timeline**: App Store build submitted for review by ~July 28, 2026 — Why: ~4-week window,
  must leave 1–3 day Apple review buffer before end of July.

- **Tech stack**: Expo (React Native), TypeScript, expo-router; op-sqlite + drizzle (or
  WatermelonDB); Zustand / React Query; victory-native charts — Why: one builder shipping fast,
  matches existing skills, locked in BUILD.md §3.

- **Engine purity**: `packages/engine` is pure TS — no React, no I/O, no `Date.now()` inside;
  time is passed in — Why: it's the IP/moat and must stay testable and reusable.

- **Local-first**: logging never blocks on the network — Why: athletes log mid-workout with no
  signal (basements, trails); the instant on-device feedback loop is the product.

- **Logging speed**: must match Strong/Hevy entry speed — Why: slow entry kills the daily habit;
  existential, not polish.
<!-- GSD:project-end -->

<!-- GSD:stack-start source:research/STACK.md -->

## Technology Stack

## Verdict on the Locked Stack

## Recommended Stack

### Core Framework

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| expo | **56.0.12** | App framework + EAS Build | Current stable (released May 2026). New Architecture on by default. 50%+ faster iOS builds vs SDK 55. Start greenfield here. |
| react-native | **0.85** | Mobile runtime | Bundled via Expo SDK 56. New Architecture mandatory from SDK 53+; no old-arch fallback. |
| react | **19.2** | UI library | Bundled via Expo SDK 56. Server Components not used; 19.2 adds performance fixes. |
| typescript | **6.0.3** | Type system | SDK 56 template default. Breaking changes from 5.x are minor; `strict` mode required per BUILD.md. |
| expo-router | **~4.x (bundled)** | File-based navigation | Included in SDK 56. **Critical SDK 56 change:** expo-router has forked from React Navigation. Do NOT install `@react-navigation/*` packages directly — use `expo-router` entry points for all navigation. Codemod available: `npx @expo/router-codemod`. |

### Local Database

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| @op-engineering/op-sqlite | **16.2.2** | SQLite via JSI | Synchronous native access via JSI, ~5x faster than bridge-based alternatives. Critical for the HSS `load_daily` recompute-on-write loop where blocking UI is acceptable (it's synchronous and fast). Active development (published daily as of research date). Requires dev build — not Expo Go. |
| drizzle-orm | **0.45.2** | ORM + type-safe queries | Official op-sqlite connector (`drizzle-orm/op-sqlite`). Schema-first with full TypeScript inference. Migration snapshots via drizzle-kit. Use **0.45.2 stable**, NOT the 1.0.0-rc.x line — the RC has active API churn and a 4-week App Store deadline cannot absorb it. |
| drizzle-kit | **0.31.10** | Migration CLI | Companion to drizzle-orm. Generates SQL migration files; bundle them into the app for startup execution via `useMigrations` hook. |

### HealthKit

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| @kingstinct/react-native-healthkit | **~8.2.0** | HealthKit read/write | Only viable HealthKit option for Expo — there is no official Expo HealthKit module. Full TypeScript coverage, Expo config plugin included. Last updated May 2026. |

### Charts

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| victory-native | **41.26.0** | Load/readiness trend charts | Skia-based GPU canvas rendering (v40+ full rewrite). Actively maintained by Nearform. Best-in-class performance for animated time-series charts in React Native. |
| @shopify/react-native-skia | **>=1.2.3 <3.0.0** | GPU canvas (peer dep) | Required by victory-native. Expo SDK 56 ships Skia integration. Install via `npx expo install @shopify/react-native-skia`. |
| react-native-reanimated | **4.5.0** | Animation (peer dep) | Required by victory-native v41. Reanimated 4 requires New Architecture — already satisfied by SDK 56. |
| react-native-gesture-handler | **(SDK bundled)** | Gesture (peer dep) | Required by victory-native. Included in Expo SDK 56 template. |

### State Management

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| zustand | **5.0.14** | UI + session state | Use this for all ephemeral app state: active workout session, form values, UI toggles. Tiny bundle, zero boilerplate, works in React Native without any special adapters. |
| @tanstack/react-query | **5.101.2** | Async data wrapper (optional) | Use only if drizzle queries need caching/loading state management (e.g., wrapping async `db.select()` calls in components). For a pure-offline app with synchronous JSI reads, Zustand alone may be sufficient. Do NOT use for network fetching — there is no network in v1.0. |

### Testing

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| vitest | **4.1.9** | Engine + db logic unit testing | Vite-native test runner. Perfect for `packages/engine` (pure TS, zero dependencies). Runs fast, supports TypeScript natively, excellent watch mode. Current major version is 4 (note: a significant jump — verify vitest 4 migration guide if upgrading from older projects). |
| @testing-library/react-native | **14.0.1** | Component integration tests | For testing key UI flows (log a lift, see HSS update). Use sparingly — focus test budget on the engine package, not UI. |

### Development Tools

| Tool | Version / Config | Purpose | Notes |
|------|---------|---------|-------|
| eslint | **^9.x** | Linting | Use flat config (`eslint.config.js`). Expo SDK 56 templates default to ESLint 9. |
| prettier | **^3.x** | Formatting | Standard; add `prettier-plugin-organize-imports` for auto-import ordering. |
| tsconfig strict | — | Type safety | Enable `strict: true`, `exactOptionalPropertyTypes: true`, `noUncheckedIndexedAccess: true` in `packages/engine`. The engine is the moat; over-type it. |
| pnpm workspaces | **^9.x** | Monorepo | See Monorepo section below. |
| EAS CLI | **latest** | Cloud builds | `npm install -g eas-cli`. Required for App Store submissions. Configure from Phase 0. |

## Monorepo Configuration

### pnpm-workspace.yaml

### .npmrc (required — React Native breaks without this)

### Workspace layout

## Version Compatibility Matrix

| Package | Requires | Notes |
|---------|----------|-------|
| expo 56.0.12 | React Native 0.85, React 19.2, Xcode 26.4, iOS 16.4+ | Xcode 26 is Apple's 2025/2026 Xcode naming; it's the stable release series, not a beta |
| @op-engineering/op-sqlite 16.x | Expo prebuild (no Expo Go), JSI enabled | No extra config plugin; `npx expo prebuild` + pod install handles setup |
| drizzle-orm 0.45.2 | drizzle-kit 0.31.10 for migrations | Keep runtime (0.45.x) and kit (0.31.x) versions in sync; mismatches cause migration format errors |
| victory-native 41.x | @shopify/react-native-skia >=1.2.3 <3.0.0, react-native-reanimated >=4.0, react-native-gesture-handler | Skia 3.x not yet supported — pin Skia to `^2.x` |
| react-native-reanimated 4.x | React Native New Architecture (already on in SDK 56) | If for any reason you disable New Arch, drop Reanimated to 3.x and use victory-native 40.x |
| @kingstinct/react-native-healthkit 8.x | Dev build (EAS or local run:ios), HealthKit entitlement, physical device for tests | Add to app.json plugins; simulator has minimal HealthKit data |
| vitest 4.x | Node 18+ | Check vitest 4 migration docs if upgrading from v1/v2 test suites |

## Alternatives Considered

| Recommended | Alternative | Why Not |
|-------------|-------------|---------|
| op-sqlite 16.x | expo-sqlite (built-in) | expo-sqlite's main advantage is Expo Go compatibility, which is moot since HealthKit also requires dev build; op-sqlite JSI is measurably faster for write-heavy patterns |
| op-sqlite + drizzle | WatermelonDB 0.28.0 | Last published April 2025 (>1 year); reactive model layer adds complexity not needed here; imperative engine + drizzle is a cleaner fit |
| drizzle-orm 0.45.2 | drizzle-orm 1.0.0-rc.4 | RC has active API churn; multiple breaking changes per release; incompatible with a 4-week hard deadline |
| victory-native 41.x | react-native-svg-charts | Unmaintained since 2021; no Skia; no active community |
| zustand 5.x | Redux Toolkit | 5x more boilerplate, designed for team-scale apps with normalized server state — not a local-first single-user offline tracker |
| zustand 5.x | Jotai / Recoil | Both are fine alternatives; zustand is explicitly chosen in BUILD.md and has simpler devtools integration |
| @kingstinct/react-native-healthkit | expo-health (non-existent) | No official Expo HealthKit module exists; kingstinct is the only maintained Expo-compatible option |
| pnpm workspaces | npm workspaces | Both work with Expo SDK 56; pnpm is faster installs, stricter dep resolution; either is valid per BUILD.md |

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| Expo Go | op-sqlite, HealthKit, and Skia (victory-native) are all native modules incompatible with Expo Go | EAS dev build or `npx expo run:ios` from day 1 |
| drizzle-orm 1.0.0-rc.x | Beta/RC with active API churn; the SQLite driver was rewritten in RC, migration format changed | drizzle-orm 0.45.2 stable |
| @react-navigation/* direct imports in SDK 56 | expo-router forked from React Navigation in SDK 56; importing from @react-navigation breaks | Import all navigation from expo-router directly |
| WatermelonDB | 14+ months without a release (as of June 2026); reactive model overhead unnecessary | op-sqlite + drizzle |
| react-native-svg-charts | Abandoned 2021 | victory-native 41.x |
| Redux / Redux Toolkit | Over-engineered for single-user offline app; no server state to normalize | zustand 5.x |
| Skia 3.x | Not yet supported by victory-native 41.x (peer dep constraint >=1.2.3 <3.0.0) | Pin @shopify/react-native-skia to ^2.x |
| react-native-reanimated 3.x with SDK 56 | Reanimated 4 is required for New Architecture apps; SDK 56 enforces New Arch | react-native-reanimated 4.5.0 |
| Backend / server of any kind | v1.0 is offline-only per BUILD.md; any server adds scope, latency risk, and App Store review surface | None — defer to v1.1 |

## Installation

# Create monorepo root

# Install Expo globally (for CLI)

# Scaffold the mobile app

# Core native dependencies (run inside apps/mobile)

# ORM + migrations

# State

# Charts

# Testing (engine package)

# Testing (mobile app)

# Prebuild (generates native iOS project — required for op-sqlite / HealthKit / Skia)

## Sources

- [Expo SDK 56 Changelog](https://expo.dev/changelog/sdk-56) — SDK version, RN version, iOS minimum, Xcode requirement, expo-router fork (MEDIUM confidence, cross-checked)
- [Expo SDK 56 Beta announcement](https://expo.dev/changelog/sdk-56-beta) — feature list confirmation
- [op-sqlite npm](https://www.npmjs.com/package/@op-engineering/op-sqlite) — version 16.2.2, publish date (MEDIUM confidence)
- [OP-SQLite installation docs](https://op-engineering.github.io/op-sqlite/docs/installation/) — prebuild requirement, no config plugin needed
- [drizzle-orm npm](https://www.npmjs.com/drizzle-orm) — version 0.45.2 stable, 1.0.0-rc.4 beta (MEDIUM confidence)
- [drizzle-kit npm](https://www.npmjs.com/package/drizzle-kit) — version 0.31.10 (MEDIUM confidence)
- [Drizzle OP-SQLite connector docs](https://orm.drizzle.team/docs/connect-op-sqlite) — integration pattern
- [victory-native npm](https://www.npmjs.com/package/victory-native) — version 41.26.0, Skia peer dep constraint (MEDIUM confidence)
- [@kingstinct/react-native-healthkit npm](https://www.npmjs.com/package/@kingstinct/react-native-healthkit) — version ~8.2.0, May 2026 update (MEDIUM confidence)
- [react-native-healthkit GitHub README](https://github.com/kingstinct/react-native-healthkit/blob/master/README.md) — config plugin setup, dev client requirement
- [WatermelonDB npm](https://www.npmjs.com/package/@nozbe/watermelondb) — version 0.28.0, ~April 2025 last publish (MEDIUM confidence)
- [zustand npm](https://www.npmjs.com/package/zustand) — version 5.0.14 (MEDIUM confidence)
- [@tanstack/react-query npm](https://www.npmjs.com/package/@tanstack/react-query) — version 5.101.2 (MEDIUM confidence)
- [vitest npm](https://www.npmjs.com/package/vitest) — version 4.1.9 (MEDIUM confidence)
- [@testing-library/react-native npm](https://www.npmjs.com/package/@testing-library/react-native) — version 14.0.1 (MEDIUM confidence)
- [react-native-reanimated npm](https://www.npmjs.com/package/react-native-reanimated) — version 4.5.0, New Arch requirement (MEDIUM confidence)
- [Expo monorepo guide](https://docs.expo.dev/guides/monorepos/) — pnpm workspace, .npmrc hoisting requirement
- [Offline-First RN: SQLite + Drizzle 2026](https://reactnativerelay.com/article/building-offline-first-react-native-apps-2026-expo-sqlite-drizzle-orm-sync-strategies) — op-sqlite vs expo-sqlite tradeoffs

<!-- GSD:stack-end -->

<!-- GSD:conventions-start source:CONVENTIONS.md -->

## Conventions

Conventions not yet established. Will populate as patterns emerge during development.
<!-- GSD:conventions-end -->

<!-- GSD:architecture-start source:ARCHITECTURE.md -->

## Architecture

Architecture not yet mapped. Follow existing patterns found in the codebase.
<!-- GSD:architecture-end -->

<!-- GSD:skills-start source:skills/ -->

## Project Skills

No project skills found. Add skills to any of: `.claude/skills/`, `.agents/skills/`, `.cursor/skills/`, `.github/skills/`, or `.codex/skills/` with a `SKILL.md` index file.
<!-- GSD:skills-end -->

<!-- GSD:workflow-start source:GSD defaults -->

## GSD Workflow Enforcement

Before using Edit, Write, or other file-changing tools, start work through a GSD command so planning artifacts and execution context stay in sync.

Use these entry points:

- `/gsd-quick` for small fixes, doc updates, and ad-hoc tasks
- `/gsd-debug` for investigation and bug fixing
- `/gsd-execute-phase` for planned phase work

Do not make direct repo edits outside a GSD workflow unless the user explicitly asks to bypass it.
<!-- GSD:workflow-end -->

<!-- GSD:profile-start -->

## Developer Profile

> Profile not yet configured. Run `/gsd-profile-user` to generate your developer profile.
> This section is managed by `generate-claude-profile` -- do not edit manually.
<!-- GSD:profile-end -->
