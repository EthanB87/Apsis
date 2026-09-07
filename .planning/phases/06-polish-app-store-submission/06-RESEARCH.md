# Phase 6: Polish & App Store Submission - Research

**Researched:** 2026-07-12
**Domain:** iOS App Store release engineering (EAS build/submit), crash-reporting privacy hygiene, Apple privacy compliance, exercise-data content curation
**Confidence:** MEDIUM-HIGH (release mechanics HIGH via official docs; Apple review-guideline interpretation MEDIUM — Apple's guidance is directional, not a compiler; bwFactor curation for ~107 new movements LOW/ASSUMED by nature)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Crash reporting (REL-03)**
- D-01: Install `@sentry/react-native` in Phase 6 — v1.0 ships with real crash reporting.
- D-02: Scope = native crashes + unhandled JS errors ONLY. No performance tracing, no session replay, default breadcrumbs pruned to the minimum.
- D-03: `beforeSend` strips everything except an ALLOWLIST (error type/message, stack frames, device/OS model, app version). Health-derived values (HR, HSS, bodyweight, distance, durations) cannot leak by omission. The REL-03 audit verifies the allowlist, not a denylist. `sendDefaultPii: false`. Pairs with Phase 5 T-05-01 (no raw health values in console logs — these become breadcrumbs if breadcrumbs are ever enabled).

**Privacy policy & nutrition label (REL-02)**
- D-04: Privacy policy lives at **apsistraining.com/privacy** (user owns the domain). Static hosting mechanics are Claude's discretion.
- D-05: Claude drafts the policy as a plan task, tailored to Apsis's actual posture (offline-first; HealthKit stays on-device; only off-device data is Sentry crash diagnostics). User reviews before it goes live.
- D-06: Nutrition label declares only what actually leaves the device — expected: Diagnostics → Crash Data (not linked to identity, no tracking). Health & Fitness is NOT declared as "collected" because HealthKit data never leaves the device. **Researcher must verify against current Apple guidance** — accuracy is the requirement, not minimalism.

**Store listing & screenshots (REL-01)**
- D-07: App Store name = "Apsis: Hybrid Training Log" (≤30 chars) direction; subtitle sells the wedge ("One score for lifting + running"). Final strings drafted in a plan task, user approves.
- D-08: Athlete-direct copy voice — terse, second-person, mono-caption energy ("You lift. You run. One number tells you what it cost.").
- D-09: Device-framed screenshots on brand-dark (void) backgrounds, short mono captions. Featured screens in order: TODAY hero (HSS ring + readiness light), lift logger ledger, run form + History, Apple Health integration. **6.9" iPhone set only** — App Store Connect scales down; no iPad target.
- D-10: Free, no IAP. Monetization is v1.1+.
- D-11: Category = Health & Fitness (primary).

**Submission logistics (REL-04)**
- D-12: External TestFlight beta BEFORE review submission, public link to hybrid-athlete friends/HYROX communities. Window ~July 15–22, hard stop. Gate: crashes/data-loss/HealthKit failures block submission; small UX friction fixes taken if quick; feature requests bank for v1.1. Fallback: shrink to internal TestFlight self-test if recruiting stalls by ~July 15.
- D-15: Manual release after approval (user presses Release). No phased release.
- D-16: Full App Review walkthrough note: no account/login (fully offline), HealthKit optional/skippable in onboarding, where to reconnect in Settings, all health data stays on-device except Sentry crash diagnostics.
- D-17: Marketing version stays 1.0.0; EAS auto-increments buildNumber (`autoIncrement` in eas.json production profile). Beta/review builds differ only by build number.
- D-18: `ITSAppUsesNonExemptEncryption: false` — standard OS encryption only; skips the per-upload encryption questionnaire.

**Folded polish: exercise catalog**
- D-13: Expand `STARTER_EXERCISES` in `packages/db/src/seed.ts` from **43 to ~150** curated movements — major barbell/DB/KB lifts and variations, machines, cable work, core. Data-only change via the existing idempotent per-id upsert (backfills existing installs, zero migration). Each entry needs curated `bodyPart`, `bwFactor`, `entryMode` for honest HSS. Open datasets (e.g. free-exercise-db) may inform names; `bwFactor` curation is manual. **Must land before the July 15 beta build.**
- D-14: Fix `ab-wheel` and `hanging-leg-raise` — currently `bwFactor: null`, scoring ~0 HSS at 0 entered weight. Assign honest bwFactors (push-up-style semantics: weight field = added external load only). Any other bodyweight-moved D-13 entries follow the same rule.

### Claude's Discretion
- Static hosting mechanics for apsistraining.com/privacy (DNS/host choice).
- Sentry project setup details (DSN handling, environment split dev/prod, release tagging).
- Exact keyword field contents (within D-07/D-08 voice).
- Screenshot production tooling (simulator captures + framing pipeline).
- bwFactor values for new catalog entries (literature/biomechanics-informed estimates).

### Deferred Ideas (OUT OF SCOPE)
- Custom exercise creation (v1.1) — user-created exercises with their own bwFactor/entry mode.
- Sentry beyond crashes (v1.1) — performance tracing, breadcrumbs, session replay, only after the allowlist audit pattern is proven in production.
- Monetization model (v1.1+) — v1.0 ships free, no IAP scaffolding.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| REL-01 | 1024×1024 icon (no alpha), App Store screenshots, complete store metadata | Icon alpha-channel VERIFIED defect found (see Pitfall 1); exact 6.9" screenshot pixel dimensions and mandatory Support URL field documented below |
| REL-02 | Privacy nutrition label + privacy policy (HTTPS URL) declare Health & Fitness data accurately | Apple's official "collect" definition confirms on-device-only HealthKit data is correctly NOT declared as collected (D-06 verified); Sentry Crash Data → Diagnostics category documented |
| REL-03 | Crash/analytics reporting scrubs all HealthKit-derived values before send | `@sentry/react-native` 8.18.0 install/init/allowlist pattern documented with testable `beforeSend` structure |
| REL-04 | Binary built via EAS, submitted to App Store review by ~July 25, 2026 | eas.json submit-profile schema, TestFlight external review timing, root-level eas.json/app.json conflict (VERIFIED defect) documented |
</phase_requirements>

## Summary

Phase 6 is release engineering, not feature work — four release requirements (REL-01..04) plus a folded content task (exercise catalog expansion, D-13/D-14). The stack additions are minimal: exactly one new package, `@sentry/react-native` (current stable **8.18.0**, published 2026-07-09 — confirmed clean via npm registry, official Sentry docs, and a legitimacy check: 7-year-old package, 2.7M weekly downloads, official `getsentry/sentry-react-native` GitHub repo, no postinstall script). Everything else in this phase is configuration, content, and process: app.json/eas.json edits, App Store Connect metadata, a static privacy-policy page, and the EAS build→TestFlight→submit pipeline.

Two verified defects were found during research that the plan MUST address before submission, not just "verify":
1. **The existing app icon (`apps/mobile/assets/images/icon.png`) has an alpha channel** (PNG colorType 6 / RGBA, confirmed by reading the file's IHDR chunk directly) — Apple's App Store icon requirement is a **hard opaque PNG with zero alpha**. The CONTEXT.md assumption that this only needs "verifying" is wrong; it needs **fixing** (flatten onto a solid background, re-export as RGB).
2. **Two conflicting, uncommitted-looking `app.json`/`eas.json` pairs exist**: the real one at `apps/mobile/{app.json,eas.json}` (bundle id `com.apsis.app`, matches all Phase 5 HealthKit entitlement work) and a stray duplicate at the **repo root** (`app.json`/`eas.json`, bundle id `com.apsistraining.apsis`) added in the same commit (`c031d25`) as the real config — almost certainly the result of running `eas build:configure` from the wrong directory. The root `app.json` is an incomplete fragment (no `name`/`slug`) so it can't drive a real build standalone, but its presence is a submission-day landmine if `eas submit` is ever run from the repo root instead of `apps/mobile/`.

Apple's privacy framework is unambiguous on the phase's central compliance question: **"collect" means transmitted off-device**; data processed only on-device (all HealthKit reads/writes in this app) is explicitly exempt from Privacy Nutrition Label disclosure per Apple's own developer documentation. D-06's posture (declare only Sentry Crash Data under Diagnostics, do NOT declare Health & Fitness as collected) is correct and confirmed, not merely assumed — this is the single highest-value verified finding for REL-02.

**Primary recommendation:** Treat this phase as three parallel tracks that converge at the same EAS build: (1) code — Sentry install/init/allowlist + exercise catalog expansion, both testable in vitest; (2) assets/metadata — icon fix, screenshots, store copy, privacy policy page, all producible without a build; (3) submission logistics — eas.json submit profile, ASC app record, TestFlight external group, review notes. Build order matters: land Sentry + catalog fixes in ONE EAS build cycle (native module change requires a fresh build per the Phase 4/5 precedent) before the July 14–15 TestFlight target, then treat every subsequent build purely as metadata/config (no more native deps) so the July 23–25 submission build carries zero new native-linking risk.

## Architectural Responsibility Map

> This phase has no application-tier UI; "tiers" below are release-pipeline equivalents.

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Crash/error capture (REL-03) | Client (mobile app runtime) | External SaaS (Sentry backend) | SDK runs in-process; `beforeSend` allowlist is a client-side gate before anything reaches Sentry's servers |
| Privacy policy page (REL-02) | CDN/Static | — | Pure static HTML, no app-server involvement; hosted independent of the mobile app release |
| App Store metadata/screenshots (REL-01) | External Service (App Store Connect) | — | Lives entirely in Apple's system, not in the repo (aside from source assets) |
| Exercise catalog data (D-13/D-14) | Database/Storage (SQLite via seed upsert) | Client (engine consumes bwFactor at commit time) | Seed data owns bwFactor/entryMode; `apps/mobile/lib/effectiveLoad.ts` + `@apsis/engine` consume it read-only |
| Build & submission pipeline (REL-04) | Build/CI (EAS cloud) | Client (app.json/eas.json config) | Windows dev host cannot prebuild iOS locally (established Phase 1–5 pattern) — EAS cloud is the only build surface |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@sentry/react-native` | **8.18.0** [VERIFIED: npm registry — `npm view @sentry/react-native version`, published 2026-07-09] | Native crash + unhandled JS error reporting | Official Sentry SDK for React Native/Expo; ships an Expo config plugin (`@sentry/react-native/expo`) that wires source-map upload into the EAS build automatically — no manual EAS build hooks needed [CITED: docs.sentry.io/platforms/react-native/manual-setup/expo] |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `eas-cli` | **20.5.1** [VERIFIED: `eas --version` on this machine] | Cloud build + submit | Already installed globally and satisfies both eas.json `cli.version` constraints (`>= 20.0.0` mobile, `>= 20.5.1` root) — no upgrade needed |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `@sentry/react-native` | Bugsnag, Firebase Crashlytics | Both viable; Sentry chosen per D-01 (locked decision, not open for research) — not re-litigated here |
| GitHub Pages + custom domain for privacy policy | Cloudflare Pages, a single Vercel static route | GitHub Pages is free, git-versioned (fits this repo's existing git-first workflow), trivially supports a custom domain via a `CNAME` file — recommended default for Claude's-discretion hosting choice |

**Installation:**
```bash
cd apps/mobile
npx expo install @sentry/react-native
```

**Version verification:** Confirmed via `npm view @sentry/react-native version` → `8.18.0`, `npm view @sentry/react-native time.created` → 2019-07-03 (7-year-old package), `time.modified` → 2026-07-09 (actively maintained, last publish 3 days before this research date).

## Package Legitimacy Audit

| Package | Registry | Age | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|--------------|---------|--------------|
| `@sentry/react-native` | npm | ~7 yrs (first published 2019-07-03) | 2,712,271/wk [VERIFIED: `api.npmjs.org/downloads/point/last-week`] | `github.com/getsentry/sentry-react-native` [VERIFIED: `npm view repository.url`] | OK | Approved |

**Packages removed due to [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

No `postinstall` script present on `@sentry/react-native` (`npm view @sentry/react-native scripts.postinstall` returned empty) — no elevated install-time risk beyond the standard config-plugin native linking already established as a pattern in this project (Phase 4 Skia, Phase 5 HealthKit/Nitro).

## Architecture Patterns

### System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│  apps/mobile (client)                                            │
│                                                                    │
│  crash / unhandled JS error                                       │
│         │                                                          │
│         ▼                                                          │
│  Sentry.init({ sendDefaultPii:false, integrations: pruned })      │
│         │                                                          │
│         ▼                                                          │
│  beforeSend(event) ── ALLOWLIST FILTER ──▶ { errorType, message,   │
│         │                                    stack, device, os,   │
│         │                                    appVersion }         │
│         │  (HR/HSS/bodyweight/distance/duration fields dropped    │
│         │   by omission — never referenced by the filter)         │
│         ▼                                                          │
│  HTTPS ──────────────────────────────▶  Sentry ingest (external)   │
│                                                                    │
│  ─────────────────────────────────────────────────────────────    │
│                                                                    │
│  seedExercises() upsert ──▶ SQLite `exercise` table (bwFactor,     │
│         │                    entryMode columns)                    │
│         ▼                                                          │
│  commitSet.ts reads bwFactor ──▶ computeEffectiveLoad() ──▶ engine │
│                                                                    │
└─────────────────────────────────────────────────────────────────┘
              │                                    │
              ▼                                    ▼
      EAS Build (cloud) ──▶ TestFlight (external beta, ~July 15–22)
              │
              ▼
      EAS Submit ──▶ App Store Connect ──▶ App Review (~July 23–25)
              │
              ▼
      Manual Release (user presses Release, D-15)

  Static, independent of the above build pipeline:
      apsistraining.com/privacy  (GitHub Pages, custom domain, HTTPS)
      apsistraining.com/support  (mandatory ASC "Support URL" field — NOT
                                   in CONTEXT.md's decision list, see Open Questions)
```

### Recommended Project Structure
```
apps/mobile/
├── app.json               # add @sentry/react-native/expo plugin block
├── eas.json                # fill submit.production.ios (ascAppId + auth)
├── lib/
│   └── sentrySanitize.ts   # NEW — pure, exported beforeSend allowlist filter (testable)
├── app/
│   └── _layout.tsx         # Sentry.init() + Sentry.wrap(RootLayout) — before navigation mounts
packages/db/
└── src/seed.ts             # STARTER_EXERCISES 43 → ~150 (D-13), ab-wheel/hanging-leg-raise fix (D-14)
docs-site/ (or a separate lightweight static repo/branch)
└── privacy/index.html      # D-04/D-05 — hosted at apsistraining.com/privacy
└── support/index.html      # mandatory ASC Support URL — new, not in CONTEXT decisions
```

### Pattern 1: Testable Sentry Allowlist (extends D-03)
**What:** Extract the `beforeSend` allowlist logic into a standalone, pure, exported function so it can be vitest-unit-tested exactly like `effectiveLoad.ts`/`healthkitMapping.ts` are — never inline it directly inside `Sentry.init()`.
**When to use:** Any place a Sentry event/breadcrumb could theoretically carry app data.
**Example:**
```typescript
// apps/mobile/lib/sentrySanitize.ts
// Source: pattern extended from D-03 (06-CONTEXT.md) + Sentry beforeSend docs
// https://docs.sentry.io/platforms/react-native/data-management/sensitive-data/
import type { ErrorEvent } from '@sentry/react-native';

/** The ONLY fields ever forwarded to Sentry. Adding a field here is a deliberate,
 *  reviewable decision — never grow this by accident via spread/rest. */
export function sanitizeSentryEvent(event: ErrorEvent): ErrorEvent {
  return {
    ...event,
    // Explicit allowlist reconstruction — do NOT spread `event.extra`, `event.contexts`,
    // or `event.breadcrumbs` verbatim; only copy known-safe subfields.
    exception: event.exception,           // error type/message/stack frames
    contexts: {
      device: event.contexts?.device,     // device/OS model
      app: event.contexts?.app,           // app version
    },
    user: undefined,                       // no user identity ever attached
    extra: undefined,                      // deny by default — nothing custom attached
    breadcrumbs: [],                       // D-02: breadcrumbs pruned to minimum
  };
}
```
```typescript
// apps/mobile/app/_layout.tsx
import * as Sentry from '@sentry/react-native';
import { sanitizeSentryEvent } from '../lib/sentrySanitize';

Sentry.init({
  dsn: process.env.EXPO_PUBLIC_SENTRY_DSN,
  sendDefaultPii: false,          // D-03
  tracesSampleRate: 0,            // D-02: no performance tracing
  attachScreenshot: false,
  attachViewHierarchy: false,
  beforeSend: sanitizeSentryEvent,
  integrations: (defaults) =>
    defaults.filter((i) => i.name !== 'Console'), // don't turn console.* into breadcrumbs
});

export default Sentry.wrap(RootLayout);
```
**Then a vitest test asserts the allowlist directly:**
```typescript
// apps/mobile/lib/__tests__/sentrySanitize.test.ts
import { sanitizeSentryEvent } from '../sentrySanitize';

it('strips a fabricated HR/HSS field from extra even if a future call site attaches it', () => {
  const poisoned = { extra: { heartRate: 172, hss: 88.4 }, exception: {}, contexts: {} } as any;
  const clean = sanitizeSentryEvent(poisoned);
  expect(clean.extra).toBeUndefined();
});
```

### Pattern 2: Expo config plugin registration
**What:** Sentry's Expo integration is a config plugin, not manual native code.
**Example:**
```json
// apps/mobile/app.json — plugins array
["@sentry/react-native/expo", {
  "organization": "<org-slug>",
  "project": "<project-slug>",
  "url": "https://sentry.io/"
}]
```
```javascript
// apps/mobile/metro.config.js
const { getSentryExpoConfig } = require('@sentry/react-native/metro');
module.exports = getSentryExpoConfig(__dirname);
```
Source maps upload automatically during the EAS native build once the plugin + `SENTRY_AUTH_TOKEN` (EAS secret, not committed) are configured [CITED: docs.sentry.io/platforms/react-native/manual-setup/expo].

### Pattern 3: EAS submit profile (fills the empty stub)
```json
// apps/mobile/eas.json
{
  "submit": {
    "production": {
      "ios": {
        "ascAppId": "<App Store Connect app Apple ID>",
        "appleTeamId": "<team id>",
        "ascApiKeyPath": "./AuthKey_XXXX.p8",
        "ascApiKeyIssuerId": "<issuer id>",
        "ascApiKeyId": "<key id>"
      }
    }
  }
}
```
API-key auth (`ascApiKeyPath`/`Issuer`/`KeyId`) is preferred over `appleId` username auth for CI-style non-interactive submits [CITED: docs.expo.dev/submit/eas-json]. The `.p8` key file must NEVER be committed — the repo's `.gitignore` already excludes `*.p8` (verified).

### Anti-Patterns to Avoid
- **Denylist scrubbing:** D-03 is explicit that the audit verifies an allowlist, not a denylist — a denylist only blocks fields you thought to name; a future engineer adding `extra: { profileSnapshot }` to an error report would leak silently. The allowlist in Pattern 1 makes this structurally impossible.
- **Running `eas build`/`eas submit` from the repo root:** the stray root-level `app.json`/`eas.json` (bundle id `com.apsistraining.apsis`) could be picked up by mistake — always `cd apps/mobile` first, or delete the root duplicates (recommended, see Pitfall 2).
- **Committing the icon with an alpha channel:** confirmed present today — App Store Connect will reject it on binary processing, a very late-stage failure mode right before the July 25 deadline if caught then instead of now.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|--------------|-----|
| Crash symbolication / source-map upload | A custom EAS build hook script to upload source maps | `@sentry/react-native/expo` config plugin + `getSentryExpoConfig` in metro.config.js | Handles the hashing/upload automatically during the native build step; hand-rolled scripts are a common source of "stack traces show minified code" bugs |
| Detecting the icon's alpha channel | A visual eyeball check | Read the PNG IHDR byte directly (colorType 6/4 = has alpha) or `sips -g hasAlpha <icon.png>` on macOS, or any PNG metadata tool | Verified in this research session by reading the file directly — the CURRENT icon fails this check; a visual check would have missed it (opaque-looking images can still carry an unused alpha channel) |
| Exercise dataset content | Inventing ~107 new exercise names/categorizations from scratch | Cross-reference `yuhonas/free-exercise-db` (800+ exercises, public-domain JSON, `id`/`name`/`category`/`primaryMuscles`/`equipment` fields) [CITED: github.com/yuhonas/free-exercise-db] for **names and categorization** only — `bwFactor` values must still be manually curated per D-13 (no public dataset carries Apsis's HSS-specific bodyweight-load-ratio semantics) | Reduces naming/taxonomy work; does not replace the biomechanics judgment D-13 explicitly reserves for manual curation |

**Key insight:** Everything hand-rolled in this phase (privacy policy prose, screenshot captions, bwFactor curation) is hand-rolled by explicit user decision (D-05, D-08, D-13/D-14 discretion) — the actual "don't hand-roll" risk is in the mechanical parts (source-map upload, icon validation) where a manual process is error-prone and a tool/script is exact.

## Common Pitfalls

### Pitfall 1: App icon currently has an alpha channel (VERIFIED, not assumed)
**What goes wrong:** `apps/mobile/assets/images/icon.png` was read byte-for-byte in this research session: PNG IHDR reports `colorType: 6` (RGBA — full alpha channel), 1024×1024, 8-bit depth. Apple's App Store icon spec requires a fully opaque PNG with **no alpha channel whatsoever** [CITED: multiple 2026 App Store icon-guideline sources, consistent with Apple's long-standing "Invalid Icon — .png contains an alpha channel" ITMS rejection message].
**Why it happens:** Design tools (Figma, Photoshop export) default to RGBA even for opaque-looking artwork; the alpha channel can be 100% opaque everywhere and still trip Apple's binary check because the channel itself is present, not because any pixel is actually transparent.
**How to avoid:** Flatten the icon onto its final solid background and re-export as RGB (no alpha) — e.g. `convert icon.png -background "#0B0C0E" -alpha remove -alpha off icon-noalpha.png` (ImageMagick) or re-export from the source design file with "no transparency" explicitly set. Re-verify with the same IHDR-byte check before every EAS production build that touches the icon.
**Warning signs:** `eas build` succeeds but `eas submit`/App Store Connect binary processing rejects with an "alpha channel" ITMS error — this happens AFTER the build, wasting a full build cycle right before the deadline if not caught locally first.

### Pitfall 2: Stray root-level app.json/eas.json with a different bundle identifier (VERIFIED)
**What goes wrong:** `C:\Users\ethan\Development\Apsis\app.json` and `\eas.json` exist at the monorepo ROOT (not just `apps/mobile/`), both added in commit `c031d25` alongside the real `apps/mobile/` config. The root `app.json` declares `ios.bundleIdentifier: "com.apsistraining.apsis"` — different from `apps/mobile/app.json`'s `com.apsis.app`, which is the bundle id actually registered with the EAS project and used for the Phase 5 HealthKit entitlement.
**Why it happens:** Almost certainly `eas build:configure` (or similar) was run once from the repo root by mistake in addition to (or instead of) `apps/mobile/`. The root `app.json` is missing required top-level `expo.name`/`expo.slug` fields, so it cannot drive a real build on its own — but its mere presence is a hazard if any command is ever run from the wrong working directory.
**How to avoid:** Either delete the root-level `app.json`/`eas.json` (recommended — they carry no unique config not already in `apps/mobile/`), or clearly document that ALL `eas build`/`eas submit` commands must be run from `apps/mobile/`. Confirm via `eas project:info` (run from `apps/mobile/`) that only one project/bundle-id combination is actually linked before the first production submit.
**Warning signs:** `eas submit` prompts for or resolves a different `ascAppId`/bundle id than expected; App Store Connect shows an app record under an unexpected bundle identifier.

### Pitfall 3: Native module change requires a fresh EAS build (established project pattern, applies again)
**What goes wrong:** Adding `@sentry/react-native` is a native-module change (it ships native iOS/Android code + a config plugin). Per the STATE.md-documented lesson from Phase 4 (Skia) and Phase 5 (HealthKit/Nitro), any existing dev/preview client is now stale and on-device testing (or TestFlight distribution) will fail or silently miss the new module until a fresh EAS build runs.
**Why it happens:** Metro/JS-level hot reload cannot add native code to an already-installed binary.
**How to avoid:** Budget one EAS build cycle immediately after Sentry is installed AND after the pnpm-lockfile is confirmed in sync (EAS installs with `--frozen-lockfile` per the Phase 4 postmortem) — before generating the first TestFlight build for external beta.
**Warning signs:** Crash reporting doesn't fire on a build that predates the Sentry install; app builds successfully but Sentry events never arrive.

### Pitfall 4: TestFlight external beta review timing has no guaranteed SLA
**What goes wrong:** The first build of a new TestFlight external testing group must pass Apple's separate "Beta App Review" queue, which "normally takes a few hours to 48 hours with no guaranteed time" [CITED: developer.apple.com/help + community reports], and 2026 backlog periods have produced longer waits per Apple Developer Forum reports.
**Why it happens:** Beta App Review is a distinct queue from full App Store Review; both can back up independently, especially near common submission-cycle dates.
**How to avoid:** Submit the FIRST external TestFlight build as early as possible inside the July 14–15 target — do not treat "build finishes" and "testers can install" as the same moment; leave slack for the beta-review queue itself, not just the external-tester recruiting window (D-12's fallback already covers recruiting risk, but not review-queue risk).
**Warning signs:** Build shows "Waiting for Beta Review" in App Store Connect for longer than a day with the July 15–22 external window ticking.

### Pitfall 5: Mandatory "Support URL" is not currently in the CONTEXT.md decision set
**What goes wrong:** App Store Connect requires a Support URL (a live page with a real contact method) as a mandatory field for every submission, separate from and in addition to the Privacy Policy URL [CITED: App Store Connect submission-requirements sources]. D-04 only scopes `apsistraining.com/privacy`.
**Why it happens:** Support URL and Privacy Policy URL are easy to conflate since both are "just a link field" in App Store Connect, but Apple validates/requires them independently.
**How to avoid:** Add a minimal `apsistraining.com/support` page (or a mailto: link is commonly accepted, but a real page is safer) to the same static-hosting task as the privacy policy — same hosting mechanism, near-zero incremental cost, should ride the same D-04 infrastructure decision.
**Warning signs:** ASC submission blocked with a "Support URL is required" validation error discovered late in the July 23–25 submission window.

### Pitfall 6: Sentry default breadcrumb integrations can re-capture console output
**What goes wrong:** Sentry's React Native SDK ships default integrations that turn `console.*` calls into breadcrumbs. Phase 5's T-05-01 convention already ensures no raw health values are logged via `console.error`/`console.warn` — but if that convention is ever violated in future code, an unpruned Console breadcrumb integration would forward it straight into Sentry events, defeating the allowlist's intent at the breadcrumb layer (breadcrumbs are attached to events independent of `beforeSend`'s top-level field reconstruction unless breadcrumbs are also explicitly cleared, as shown in Pattern 1).
**Why it happens:** Default integrations are opt-out, not opt-in, in most Sentry SDKs.
**How to avoid:** D-02/D-03 already call for "default breadcrumbs pruned to the minimum" — implement this as BOTH (a) filtering `Console` out of `integrations` at init time, AND (b) `beforeSend` unconditionally resetting `event.breadcrumbs = []` (defense in depth — the audit should verify both, not just one).
**Warning signs:** A Sentry event captured during manual QA shows breadcrumbs containing app console output.

## Code Examples

See Pattern 1–3 above (Sentry allowlist, config plugin, eas.json submit profile) — all cited to official Sentry/Expo docs and this project's existing conventions.

### Exercise catalog expansion (extends existing pattern, D-13/D-14)
```typescript
// packages/db/src/seed.ts — ADD to STARTER_EXERCISES, e.g. fixing D-14's known bug:
{ id: 'ab-wheel', name: 'Ab Wheel', type: 'strength' as const, bodyPart: 'core', bwFactor: 0.30, entryMode: 'reps' as const },
{ id: 'hanging-leg-raise', name: 'Hanging Leg Raise', type: 'strength' as const, bodyPart: 'core', bwFactor: 0.20, entryMode: 'reps' as const },
```
The existing idempotent `onConflictDoUpdate` in `seedExercises()` already syncs `bwFactor`/`entryMode` on every app launch — no migration needed, confirmed by reading `packages/db/src/seed.ts` directly. `bwFactor` values above are illustrative starting points only (LOW confidence / ASSUMED — see Assumptions Log; final values are Claude's-discretion biomechanics judgment per D-14).

**Existing test to extend (not create):** `packages/db/src/__tests__/seed.test.ts` currently asserts `STARTER_EXERCISES.length >= 40` and has a `BODYWEIGHT_FACTORS`/`TIMED_IDS`/`ENDURANCE_IDS` fixture-map pattern already established — the D-13/D-14 plan should raise the count assertion to `>= 150` and add `ab-wheel`/`hanging-leg-raise` (with their new non-null bwFactors) into the `BODYWEIGHT_FACTORS` map, which will naturally start asserting the D-14 fix.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|---------------|--------|
| `sentry-expo` npm package | `@sentry/react-native` with its own `/expo` subpath config plugin | Sentry deprecated the standalone `sentry-expo` wrapper package in favor of first-party Expo support built directly into `@sentry/react-native` | Do not install `sentry-expo` — it is the deprecated path; `@sentry/react-native` is the only current recommendation [CITED: docs.sentry.io/platforms/react-native/manual-setup/expo] |
| Per-device-size screenshot sets | Single largest-display-per-family upload (6.9" iPhone), auto-scaled down by App Store Connect | Ongoing Apple policy simplification | Matches D-09 exactly (6.9" set only, no iPad) — confirms the locked decision is current, not stale |

**Deprecated/outdated:** `sentry-expo` (superseded by `@sentry/react-native`'s built-in Expo support).

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|----------------|
| A1 | GitHub Pages + custom domain is the best hosting mechanic for apsistraining.com/privacy (a Claude's-discretion item) | Standard Stack / Alternatives | Low — purely a convenience choice explicitly left to Claude's discretion; any static host works |
| A2 | Illustrative `bwFactor` values shown for `ab-wheel` (0.30)/`hanging-leg-raise` (0.20) in Code Examples | Code Examples | Medium — these are placeholder-quality estimates, not literature-verified; D-14 explicitly requires manual biomechanics curation before shipping real values |
| A3 | `yuhonas/free-exercise-db` is a suitable source for the ~107 new exercise NAMES/categorization | Don't Hand-Roll | Low-Medium — dataset is public domain and long-established, but its bwFactor/HSS-relevant fields don't exist; if the naming taxonomy doesn't match Apsis's `bodyPart`/`type` enums well, extra normalization work is needed |
| A4 | TestFlight external Beta App Review will complete within the 24–48h range and not spill past July 15 in a way that eats the beta window | Common Pitfalls (Pitfall 4) | Medium-High — directly threatens the July 15–22 external beta timeline; the CONTEXT.md fallback (shrink to internal self-test) already covers this risk, so impact is bounded but real |
| A5 | Apple Developer Program enrollment / paid account is already active and an App Store Connect app record can be created without additional lead time | Open Questions | High if wrong — an unenrolled or newly-enrolling developer account can itself take days to process, which would consume the July timeline before any build/submit step even starts |

## Open Questions

1. **Is a Support URL page already planned, or does it need to be added to the D-04 hosting task?**
   - What we know: App Store Connect requires it as a mandatory, separate field from the privacy policy URL.
   - What's unclear: CONTEXT.md's D-04 only scopes `/privacy`; no mention of `/support`.
   - Recommendation: Bundle a minimal `/support` static page into the same hosting task as `/privacy` (near-zero incremental cost, same infrastructure).

2. **Is the Apple Developer Program account already enrolled and in good standing?**
   - What we know: Nothing in the repo confirms this (no `credentials.json`/ASC API key present, which is expected — those are gitignored).
   - What's unclear: Whether App Store Connect app-record creation, TestFlight, and submission can proceed immediately or whether account enrollment/renewal itself is a pending step.
   - Recommendation: Verify this as the very first task of the phase (before any build work) since it is a hard blocker with unpredictable Apple-side processing time, unlike anything else in this phase.

3. **Auth method for `eas submit`: App Store Connect API Key vs. Apple ID?**
   - What we know: Expo supports both; API-key auth (`ascApiKeyPath`/`Issuer`/`KeyId`) is preferred for repeatable/non-interactive submits and avoids 2FA prompts mid-flow.
   - What's unclear: Whether the user already has an ASC API key generated, or wants to authenticate interactively with their Apple ID each time (fewer secrets to manage, but requires being present at submit time).
   - Recommendation: Default to interactive Apple ID auth for THIS single manual-release submission (D-15 is already manual/interactive) unless the user wants the API key for repeat convenience — lower setup overhead for a one-shot v1.0 submission.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|-------------|-----------|---------|----------|
| `eas-cli` | REL-04 build/submit | ✓ | 20.5.1 [VERIFIED: `eas --version`] | — |
| Node.js | Build tooling | ✓ | v20.16.0 [VERIFIED] | — |
| pnpm | Monorepo installs | ✓ | 9.15.9 [VERIFIED] | — |
| Apple Developer Program enrollment | ASC app record, TestFlight, submission | ✗ (unverifiable from repo) | — | None — hard blocker, see Open Question 2 |
| DNS/domain control for apsistraining.com | D-04 privacy/support page hosting | ✗ (unverifiable from repo — user states they own the domain) | — | None needed; user-confirmed ownership per CONTEXT.md |
| macOS/Xcode (local icon/build tooling) | Local PNG alpha-channel verification, local iOS builds | ✗ (Windows host) | — | Verify icon alpha via direct PNG byte inspection (done in this research) or ImageMagick on Windows/WSL instead of `sips`; all real builds go through EAS cloud regardless (established project pattern) |

**Missing dependencies with no fallback:**
- Apple Developer Program enrollment status is unverifiable from the repo and has no code-side fallback — must be confirmed as a Phase 6 Wave 0 task.

**Missing dependencies with fallback:**
- Local macOS/Xcode tooling — not needed; EAS cloud build is this project's established (and only viable, per PROJECT.md) build path on a Windows host.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest 4.1.9 (already project-wide) |
| Config file | `packages/db/vitest.config.mts` (catalog work), `apps/mobile/vitest.config.mts` (Sentry sanitizer work) |
| Quick run command | `pnpm --filter @apsis/db test` / `pnpm --filter @apsis/mobile test` |
| Full suite command | `pnpm -r test` (all workspace packages) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|--------------------|--------------|
| REL-03 | `beforeSend` allowlist strips any non-listed field (HR/HSS/bodyweight/distance/duration) | unit | `pnpm --filter @apsis/mobile test -- sentrySanitize` | ❌ Wave 0 (new file) |
| REL-03 | Breadcrumbs are always emptied regardless of input | unit | same file as above | ❌ Wave 0 |
| D-13/D-14 (folded into REL-01 delivery gate) | `STARTER_EXERCISES` has ≥150 entries, no duplicate ids, `ab-wheel`/`hanging-leg-raise` have non-null bwFactor | unit | `pnpm --filter @apsis/db test -- seed` | ✅ exists (`packages/db/src/__tests__/seed.test.ts`), needs threshold + fixture updates, not a new file |
| REL-01 | Icon has no alpha channel | manual/script | one-off Node/ImageMagick check (see Pitfall 1) — not part of the CI vitest suite | ❌ Wave 0 (one-off verification script, not a persisted test) |
| REL-02 | Privacy policy live at HTTPS URL | manual | `curl -I https://apsistraining.com/privacy` returns 200 | N/A — manual/deploy-time check, not a unit test |
| REL-04 | EAS build succeeds, TestFlight install works, submission accepted | manual/e2e | On-device TestFlight install + Apple's own review process | N/A — inherently manual, outside vitest's scope |

### Sampling Rate
- **Per task commit:** `pnpm --filter @apsis/db test` after any seed.ts change; `pnpm --filter @apsis/mobile test` after any sentrySanitize.ts change.
- **Per wave merge:** `pnpm -r test` (full workspace).
- **Phase gate:** Full suite green before `/gsd-verify-work`; REL-01/02/04 verified via the manual checklist items above (not automatable, must be explicitly walked through, not silently skipped).

### Wave 0 Gaps
- [ ] `apps/mobile/lib/sentrySanitize.ts` + `apps/mobile/lib/__tests__/sentrySanitize.test.ts` — new files, cover REQ REL-03
- [ ] Extend `packages/db/src/__tests__/seed.test.ts` — raise `>= 40` to `>= 150`, add ab-wheel/hanging-leg-raise to `BODYWEIGHT_FACTORS` — covers REL-01's D-13/D-14 folded item
- [ ] A one-off (non-persisted-test) icon alpha-channel verification step — not a vitest file; document as a manual/scripted plan-task check instead

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|----------------|---------|--------------------|
| V2 Authentication | No | App has no login/account system (offline single-user) |
| V3 Session Management | No | No sessions |
| V4 Access Control | No | No multi-user access boundaries |
| V5 Input Validation | No (no new user-input surfaces this phase) | Existing clamp-and-warn conventions (Phase 2/5) unaffected |
| V6 Cryptography | Marginal | Sentry transport uses standard HTTPS/TLS (OS-provided) only — no custom crypto; `ITSAppUsesNonExemptEncryption: false` correctly reflects "standard OS encryption only" per D-18 |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|-----------------------|
| Health-derived data exfiltration via third-party crash SDK | Information Disclosure | Allowlist `beforeSend` (Pattern 1) + `sendDefaultPii: false` + breadcrumbs pruned/cleared (D-02/D-03); extends Phase 5's T-05-01 no-raw-values-in-logs convention up to the SDK-event layer |
| Malicious/typosquatted npm package (native module) | Tampering | Package Legitimacy Audit performed above — `@sentry/react-native` verdict OK; same discipline used for Phase 5's HealthKit/Nitro install (T-05-SC precedent) |
| Submission-time credential leak (ASC API key `.p8`, Apple ID password) | Information Disclosure | `.gitignore` already excludes `*.p8`/`*.p12`/`*.mobileprovision`/`credentials.json` (confirmed by reading `.gitignore`) — no new gitignore entries needed |
| Incorrect privacy nutrition label (over- or under-declaring) leading to App Review rejection or post-launch compliance risk | Repudiation / compliance | D-06's on-device-only posture is confirmed correct per Apple's official "collect" definition (see Summary) — the plan should still have the user do a final self-certification pass in App Store Connect, since Apple's label is developer-self-reported and Apple can audit after the fact |

## Sources

### Primary (HIGH confidence)
- `npm view @sentry/react-native version/time.created/time.modified/repository.url/scripts.postinstall` — package legitimacy + version, this session
- `api.npmjs.org/downloads/point/last-week/@sentry/react-native` — weekly download count, this session
- Direct PNG IHDR byte read of `apps/mobile/assets/images/icon.png` — alpha-channel defect, this session
- `eas --version` on this machine — 20.5.1, this session
- Direct read of `apps/mobile/{app.json,eas.json,package.json}` and root `{app.json,eas.json,package.json}` + `git log` on both — bundle-id conflict finding, this session
- Direct read of `packages/db/src/seed.ts` and `packages/db/src/__tests__/seed.test.ts` — current catalog state (43 entries) and existing test conventions, this session
- [Apple: App Privacy Details](https://developer.apple.com/app-store/app-privacy-details/) — "collect" definition, on-device-only exemption
- [Apple App Review Guidelines 5.1.3 (Health)](https://developer.apple.com/app-store/review/guidelines/) — health-data-use restrictions, privacy policy requirement

### Secondary (MEDIUM confidence)
- [Sentry: Expo setup guide](https://docs.sentry.io/platforms/react-native/manual-setup/expo/) — install/init/config-plugin steps
- [Sentry: Scrubbing Sensitive Data](https://docs.sentry.io/platforms/react-native/data-management/sensitive-data/) — beforeSend/beforeBreadcrumb pattern
- [Expo: Configure EAS Submit with eas.json](https://docs.expo.dev/submit/eas-json/) — submit profile schema
- [Expo: eas.json reference](https://docs.expo.dev/eas/json/) — autoIncrement, full iOS submit fields
- [Apple: TestFlight overview](https://developer.apple.com/help/app-store-connect/test-a-beta-version/testflight-overview/) — external beta review flow
- [free-exercise-db](https://github.com/yuhonas/free-exercise-db) — public-domain exercise naming/categorization dataset

### Tertiary (LOW confidence — WebSearch-aggregated, not a single authoritative source)
- 2026 App Store icon-size/no-alpha-channel guideline round-ups (screenshotwhale.com, iconikai.com, etc.) — consistent with Apple's known long-standing rule, cross-checked against the actual verified PNG defect found in this repo
- 2026 App Store screenshot dimension round-ups (screenhance.com, mobileaction.co, etc.) — 6.9" class = 1320×2868 / 1290×2796 / 1260×2736 px; not fetched directly from Apple's own screenshot-specifications help page in this session, should be spot-checked against `developer.apple.com/help/app-store-connect/reference/app-information/screenshot-specifications/` before final asset export
- TestFlight review-time estimates (community forum aggregation) — no official Apple SLA exists; treat as a risk, not a guarantee

## Metadata

**Confidence breakdown:**
- Standard stack (Sentry version/legitimacy): HIGH — directly verified via npm registry tooling and official Sentry docs
- Icon/bundle-id defects: HIGH — verified by directly reading repo files/bytes in this session, not inferred
- Apple privacy-label interpretation (D-06 confirmation): HIGH — Apple's own developer documentation states the "collect" definition explicitly
- Exact screenshot pixel dimensions: MEDIUM — cross-checked across multiple secondary sources but not fetched directly from Apple's own current help page; verify once before final export
- bwFactor curation for new catalog entries: LOW/ASSUMED by design — explicitly reserved for manual judgment per D-13/D-14, not a research gap
- TestFlight review timing: LOW — no official Apple SLA exists; treated as a schedule risk in Assumptions Log (A4), not a fact

**Research date:** 2026-07-12
**Valid until:** ~2026-08-11 (30 days) for Sentry/EAS mechanics; Apple's exact screenshot pixel dimensions and icon-processing rules should be re-spot-checked against Apple's live help pages immediately before final asset export, since Apple revises these with each new device generation
