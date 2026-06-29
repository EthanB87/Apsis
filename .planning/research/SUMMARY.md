# Project Research Summary

**Project:** Apsis -- Hybrid Athlete Training Tracker
**Domain:** iOS-first local-first Expo monorepo / training load management
**Researched:** 2026-06-29
**Confidence:** MEDIUM

## Executive Summary

Apsis is a hybrid athlete training tracker for serious HYROX and tactical athletes who currently duct-tape Strong/Hevy, Strava, and a macro app together. The core moat is a unified Hybrid Stress Score (HSS) -- one training-load number that spans lifting and running -- surfaced as a green/amber/red readiness band, fully computed on-device. No incumbent (Strong, Hevy, HyTrack, Strava) does this. The entire stack is confirmed sound for June 2026: Expo SDK 56, op-sqlite 16 + drizzle-orm 0.45.2, @kingstinct/react-native-healthkit ~8.2, victory-native 41 with Skia ^2.x, and zustand 5.

The single biggest architectural reality is that **Expo Go is a dead end from line one.** op-sqlite (JSI), HealthKit, and Skia/victory-native are all native modules incompatible with Expo Go. This means EAS Build and a physical device are required starting in Phase 0 -- not Phase 2. The build order mandated by dependencies is: shared types -> pure-TS engine (validates the thesis) -> db layer (drizzle + op-sqlite) -> mobile UI -> HealthKit adapter -> App Store polish. The engine must be built and tested before any UI exists because if the HSS model is unsatisfiable the entire product premise fails.

The ~4-week App Store deadline (submit by ~July 25 for a buffer before July 28) creates two existential risks: (1) scope creep pulling nice-to-have features into Phase 1/2 and blowing the timeline; and (2) submission logistics being treated as a Day-28 task rather than a Day-19 parallel workstream. HealthKit is explicitly the lowest-priority v1.0 feature and is the designated cut if the timeline slips -- the core offline logger plus HSS readiness band must ship regardless.

## Key Findings

### Recommended Stack

All BUILD.md section 3 choices are confirmed sound. Two previously open choices are now resolved: use op-sqlite 16 over WatermelonDB (stale, >1 year without a release), and use drizzle-orm 0.45.2 stable over the 1.0.0-rc.x line (active API churn, incompatible with a hard deadline). victory-native 41 over react-native-svg-charts (abandoned 2021). The pnpm workspace .npmrc must set node-linker=hoisted or Metro cannot resolve packages across workspace boundaries.

**Core technologies:**
- expo 56.0.12 / react-native 0.85: App framework -- New Architecture on by default; 50%+ faster iOS builds vs SDK 55
- @op-engineering/op-sqlite 16.2.2: SQLite via JSI -- synchronous native access ~5x faster than bridge; required for write-then-recompute pattern; requires dev build
- drizzle-orm 0.45.2 (NOT 1.0.0-rc): ORM + typed queries -- stable; companion drizzle-kit 0.31.10 for migrations
- @kingstinct/react-native-healthkit ~8.2.0: Only viable HealthKit option for Expo; requires dev build + physical device
- victory-native 41.26.0 + @shopify/react-native-skia ^2.x: GPU-rendered charts -- pin Skia to ^2.x (peer dep constraint >=1.2.3 <3.0.0; Skia 3.x not yet supported)
- react-native-reanimated 4.5.0: Required by victory-native; Reanimated 4 requires New Architecture (satisfied by SDK 56)
- zustand 5.0.14: Transient UI state only (active session draft, form values, toggles)
- vitest 4.1.9: Engine unit tests -- pure TS, no DOM, no React
- expo-router ~4.x: Navigation -- SDK 56 forked from React Navigation; do NOT import from @react-navigation/* directly

**Critical version pins:**
- drizzle-orm: 0.45.2 stable (not 1.0.0-rc.x)
- @shopify/react-native-skia: ^2.x (not 3.x)
- @tanstack/react-query 5.101.2: optional; evaluate after Phase 1 -- Zustand alone may be sufficient for a pure-offline JSI app

### Expected Features

**Must have -- table stakes (P1):**
- Previous-session weight/reps recall inline per set -- Strong is the benchmark; absence feels broken vs incumbents
- Set entry in <= 3 taps -- RPE as always-visible 6-button quick-row (6/7/8/9/10), last-used pre-selected; never behind a modal
- Auto-rest timer on set complete -- persistent banner, configurable; expected by Strong/Hevy users
- Seeded exercise library (~40 HYROX/tactical movements) with fast inline search
- Warmup set flag (isWarmup) -- excluded from strength stress; engine already accounts for this
- Run logger: distance + duration -> auto-pace, activity type picker, optional avgHR
- Session HSS displayed on the finish screen immediately after save
- Readiness band (green/amber/red) + 28-day ATL/CTL chart as the home screen above the fold
- Onboarding capturing sex, bodyweight, thresholdHR, thresholdPace -- engine cannot produce meaningful numbers without these

**Should have -- differentiators (P2):**
- Live HSS update mid-session as each set is logged (pure-TS engine callable from UI thread synchronously)
- Double-session penalty label when sessionCount > 1 on a day
- HealthKit import: runs/HR/bodyweight -> endurance_segment; write logged sessions back to Health app
- Units toggle (km/mi) -- display-layer only; always store metric internally

**Defer to v1.1+:**
- Plate calculator, custom exercise creation, iCloud backup, Garmin import, superset logging, social feed, nutrition/macros, Android, programming/coaching layer

**ATL/CTL cold-start handling (critical UX):** For the first 14 days (or until CTL > 10), show a "Building baseline..." state instead of a raw readiness band. TSB on day 1 with a single session is strongly negative, which reads as "destroyed" to the user. A unit test asserting that a single moderate session in cold-start does NOT produce a red band must be written in Phase 0.

### Architecture Approach

Four-package monorepo with strict unidirectional import rules: packages/shared (types only) -> packages/engine (pure TS, zero runtime deps) -> packages/db (op-sqlite + drizzle, calls engine for recomputeLoadDaily) -> apps/mobile (Expo RN, Zustand, expo-router). The core feedback loop is: user saves a set -> db insertStrengthSet() -> recomputeLoadDaily() calls engine -> drizzle useLiveQuery on load_daily drives home screen re-render -> user sees updated HSS and readiness in <100ms. The mobile UI may also call the engine directly for a live in-screen preview before save (transient, no DB round-trip); both calls produce identical results because the engine is pure.

**Major components:**
1. packages/engine -- pure TS HSS computation (strengthStress, enduranceStress, sessionHSS, dailyHSS, computeLoadTrend, readinessBand); zero runtime deps; vitest only; the moat
2. packages/db -- op-sqlite singleton, drizzle schema, migration runner, recomputeLoadDaily() orchestration; calls engine; no React
3. packages/shared -- TypeScript types only (StrengthSet, EnduranceSegment, EngineConfig); compiled away at runtime
4. apps/mobile -- Expo RN app; expo-router screens; Zustand for transient state; all persistence via packages/db service hooks; HealthKit adapter (Phase 2 only)

**Key patterns:**
- Engine functions always receive time-sensitive values as arguments (no Date.now() inside engine)
- All writes go through a service hook in apps/mobile/src/hooks/ that always calls recomputeLoadDaily() -- scattered direct db calls across components are forbidden
- node-linker=hoisted in .npmrc is mandatory; Metro cannot follow pnpm symlinks reliably
- Metro config must add .sql to sourceExts; babel-plugin-inline-import must handle .sql for drizzle migrations

### Critical Pitfalls

1. **Expo Go is incompatible with the entire v1.0 stack** -- op-sqlite, HealthKit, and Skia all require a native dev build. Set up EAS Build in Phase 0. Budget 2-4 hours for the first EAS dev-client build and install on physical device.

2. **ATL/CTL cold-start shows red on Day 1** -- A single session with no prior history causes TSB to go strongly negative. Add a calibrating state for the first 14 days (or CTL < 10) that shows "Building baseline..." instead of a readiness band. Write the engine unit test for this in Phase 0.

3. **HealthKit triggers App Store rejection via privacy/analytics leakage** -- Two vectors: (a) generic NSHealthShareUsageDescription default strings from the config plugin cause rejection -- override in app.json with specific copy before first EAS build; (b) Sentry breadcrumbs capturing any HealthKit-derived values violate App Store guideline 5.1.3(i) -- audit all Sentry call sites before TestFlight.

4. **Submission logistics treated as a Day-28 task** -- App Store screenshots, privacy nutrition label (Health & Fitness data types must be declared), privacy policy at a live HTTPS URL, 1024x1024 app icon (no alpha channel), and App Store Connect app record creation are each 30-120 minutes of work. Start Day 19-20. Submit by Day 25 for a 3-day review buffer before July 28.

5. **Schema change without migration crashes TestFlight users** -- drizzle/ directory is append-only; never edit or delete existing migration files. Run npx drizzle-kit generate after every schema change and commit the output. Validate useMigrations() resolves success: true on a clean install before the first TestFlight build.

6. **EAS stale provisioning profile blocks HealthKit builds** -- After adding the HealthKit entitlement, manually regenerate the provisioning profile on the Apple Developer portal before running eas build. Define entitlements statically in ios.entitlements in app.json so EAS capability sync reads them.

## Implications for Roadmap

Based on research, the natural phase structure maps directly to the dependency chain in ARCHITECTURE.md and the deadline constraints from PROJECT.md:

### Phase 0: Foundation -- EAS + Engine + DB Schema (Days 1-4)
**Rationale:** The engine is the moat and the thesis. If the HSS computation chain cannot be made deterministic and fully unit-tested, nothing else matters. Validate the engine in vitest before writing a single line of UI. EAS Build and op-sqlite dev client must be set up now -- three of the four major stack components require a native build, and discovering this at Phase 2 is a multi-day setback.
**Delivers:** Monorepo scaffolded (pnpm workspaces, .npmrc hoisting, tsconfig project references); pure-TS engine with >=20 vitest unit tests passing including cold-start test asserting single-session TSB is NOT a red band; drizzle schema with initial migration; Metro .sql config validated; EAS dev client installed on physical device.
**Avoids:** Pitfalls 1 (Expo Go dead end -- EAS from Day 1), 2 (cold-start -- write the test now), 6 (Metro .sql config -- validate early)
**Research flag:** Standard patterns -- well-documented. Skip research-phase.

### Phase 1: Core Logger -- Lifting + Run + Home Screen (Days 5-13)
**Rationale:** The offline lifting and run logger with session HSS and the home screen readiness band are the minimum viable product. Logging speed (match Strong entry speed with pre-populated previous values and steppers, <=3 taps per set) is existential per PROJECT.md -- it is a constraint, not a polish item. The home screen ATL/CTL chart and readiness band depend on load_daily being populated by the db layer built in Phase 0.
**Delivers:** Lifting session screen (seeded exercise library, weight/reps steppers, RPE quick-row pinned to set card with last-used pre-selected, previous-session recall pre-populated, warmup flag, rest timer); run/conditioning screen (distance + duration -> auto-pace, activity type picker, optional avgHR); session finish screen showing HSS; home screen with readiness band (calibrating state for CTL < 10) + 28-day ATL/CTL chart; onboarding capturing user profile inputs; offline save + recomputeLoadDaily reactive chain.
**Avoids:** Pitfall 5 (scope creep -- maintain DEFERRED.md; any feature not in BUILD.md section 0 goes there); Pitfall 7 (migration discipline from Day 5)
**Research flag:** Skia/victory-native chart setup may surface peer dep version conflicts in an SDK 56 monorepo context. Recommend research-phase for Phase 1 to cover the victory-native 41 + Skia ^2.x integration.

### Phase 2: HealthKit Integration (Days 14-18)
**Rationale:** HealthKit is the lowest-priority v1.0 feature -- explicitly the first to cut if the timeline slips (PROJECT.md). It is isolated here because it is a data-mapping adapter that produces endurance_segment rows and triggers the same recomputeLoadDaily() path as manual entry. Physical device is mandatory for all acceptance testing.
**Delivers:** HealthKit run/HR/bodyweight import on first open with permission prompt; write logged sessions back to Health app; deduplication against manual entries by timestamp range; custom NSHealthShareUsageDescription / NSHealthUpdateUsageDescription strings in app.json; physical-device acceptance testing of all HealthKit flows.
**Avoids:** Pitfall 1 (dev client already live from Phase 0); Pitfall 3 (physical device pre-condition -- must be satisfied before Day 14); Pitfall 6 (EAS stale provisioning -- manually regenerate profile on Apple portal before first eas build in this phase)
**Research flag:** HealthKit deduplication strategy and incremental sync pattern (lastSyncedAt in user_profile) have sparse canonical documentation. Recommend research-phase for Phase 2.

### Phase 3: Polish + App Store Submission (Days 19-27)
**Rationale:** Submission is a multi-step process requiring 5-10 distinct human tasks, each taking 30-120 minutes. Research estimates 3-6 days of elapsed time if started late. Starting on Day 19 and submitting by Day 25 maintains a 3-day review buffer before July 28. Privacy nutrition label and Sentry audit must happen before TestFlight, not after. Treat submission logistics as a parallel workstream from Day 19.
**Delivers:** App Store Connect app record created (Day 19 -- human step); privacy policy at live HTTPS URL (GitHub Pages); privacy nutrition label fully completed in App Store Connect (Health & Fitness data types declared, App Functionality only, not linked to identity); Sentry configured with HealthKit data scrubbed from all events and breadcrumbs; 1024x1024 app icon with no alpha channel; App Store screenshots at 6.5" and 5.5" resolutions; description and keywords; binary submitted by Day 25.
**Avoids:** Pitfall 4 (privacy label missing -- complete by Day 22); Pitfall 9 (Sentry leakage -- audit before TestFlight upload); Pitfall 10 (submission logistics underestimated -- front-load to Day 19-20)
**Research flag:** Standard patterns -- App Store Connect submission is fully documented. Skip research-phase.

### Phase Ordering Rationale

- Engine first: validates the entire product thesis before any UI investment; if HSS cannot be made sound the product fails regardless of UI quality
- EAS dev-client in Phase 0: three of the four major stack components require a native build; there is no Expo Go fallback; a 2-4 hour EAS setup in Phase 0 prevents a 2-day crisis in Phase 2
- DB schema in Phase 0 alongside engine: mobile features in Phase 1 call db functions; schema and migration runner must exist before any logging screen is wired up; drizzle migration discipline must be established from the first schema commit
- HealthKit last: the only v1.0 feature that can be cut without breaking the core value proposition; keeping it isolated means the decision to cut it does not cascade into Phase 1 deliverables
- App Store logistics parallel to Phase 3 polish starting Day 19: screenshots can and should be taken during Phase 2 physical device testing

### Research Flags

Needs deeper research during planning:
- **Phase 1:** victory-native 41 + Skia ^2.x in SDK 56 monorepo -- confirm npx expo install @shopify/react-native-skia resolves to ^2.x and not 3.x; may need explicit version pin
- **Phase 2:** HealthKit deduplication strategy (comparing HK workout timestamp ranges against existing endurance_segment rows) and incremental sync pattern -- limited canonical documentation; plan implementation before coding

Standard patterns (skip research-phase):
- **Phase 0:** pnpm monorepo + vitest for pure TS + drizzle-kit migration generation are well-documented with official guides
- **Phase 3:** App Store Connect submission process is fully documented by Apple

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | MEDIUM | All versions cross-checked via npm and official changelogs as of 2026-06-29; Expo SDK 56 is stable (May 2026 release); version pins confirmed sound |
| Features | MEDIUM | Based on competitor analysis (Strong, Hevy, HyTrack, Strava) and community sources; no primary user interviews conducted |
| Architecture | MEDIUM | op-sqlite + drizzle write-then-recompute pattern synthesized from official docs and community sources; useLiveQuery reactive chain not yet validated in this exact SDK 56 monorepo configuration |
| Pitfalls | MEDIUM | Cross-checked against Apple docs, Expo docs, GitHub issues; EAS provisioning profile bug (eas-cli#2117) is a documented real issue |

**Overall confidence:** MEDIUM

### Gaps to Address

- **victory-native + Skia peer dep in practice:** The >=1.2.3 <3.0.0 constraint is confirmed from npm metadata but has not been validated with npx expo install in an SDK 56 monorepo. Resolve during Phase 1 chart component setup; add explicit Skia version pin if needed.
- **useLiveQuery reactive hook API in drizzle-orm 0.45.2:** This is the linchpin of the write -> UI-update chain. Confirm the hook API and op-sqlite connector behavior match the ARCHITECTURE.md pattern before building the home screen.
- **CTL calibration threshold:** The "14 days or CTL > 10" threshold for exiting the calibrating state is a reasonable engineering estimate but not literature-anchored. Make this configurable in EngineConfig (DEFAULT_CONFIG value: 10) so it can be tuned post-launch without a schema migration.
- **HSS constant tuning:** The kStrength ~= 2.0 normalization constant is a literature-anchored starting point. The engine must store raw components (strengthStress, enduranceStress) so constants can be re-fit later without a schema change or app release.

## Sources

### Primary (official documentation)
- https://expo.dev/changelog/sdk-56 -- SDK version, RN 0.85, iOS minimum, expo-router fork from React Navigation
- https://op-engineering.github.io/op-sqlite/docs/installation/ -- prebuild requirement, no config plugin needed, JSI pattern
- https://orm.drizzle.team/docs/connect-op-sqlite -- migration setup, babel/metro config, drizzle.config.ts settings
- https://docs.expo.dev/build-reference/ios-capabilities/ -- EAS entitlement sync behavior, static vs dynamic entitlement declaration
- https://developer.apple.com/app-store/app-privacy-details/ -- nutrition label requirements, Health & Fitness data type declarations
- https://developer.apple.com/app-store/review/guidelines/ -- section 5.1.3 health data restrictions
- https://docs.expo.dev/guides/monorepos/ -- pnpm workspace setup, .npmrc hoisting requirement for Metro

### Secondary (cross-checked community sources)
- victory-native npm (v41.26.0) -- Skia peer dep constraint >=1.2.3 <3.0.0 confirmed
- @kingstinct/react-native-healthkit GitHub (README, May 2026 update) -- nitro modules dependency, Expo Go limitation, config plugin setup
- EAS CLI Issue #2117 -- stale provisioning profile bug after HealthKit capability add
- React Native Monorepo With pnpm Workspaces, Callstack -- singleton pinning, hoisted vs isolated linker tradeoffs
- Strong App Review 2025 / Hevy vs Strong 2026 -- previous-session recall as #1 feature, 3-tap set entry benchmark
- CTL/ATL/TSB guide, TrainingPeaks -- model limitations and cold-start behavior
- Offline-First RN: SQLite + Drizzle 2026, reactnativerelay.com -- write -> useLiveQuery reactive chain pattern

---
*Research completed: 2026-06-29*
*Ready for roadmap: yes*
