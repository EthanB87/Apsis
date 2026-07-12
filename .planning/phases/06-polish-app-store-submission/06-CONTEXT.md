# Phase 6: Polish & App Store Submission - Context

**Gathered:** 2026-07-12
**Status:** Ready for planning

<domain>
## Phase Boundary

A privacy-compliant, submittable build reaches App Store review with a buffer before the
July 28 deadline (REL-01..REL-04). Store assets (icon/screenshots/metadata), privacy
policy + nutrition label, crash-reporting integration and audit, external TestFlight
beta, and the EAS build + submission itself. One folded polish item: exercise catalog
expansion + bwFactor fixes (see D-13/D-14). No other new app features or screens.

**Timeline anchor (from discussion, today = July 12):** beta build to TestFlight ~July 14–15,
external beta July 15–22 (hard stop), submit for review July 23–25, manual release.

</domain>

<decisions>
## Implementation Decisions

### Crash reporting (REL-03)
- **D-01 (Sentry now):** Install `@sentry/react-native` in Phase 6 — v1.0 ships with
  crash reporting, not vacuous REL-03 compliance.
- **D-02 (Scope):** Native crashes + unhandled JS errors ONLY. No performance tracing,
  no session replay, default breadcrumbs pruned to the minimum.
- **D-03 (Allowlist scrubbing):** `beforeSend` strips everything except known-safe
  fields (error type/message, stack frames, device/OS model, app version). Health-derived
  values (HR, HSS, bodyweight, distance, durations) cannot leak by omission — new code
  can't accidentally attach them. The REL-03 audit verifies the allowlist, not a denylist.
  `sendDefaultPii: false`. Pairs with the Phase 5 T-05-01 logging convention (no raw
  health values in console logs — those become breadcrumbs if breadcrumbs are ever enabled).

### Privacy policy & nutrition label (REL-02)
- **D-04 (Hosting):** Privacy policy lives at **apsistraining.com/privacy** — user already
  owns the domain. Static hosting mechanics (GitHub Pages with custom domain, Cloudflare
  Pages, etc.) are Claude's discretion.
- **D-05 (Authorship):** Claude drafts the policy as a plan task, tailored to Apsis's
  actual posture: offline-first, HealthKit read/write stays on-device, the ONLY off-device
  data is Sentry crash diagnostics. User reviews before it goes live.
- **D-06 (Label posture):** Privacy nutrition label declares only what actually leaves the
  device — expected: Diagnostics → Crash Data (not linked to identity, no tracking).
  Health & Fitness is NOT declared as "collected" because HealthKit data never leaves the
  device. **Researcher must verify** this against current Apple guidance (App Privacy
  Details + HealthKit sections of App Review Guidelines) — accuracy is the requirement,
  not minimalism.

### Store listing & screenshots (REL-01)
- **D-07 (Name):** App Store name carries brand + search terms — direction:
  "Apsis: Hybrid Training Log" (≤30 chars). Subtitle sells the wedge, e.g.
  "One score for lifting + running". Final strings drafted in a plan task, user approves.
- **D-08 (Copy voice):** Athlete-direct — terse, second-person, mono-caption energy
  matching in-app copy ("You lift. You run. One number tells you what it cost.").
  Written for HYROX/tactical athletes, not casual browsers.
- **D-09 (Screenshots):** Device-framed captures on brand-dark (void) backgrounds with
  short mono captions. Featured screens, in order: TODAY hero (volt HSS ring + readiness
  light), lift logger ledger, run form + History, Apple Health integration (connect step
  or Settings + APPLE HEALTH chip). 6.9" iPhone set only — App Store Connect scales down;
  no iPad target.
- **D-10 (Pricing):** Free, no IAP. Monetization is a v1.1+ decision.
- **D-11 (Category):** Health & Fitness (primary).

### Submission logistics (REL-04)
- **D-12 (Beta):** External TestFlight beta BEFORE review submission. Public link shared
  to a small group (hybrid-athlete friends / HYROX communities). Window: ~July 15–22,
  hard stop. Gate: crashes/data-loss/HealthKit failures block submission; small UX friction
  fixes (copy, confusing flows) are also taken if quick. Feature requests bank for v1.1.
  Fallback: if recruiting stalls by ~July 15, shrink to internal TestFlight self-test
  without slipping the submission date.
- **D-15 (Release style):** Manual release after approval — user presses Release.
  No phased release.
- **D-16 (Review notes):** Full walkthrough note for App Review: no account/login needed
  (fully offline), HealthKit is optional and skippable in onboarding, where to re-connect
  in Settings, all health data stays on-device except Sentry crash diagnostics.
- **D-17 (Versioning):** Marketing version stays 1.0.0; EAS auto-increments buildNumber
  (`autoIncrement` in eas.json production profile). Beta and review builds differ only by
  build number.
- **D-18 (Export compliance):** `ITSAppUsesNonExemptEncryption: false` in app.json —
  standard OS encryption only (HTTPS to Sentry, iOS data protection); skips the
  per-upload questionnaire.

### Folded polish: exercise catalog (user-raised, folded into Phase 6)
- **D-13 (Catalog expansion):** Expand `STARTER_EXERCISES` in `packages/db/src/seed.ts`
  from 43 to ~150 curated movements — major barbell/DB/KB lifts and common variations,
  machines, cable work, core. Data-only change: the seeder is an idempotent per-id upsert,
  so existing installs backfill on update. Each entry needs curated `bodyPart`, `bwFactor`,
  and `entryMode` so HSS stays honest (open datasets like free-exercise-db may inform
  names, but bwFactor curation is manual). Must land before the July 15 beta build.
- **D-14 (bwFactor fixes):** Fix seeded inconsistency: `ab-wheel` and `hanging-leg-raise`
  have `bwFactor: null` and score ~0 HSS at 0 entered weight. Assign honest bwFactors
  (push-up-style semantics: weight field = added external load only). Any other
  bodyweight-moved entries added in D-13 follow the same rule.

### Claude's Discretion
- Static hosting mechanics for apsistraining.com/privacy (DNS/host choice).
- Sentry project setup details (DSN handling, environment split dev/prod, release tagging).
- Exact keyword field contents (within D-07/D-08 voice).
- Screenshot production tooling (simulator captures + framing pipeline).
- bwFactor values for new catalog entries (literature/biomechanics-informed estimates).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Release requirements & constraints
- `.planning/ROADMAP.md` — Phase 06 goal + success criteria (REL-01..04, July 25 target)
- `.planning/REQUIREMENTS.md` — REL-01..REL-04 definitions
- `.planning/PROJECT.md` — offline-only constraint, timeline, key decisions

### Privacy / security posture feeding REL-02/REL-03
- `.planning/phases/05-healthkit-integration/05-SECURITY.md` — T-05-01 logging convention
  (no raw health values in logs), threat register the Sentry audit extends
- `apps/mobile/lib/healthkitAuth.ts` — exact HealthKit read/write scopes the privacy
  policy and label must describe

### Build/submission surfaces
- `apps/mobile/app.json` — icon path, version, bundle id (com.apsis.app), plugins
- `apps/mobile/eas.json` — build profiles; production submit profile is currently empty
- `packages/db/src/seed.ts` — STARTER_EXERCISES catalog (D-13/D-14 target)
- `apps/mobile/lib/commitSet.ts` + `packages/engine/src/bodyweight.ts` — bwFactor
  effective-load semantics new catalog entries must respect

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- 1024×1024 icon already exists (`apps/mobile/assets/images/icon.png`, plate-mark
  branding, updated July 9) — verify no alpha channel (REL-01 requires none) rather
  than recreate.
- `eas.json` production build profile exists; submit profile is an empty stub to fill.
- Splash/adaptive icons present in `assets/images/`.

### Established Patterns
- Sentry is NOT currently installed — greenfield integration, no legacy telemetry to audit.
- Phase 5 T-05-01 convention: log Error objects/booleans/counts only, never raw health
  values — the Sentry allowlist extends this to the event/breadcrumb layer.
- Seeder pattern: idempotent per-id upsert syncing engine-critical columns
  (`bwFactor`, `entryMode`) — catalog expansion rides this with zero migration.
- iOS builds are EAS-cloud-only (Windows host) — all build/submit tasks go through
  `eas build` / `eas submit`, never local Xcode.

### Integration Points
- Sentry init belongs in `apps/mobile/app/_layout.tsx` (root layout) before navigation mounts.
- New native module (@sentry/react-native) ⇒ requires a fresh EAS build before any
  TestFlight distribution (same lesson as Phase 5's Nitro install).
- Exercise catalog expansion touches only `packages/db/src/seed.ts` (+ its test).

</code_context>

<specifics>
## Specific Ideas

- Screenshot caption energy: mono uppercase, e.g. "ONE NUMBER FOR ALL TRAINING STRESS" —
  same voice as in-app ledger captions.
- Description opening in the athlete-direct register: "You lift. You run. One number
  tells you what it cost."
- Beta recruiting: hybrid-athlete friends + HYROX community channels via public
  TestFlight link.

</specifics>

<deferred>
## Deferred Ideas

- **Custom exercise creation (v1.1)** — user-created exercises with their own
  bwFactor/entry mode; the D-13 catalog expansion reduces the day-one need, but the
  escape hatch belongs in v1.1 alongside whatever monetization decides.
- **Sentry beyond crashes (v1.1)** — performance tracing, breadcrumbs, session replay
  only after the allowlist audit pattern is proven in production.
- **Monetization model (v1.1+)** — v1.0 ships free with no IAP scaffolding.

</deferred>

---

*Phase: 06-polish-app-store-submission*
*Context gathered: 2026-07-12*
