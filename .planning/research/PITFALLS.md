# Pitfalls Research

**Domain:** Expo + HealthKit iOS training tracker with local SQLite, App Store submission under hard deadline
**Researched:** 2026-06-29
**Confidence:** MEDIUM (cross-checked across Apple docs, Expo docs, GitHub issues, community sources)

---

## Critical Pitfalls

### Pitfall 1: HealthKit Silently Does Nothing in Expo Go

**What goes wrong:**
You build your HealthKit integration code, launch it in Expo Go to test, get no errors, but also get no data and no permission dialog. The module loads without crashing but all HealthKit calls return empty or silently fail. You discover this late and lose 1-2 days rebuilding a dev client.

**Why it happens:**
`@kingstinct/react-native-healthkit` uses native modules (via `react-native-nitro-modules`). Expo Go ships a fixed native binary that does not include custom native modules. The package simply cannot function in that environment. Developers assume "works in simulator without errors" means "works."

**How to avoid:**
Run `npx expo install @kingstinct/react-native-healthkit react-native-nitro-modules` and add the config plugin to `app.json` **before writing any HealthKit code**. Build a dev client immediately with `eas build --profile development --platform ios` and install it on a physical device. Use this client for all HealthKit development. Never test HealthKit in Expo Go.

**Warning signs:**
- Permission dialog never appears when calling `requestAuthorization()`
- `getWorkouts()` returns an empty array on first call with no error
- No HealthKit entitlement appears in Xcode build logs

**Phase to address:** Phase 2 — HealthKit (Day 14). But the dev client build should happen at the start of Phase 2, not midway through it. Budget 2-4 hours for the first EAS dev client build.

---

### Pitfall 2: EAS Entitlement Sync Produces Stale Provisioning Profile

**What goes wrong:**
You add the HealthKit capability, run `eas build`, and get a build failure: "Provisioning profile doesn't support the com.apple.developer.healthkit entitlement." The capability is confirmed enabled on the Apple Developer portal, but EAS fetched an old cached profile.

**Why it happens:**
EAS Build synchronizes capabilities automatically when entitlements are defined statically in `ios.entitlements`. However, there is a documented lag (GitHub issue expo/eas-cli#2117) where the build environment uses a previously cached provisioning profile that predates the HealthKit capability being added. This is a known EAS-side synchronization bug.

**How to avoid:**
After enabling HealthKit in your config plugin, go to Apple Developer portal → Certificates, IDs & Profiles → Profiles and manually regenerate the affected provisioning profile. Then run `eas build`. Alternatively, in `eas.json` set `"credentialsSource": "remote"` and force a profile re-fetch. If builds still fail, use `EXPO_NO_CAPABILITY_SYNC=1 eas build` and manage the profile manually via Xcode or the portal.

Also: define entitlements in the `ios.entitlements` object in `app.json` directly (not inside a config plugin modifier function) — EAS capability sync only reads statically-defined entitlements.

**Warning signs:**
- Build log says "capability sync complete" but build fails on entitlements
- Apple Developer portal shows HealthKit enabled on the App ID but the build still fails
- Error message mentions provisioning profile, not the entitlement itself

**Phase to address:** Phase 2 — HealthKit. Add "regenerate provisioning profile on Apple portal" as a manual human step in PROGRESS.md before starting the EAS build.

---

### Pitfall 3: HealthKit Requires a Physical Device — No Simulator Fallback

**What goes wrong:**
All HealthKit development is done in the iOS simulator. Everything compiles, no crashes, but every API call returns empty because the Health app doesn't exist on the simulator. The first time real HealthKit data appears is on a physical device, two days before the submission deadline.

**Why it happens:**
The iOS simulator supports a limited subset of HealthKit (some read operations for manually seeded data), but real workouts, Apple Watch data, HR readings, and bodyweight writes require the Health app — which only exists on physical devices. Developers simulate all other features and forget this exception until late.

**How to avoid:**
Get the dev client on a physical iPhone by Day 14 (Phase 2 start). Seed the iPhone's Health app with test workouts manually before running any integration code. Keep the device plugged in or connected via wireless debugging for the entire HealthKit phase. Do not count any HealthKit feature as done until it has run on device with real Health app data.

**Warning signs:**
- You've been testing HealthKit only in the simulator
- `getWorkouts()` returns workouts but they are only ones you manually seeded in Simulator's Health settings
- No Apple Watch synced data appears despite the physical device having it

**Phase to address:** Phase 2 — HealthKit. Put "physical device with Health data ready" as a pre-condition in the phase acceptance criteria.

---

### Pitfall 4: App Store Rejection for Missing or Incomplete Privacy Nutrition Label

**What goes wrong:**
You submit the app. Apple rejects it within 1-3 days with "Missing privacy manifest" or "Privacy nutrition label does not accurately reflect data collection." You have to update, resubmit, and wait another 1-3 days. This burns 3-6 days of your review buffer and potentially blows the July 28 deadline.

**Why it happens:**
Apps using HealthKit must declare data in the App Store Connect Privacy Nutrition Label under the **Health & Fitness** category. This is mandatory even if you only use the data for app functionality (not advertising). Developers fill this out hastily during submission or skip it assuming it's optional. The Apple reviewer checks it carefully for health apps.

**How to avoid:**
Complete the privacy nutrition label during Phase 3 (Polish + Ship), not at submission time. Required declarations for this app:

- **Health & Fitness > Health data**: collected (workouts, HR, bodyweight from HealthKit), used for App Functionality only, not linked to identity, not used for tracking.
- **Health & Fitness > Fitness data**: collected (workout sessions), same as above.

Write a privacy policy (can be a simple hosted page) that explicitly states: "We do not use HealthKit data for advertising, marketing, or data mining. HealthKit data is stored locally on your device and is never transmitted to our servers."

Do NOT add any analytics SDK (Sentry, Amplitude, Mixpanel, etc.) that could receive HealthKit-adjacent data — that triggers immediate rejection under App Store guideline 5.1.3(i).

**Warning signs:**
- Privacy nutrition label left blank or partially filled in App Store Connect
- Sentry or another analytics SDK is configured to receive workout/health events
- No privacy policy URL set in App Store Connect before submission

**Phase to address:** Phase 3 — Polish + Ship. Privacy nutrition label is a human-only step; add to the Phase 3 checklist in PROGRESS.md. Write the policy page and privacy label entry at the start of Phase 3, not the end.

---

### Pitfall 5: Generic HealthKit Permission Strings Cause Rejection

**What goes wrong:**
The `@kingstinct/react-native-healthkit` config plugin sets default permission strings: "Allow $(PRODUCT_NAME) to check health info" and "Allow $(PRODUCT_NAME) to update health info." These are too vague. Apple reviewers reject apps with non-descriptive usage strings because users cannot make an informed consent decision.

**Why it happens:**
Config plugin defaults are placeholders meant to be replaced. Developers wire up the plugin, see it compile, and ship the defaults. Apple's guidelines require usage descriptions to "specifically describe how the app will use the data."

**How to avoid:**
Override the defaults in `app.json`:
```json
{
  "plugins": [
    ["@kingstinct/react-native-healthkit", {
      "NSHealthShareUsageDescription": "Apsis reads your workouts, heart rate, and body weight from Health to compute your training load and readiness score without manual re-entry.",
      "NSHealthUpdateUsageDescription": "Apsis writes your logged lifting and running sessions back to Health so they appear alongside your other fitness data."
    }]
  ]
}
```

**Warning signs:**
- `app.json` plugin entry is `"@kingstinct/react-native-healthkit"` with no options object
- `grep NSHealthShareUsageDescription ios/*/Info.plist` shows the default placeholder text

**Phase to address:** Phase 2 — HealthKit. Write these strings before the first EAS production build. They are not changeable without a new binary.

---

### Pitfall 6: Metro Bundler Cannot Process .sql Migration Files Without Config

**What goes wrong:**
`npx drizzle-kit generate` creates `.sql` files in `drizzle/` directory. When the app imports the generated `migrations.js` which references these files, Metro crashes with a module resolution error. Alternatively, migrations silently do not run and the database starts with no schema.

**Why it happens:**
Metro's default `sourceExts` does not include `.sql`. Drizzle's op-sqlite adapter requires migration SQL to be bundled as inline strings (not loaded from disk at runtime). Two separate configs must be updated and both are easy to miss.

**How to avoid:**
In `babel.config.js`, add:
```js
plugins: [['babel-plugin-inline-import', { extensions: ['.sql'] }]]
```

In `metro.config.js`, extend `sourceExts`:
```js
config.resolver.sourceExts = [...config.resolver.sourceExts, 'sql'];
```

In `drizzle.config.ts`, set `dialect: 'sqlite'` and `driver: 'expo'` (not `'better-sqlite'` or anything else).

Also install `babel-plugin-inline-import` as a dev dependency — it is not bundled with drizzle.

**Warning signs:**
- `npx expo start` throws "Unable to resolve module './migrations'" or similar
- App launches but all tables are missing (no schema was applied)
- `useMigrations()` hook never resolves to `success: true`

**Phase to address:** Phase 1 — Local Logger (db setup). Validate metro + babel config works with a trivial `.sql` file before writing any real schema migration.

---

### Pitfall 7: Schema Changes Without Migrations Crash Existing Users on Update

**What goes wrong:**
During development you add or rename a column by modifying the schema file and clearing the simulator. On TestFlight, a tester updates to a new build and the app crashes on launch because `useMigrations()` runs an incompatible migration sequence against the existing database.

**Why it happens:**
Local SQLite is persistent across app updates. Unlike development where you can blow away the simulator, real-device testers have live data. Any schema change must be expressed as an incremental drizzle migration. Developers editing the schema directly without generating a new migration is the most common cause.

**How to avoid:**
Treat `drizzle/` as append-only. Never edit or delete existing migration files — only add new ones. After any schema change run `npx drizzle-kit generate` and commit the output. Add a CI check or pre-commit hook that fails if the schema has changed but no new migration was generated.

Implement `useMigrations` error handling that shows a "Database error — please reinstall" screen rather than a blank crash.

**Warning signs:**
- You deleted and regenerated a migration file
- You edited the table definition without running `drizzle-kit generate`
- TestFlight testers report blank screen or crash on update

**Phase to address:** Phase 1 — Local Logger. Establish the migration discipline from the first schema commit, not after the first TestFlight build.

---

### Pitfall 8: ATL/CTL Cold-Start Makes Readiness Band Useless for New Users

**What goes wrong:**
A new user logs their first session. ATL spikes because it has a 7-day exponential average with only 1 data point. CTL is still near zero (42-day average needs weeks of data). TSB = CTL − ATL is strongly negative, so readiness shows "red" immediately after a single moderate workout. The user thinks the app is broken or is telling them they're destroyed after a light session. They churn before the model becomes meaningful.

**Why it happens:**
The ATL/CTL/TSB model assumes weeks of continuous data to stabilize. It is designed for athletes who already have a training history loaded. Displaying a raw TSB-derived readiness band on day 1 surfaces a meaningless and alarming number.

**How to avoid:**
Add a "calibration period" concept to the readiness display: for the first 14 days (or until CTL > some minimum threshold, e.g. 10), show the readiness band with a disclaimer ("Building baseline — check back after a week of logging") rather than hiding the band entirely. Alternatively, seed CTL with a small non-zero value based on onboarding answers (training frequency, perceived fitness level) to give the model a warm start.

The engine already accepts `dailyHSSByDay` as a historical array — the UI layer can populate this with zeroes for days before first use, which is correct behavior (rest = 0 HSS), but the readiness display logic must handle low-CTL states gracefully.

**Warning signs:**
- Onboarding has no question about prior training history
- `readinessBand()` is called on day 1 with CTL near zero and displayed raw
- Test case: a single 60-point session as the only entry produces "red" readiness

**Phase to address:** Phase 0 — Engine. Write a specific test case for the cold-start state. Phase 1 — Local Logger: add the UI disclaimer for low-CTL state.

---

### Pitfall 9: HealthKit AnalyticsSDK Data Leakage Triggers Automatic Rejection

**What goes wrong:**
You add Sentry for crash reporting (approved in BUILD.md §6 Phase 3). If Sentry's breadcrumb or event capture picks up workout/health-related context — even just a screen name like "WorkoutDetailScreen" that appears during a HealthKit fetch — Apple's reviewer may flag it as transmitting health data to a third party. More concretely: if you log any HealthKit-returned values (HR, workout duration, etc.) to Sentry events, this is a direct violation of App Store guideline 5.1.3(i).

**Why it happens:**
Developers add crash reporting thinking it's "just errors" and don't realize that any HealthKit data in scope during a Sentry capture event constitutes a prohibited disclosure. The guideline language is broad: "data gathered in the health, fitness, and medical research context...including from the HealthKit API."

**How to avoid:**
Configure Sentry (or any analytics SDK) with these safeguards:
1. Explicitly scrub all HealthKit-derived values from before any `captureEvent()` or breadcrumb creation. Never pass workout HSS, HR values, set details, or load numbers as Sentry context.
2. Do not capture breadcrumbs inside HealthKit data-processing code paths.
3. Sentry can capture crashes and UI errors — it should never see fitness data.

Before submission, audit every `Sentry.captureEvent/captureException/addBreadcrumb` call and confirm no health-context values are in scope.

**Warning signs:**
- Sentry context includes `workoutId`, `hss`, `heartRate`, or similar keys
- Breadcrumbs are enabled globally without filtering
- You're logging structured events for HealthKit import success/failure that include data values

**Phase to address:** Phase 3 — Polish + Ship. Do the Sentry audit before TestFlight, not after. Add a code-review checklist item for this.

---

### Pitfall 10: App Store Submission Logistics Underestimated — Review Buffer Blown

**What goes wrong:**
Phase 3 is budgeted at 10 days but the final 3 days are consumed by: (1) generating correct App Store screenshots at the required resolutions, (2) writing App Store description and keywords, (3) setting up the privacy policy URL (must be a live URL — can't be localhost), (4) getting TestFlight build reviewed by Ethan, (5) wrangling app icons at 1024x1024 and all device sizes. The binary goes up on July 29, Apple takes 2 days to review, and the deadline is missed.

**Why it happens:**
Developers treat submission as "click submit" rather than a 5-10 step process each taking real time. Screenshots alone for an iOS app require 6.5" and 5.5" device sizes (12 Pro Max and 8 Plus), plus optional iPad — each at the correct dimensions with the status bar cropped. First-time App Store submitters routinely underestimate this by 2-3 days.

**How to avoid:**
Start Phase 3 with a submission-logistics sprint on Day 19-20:
- Generate app icon at 1024x1024 (Expo will generate all sub-sizes).
- Deploy a 1-page privacy policy to a permanent URL (GitHub Pages or similar — 30 minutes).
- Create the App Store Connect app record immediately (human step — Ethan must do this).
- Take TestFlight screenshots on the physical device during HealthKit testing (in Phase 2).
- Set aside Day 25-26 explicitly for App Store metadata (description, keywords, screenshots).
- Submit by July 25 at the latest to have a 3-day buffer.

**Warning signs:**
- No App Store Connect record created yet by Day 19
- Privacy policy has no live URL
- Screenshots not taken during Phase 2 device testing
- Submission planned for July 28 with no buffer

**Phase to address:** Phase 3 — Polish + Ship. This is the highest-probability deadline-killer. Treat submission logistics as a parallel workstream starting Day 19, not a task at the end of Day 28.

---

### Pitfall 11: Nice-to-Have Features Slip Into Phase 1 and Phase 2 Scope

**What goes wrong:**
During lifting log implementation, it feels natural to add plate math (what plates to put on the bar). That leads to a 45 LB plate inventory screen. Then rest timers. Then PR detection with confetti. Three days pass and the core logging flow isn't done. HealthKit gets pushed to 5 days, Polish gets pushed to 3 days, and either one or both get cut under deadline pressure but the extra polish from Phase 1 was also never finished cleanly.

**Why it happens:**
These features are genuinely useful and feel like they're right there. The code for the lifting logger is already open. The effort estimate is always "just an hour." Solo builders have no product manager to say no.

**How to avoid:**
Maintain a `DEFERRED.md` at repo root that is the dumping ground for all ideas. Before implementing any feature not in BUILD.md §4.4 or §5, write it in `DEFERRED.md` instead of building it. The test is: "Would the Phase acceptance criteria (§4.4, §5, §6) pass without this?" If yes, defer it.

Specifically defer: plate math calculator, rest timers, PR detection/confetti, exercise search with fuzzy matching, set reordering, supersets, custom exercise categories. All of these are v1.1.

**Warning signs:**
- You're working on a feature not explicitly in BUILD.md §0 "four things only"
- Phase 1 is at Day 10 and the home screen hasn't been started
- You've added a dependency not in §3 without asking

**Phase to address:** All phases. Enforce at every phase transition by re-reading BUILD.md §0 and §10 before starting any new task.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Using default HealthKit permission strings from config plugin | No copy to write | App Store rejection on review | Never |
| Skipping drizzle migration for a schema change during dev | Faster iteration | Crash for TestFlight users with existing data | Never past Day 13 (first TestFlight) |
| Testing HealthKit in simulator only | No device needed | Discover all bugs on Day 27 | Only for unit tests of data-mapping logic, never for permission/read/write flows |
| Seeding e1RM from Epley formula from first logged set | No onboarding friction | First-session strength stress score will be inaccurate | Acceptable for v1.0; document the limitation |
| Raw TSB displayed on Day 1 without CTL guard | Simpler code | "Red" readiness on first workout causes churn | Never; add CTL guard in readinessBand UI layer |
| Single migration file for entire initial schema | Simple | Cannot evolve schema without manual resets | Acceptable for initial schema only; all subsequent changes must be incremental migrations |

---

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| HealthKit entitlements via EAS | Adding entitlements in a withEntitlements modifier (dynamic) | Define them statically in ios.entitlements object in app.json so EAS capability sync can read them |
| HealthKit + Sentry | Logging HealthKit-derived values in Sentry events | Scrub all health data from Sentry context; capture only crash stack traces |
| op-sqlite migrations | Importing .sql files without configuring babel and metro | Add babel-plugin-inline-import and extend metro sourceExts before writing any migration code |
| EAS + HealthKit provisioning | Trusting EAS to auto-sync after first HealthKit capability add | Manually regenerate provisioning profile on Apple portal after adding HealthKit entitlement |
| Privacy nutrition label | Leaving it blank or partially filled | Complete all Health & Fitness data type declarations before first TestFlight upload |
| iCloud with HealthKit data | Storing workouts or load_daily in iCloud sync | v1.0 has no iCloud sync; if added in v1.1, HealthKit-derived fields must be excluded |

---

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Recomputing load_daily for entire history on every workout save | Acceptable for 30 days, slow for a year of data | Incremental update: only recompute days from the new workout's date forward | Around 6 months of daily logging (~180+ recalculations) |
| Fetching all workouts from HealthKit on every app open | Fast at 10 workouts, slow at 1000 | Sync incrementally: track `lastSyncedAt` in user_profile and fetch only new workouts | Around 200-300 HealthKit workouts |
| Running migrations on main thread | Acceptable for 1-2 migrations, hangs UI for 10+ | `useMigrations` hook runs async; show a loading screen until `success: true` | First app update with a complex migration |
| Querying `load_daily` without an index on `localDate` | Fast with 30 rows, slow at 365+ | Add index on `load_daily(localDate)` in initial schema | Around 200+ daily rows |

---

## "Looks Done But Isn't" Checklist

- [ ] **HealthKit read permission**: Dialog appeared and was accepted — verify by checking `getRequestStatusForAuthorization()` returns `SHKAuthorizationStatusSharingAuthorized`, not just that the dialog was shown once
- [ ] **HealthKit write permission**: Workouts appear in the Health app after save — open Health app on device and confirm the logged workout shows under Workouts
- [ ] **Privacy nutrition label**: Filled out in App Store Connect — check that the submission form doesn't show "No data collected" if you do collect Health data
- [ ] **Privacy policy URL**: Accessible via a live HTTPS URL — test the URL from a different network
- [ ] **Migrations run on device**: `load_daily` table exists and is populated after first workout save on a fresh device install
- [ ] **ATL/CTL on fresh install**: New user's readiness band displays a calibration message, not a raw red/amber/green based on 1 data point
- [ ] **NSHealthShareUsageDescription**: Contains a specific description, not the config plugin default — check `ios/*/Info.plist` after prebuild
- [ ] **App icon**: 1024x1024 PNG with no alpha channel (alpha causes immediate App Store rejection) — verify with `file` command or online validator

---

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Expo Go used for HealthKit development | LOW | Build dev client (4 hours), reinstall on device, re-run all HealthKit tests |
| EAS stale provisioning profile | LOW | Regenerate profile on Apple portal, force EAS rebuild (~1 hour) |
| App Store rejection for privacy label | MEDIUM | Update nutrition label in App Store Connect, resubmit (no new binary needed), wait 1-3 days |
| App Store rejection for usage description strings | HIGH | Update strings in app.json, rebuild binary, upload to App Store Connect, resubmit, wait 1-3 days |
| Migration crash for TestFlight users | MEDIUM | Generate corrective migration, new build, re-upload to TestFlight, ask testers to update |
| HealthKit scope blown — defer to v1.1 | LOW | The BUILD.md §6 buffer plan: submit offline logger without HealthKit; add HealthKit in v1.1 fast-follow |
| Deadline missed due to submission logistics | HIGH | No recovery within the July window; mitigate by starting App Store Connect prep on Day 19 |

---

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Expo Go / dev client confusion | Phase 2 start (Day 14) | EAS dev client installed on physical device before writing any HealthKit code |
| EAS stale provisioning profile | Phase 2 start (Day 14) | `eas build` succeeds and HealthKit permission dialog appears on device |
| Physical device never used for HealthKit | Phase 2 (Day 14–18) | All HealthKit acceptance criteria tested on real device, not simulator |
| Privacy nutrition label missing | Phase 3 start (Day 19) | App Store Connect privacy responses completed and saved before submission |
| Generic permission strings | Phase 2 config (Day 14) | `grep NSHealthShareUsageDescription ios/*/Info.plist` shows custom text |
| Metro bundler .sql config | Phase 1 db setup (Day 5) | `useMigrations()` resolves `success: true` on a clean install |
| Schema change without migration | Phase 1 + ongoing | CI check or pre-commit hook validates drizzle snapshot matches generated migrations |
| ATL/CTL cold-start misleads users | Phase 0 engine (Days 1–4) | Unit test: single-session cold-start produces CTL < threshold; Phase 1: UI shows calibration state |
| Sentry leaks health data | Phase 3 (Day 19+) | Audit of all Sentry calls confirms no health-context values |
| Submission logistics underestimated | Phase 3 start (Day 19) | App Store Connect record exists, privacy policy URL live, screenshots taken by Day 22 |
| Nice-to-have feature scope creep | All phases | Phase entry: re-read BUILD.md §0 and §10; any feature not in §0 goes to DEFERRED.md |

---

## Sources

- [Expo iOS Capabilities Documentation](https://docs.expo.dev/build-reference/ios-capabilities/) — entitlement sync behavior, EAS build flow
- [EAS CLI Issue #2117 — HealthKit entitlement out of sync](https://github.com/expo/eas-cli/issues/2117) — stale provisioning profile bug
- [react-native-health Expo docs](https://github.com/agencyenterprise/react-native-health/blob/master/docs/Expo.md) — dev client requirement
- [kingstinct/react-native-healthkit GitHub](https://github.com/kingstinct/react-native-healthkit) — nitro modules dependency, Expo Go limitation
- [Apple App Privacy Details](https://developer.apple.com/app-store/app-privacy-details/) — nutrition label requirements
- [Apple HealthKit Privacy Guidelines](https://developer.apple.com/documentation/healthkit/protecting-user-privacy) — data use restrictions
- [App Store Review Guidelines — section 5.1.3](https://developer.apple.com/app-store/review/guidelines/) — health data restrictions
- [Drizzle ORM + OP SQLite docs](https://orm.drizzle.team/docs/connect-op-sqlite) — migration setup, babel/metro config
- [Drizzle + Expo SQLite discussion #2447](https://github.com/drizzle-team/drizzle-orm/discussions/2447) — real-world migration pitfalls
- [Training Metrics Demystified — Boundless](https://boundless10200.com/news-updates/training-metrics-demystified-tss-np-if-ctl-atl-tsb-and-why-rpe-is-still-the-adult-in-the-room) — ATL/CTL limitations and RPE reliability

---
*Pitfalls research for: Expo + HealthKit iOS training tracker (Apsis)*
*Researched: 2026-06-29*
