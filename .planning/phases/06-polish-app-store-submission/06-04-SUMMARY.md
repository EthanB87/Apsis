---
phase: 06-polish-app-store-submission
plan: 04
subsystem: infra
tags: [privacy-policy, support-page, static-hosting, app-store-connect, docs-site]

# Dependency graph
requires:
  - phase: 06-polish-app-store-submission (06-02, 06-08)
    provides: Sentry allowlist posture (D-03) and the 06-08 corrective copy (share-card/photo-library
      disclosure, nutrition/food-lookup disclosure) that this plan's published pages had to match
provides:
  - Live HTTPS privacy policy at https://apsistraining.com/privacy (REL-02)
  - Live HTTPS support page at https://apsistraining.com/support with a monitored contact address
  - The two URLs required for App Store Connect's Privacy Policy URL + Support URL fields
affects: [06-07 (App Store Connect submission entry)]

# Actuals (#2632)
actuals:
  tokens: 1943
  tasks: 3
  commits: 2

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "docs-site/ is the approved source of record for legal/support copy; the live site is served
      from a separate landing-page repo (Vercel), not GitHub Pages, so docs-site/CNAME is vestigial
      and any future edits must be mirrored into the landing repo's public/ copy"

key-files:
  created:
    - docs-site/privacy/index.html
    - docs-site/support/index.html
    - docs-site/CNAME
  modified: []

key-decisions:
  - "Privacy copy review (D-05) was satisfied via the 06-08 Task 3 human checkpoint (\"copy approved\",
    2026-08-03), which was the hard gate for publishing — publish happened AFTER 06-08 landed the
    share-card/photo-library and nutrition/food-lookup disclosure corrections, not before."
  - "Deployment mechanism ended up being Vercel serving the apex domain from the Apsis-Landing-Page
    repo, not GitHub Pages — the approved docs-site/ HTML was copied byte-for-byte into that repo's
    public/privacy and public/support directories with next.config.mjs rewrites for the clean URLs.
    docs-site/ in this repo remains the source of record."

patterns-established: []

requirements-completed: [REL-02]

coverage:
  - id: D1
    description: "Privacy policy live at https://apsistraining.com/privacy over HTTPS, serving the
      06-08-corrected copy (share-card/photo-library and nutrition disclosures included)"
    requirement: "REL-02"
    verification:
      - kind: manual_procedural
        ref: "orchestrator curl verification 2026-08-04: HTTP 200, HTTPS, title/last-updated-date and
          disclosure sections confirmed matching the approved 06-08 copy"
        status: pass
    human_judgment: false
  - id: D2
    description: "Support page live at https://apsistraining.com/support over HTTPS with a monitored
      mailto: contact"
    verification:
      - kind: manual_procedural
        ref: "orchestrator curl verification 2026-08-04: HTTP 200, HTTPS, mailto:support@apsistraining.com present"
        status: pass
    human_judgment: false

# Metrics
duration: N/A (spans 06-04 initial execution + 06-08 gate + user deploy, resumed as continuation)
completed: 2026-08-04
status: complete
---

# Phase 06 Plan 04: Privacy Policy + Support Page Summary

**Privacy policy and support page live over HTTPS on apsistraining.com, publishing the 06-08-corrected
copy only after the human re-approval gate — both URLs ready for App Store Connect entry in 06-07.**

## Performance

- **Duration:** N/A — this plan paused at a blocking human-verify checkpoint (Task 3: review + deploy)
  pending the 06-08 copy-correction gate and the user's own DNS/hosting deploy; closed out as a
  continuation once the user confirmed deployment on 2026-08-04.
- **Started:** 2026-08-03 (Tasks 1-2)
- **Completed:** 2026-08-04 (Task 3 resolved, plan closed)
- **Tasks:** 3 (2 executed as `auto`, 1 blocking human-verify checkpoint resolved via user deploy + orchestrator verification)
- **Files modified:** 3 (docs-site/privacy/index.html, docs-site/support/index.html, docs-site/CNAME)

## Accomplishments

- Drafted a brand-continuous (void/bone/volt, plain semantic HTML, no JS/forms) privacy policy at
  `docs-site/privacy/index.html` stating Apsis's real data posture: fully offline-first, HealthKit
  data never leaves the device, only anonymous Sentry crash diagnostics leave the device.
- Drafted a matching support page at `docs-site/support/index.html` with a monitored
  `mailto:support@apsistraining.com` contact, plus `docs-site/CNAME` for the custom domain.
- Held the publish gate until 06-08's corrective copy pass (share-card/photo-library disclosure,
  nutrition/food-lookup disclosure) was human re-approved on 2026-08-03 ("copy approved", no edits),
  satisfying D-05 before anything went live.
- User deployed the approved `docs-site/` copy; orchestrator independently verified both URLs live:
  - `https://apsistraining.com/privacy` → HTTP 200 over HTTPS, serving the 06-08-CORRECTED copy
    ("Last updated August 3, 2026"; share-card/share-sheet section present; Open Food Facts / USDA
    nutrition disclosure intact).
  - `https://apsistraining.com/support` → HTTP 200 over HTTPS, exposing
    `mailto:support@apsistraining.com` (the user's monitored inbox).
- Hosting mechanism turned out to be Vercel serving the apex domain from the separate
  `Apsis-Landing-Page` repo (not GitHub Pages as `docs-site/CNAME` implies) — the approved HTML was
  copied byte-for-byte into that repo's `public/privacy` and `public/support`, with
  `next.config.mjs` rewrites producing the clean `/privacy` and `/support` URLs. `docs-site/` in
  this repo remains the source of record for any future copy edits, which must be mirrored into the
  landing repo.
- Both live URLs are now ready to enter into App Store Connect's Privacy Policy URL and Support URL
  fields in plan 06-07.

## Task Commits

Each task was committed atomically:

1. **Task 1: Draft the privacy policy page (D-05)** - `9b993e0` (feat)
2. **Task 2: Draft the support page + CNAME (Pitfall 5)** - `4080c6d` (feat)
3. **Task 3: Review + deploy** - blocking human-verify checkpoint; no code commit (the deploy itself
   happened outside this repo, in the landing-page repo). Resolved via user action + orchestrator
   verification on 2026-08-04.

**Plan metadata:** this commit (docs: complete plan)

## Files Created/Modified

- `docs-site/privacy/index.html` - Privacy policy page: offline-first posture, HealthKit on-device
  only, Sentry crash diagnostics disclosure, later corrected by 06-08 for share-card/photo-library
  and nutrition/food-lookup disclosures.
- `docs-site/support/index.html` - Support page with monitored `mailto:support@apsistraining.com`.
- `docs-site/CNAME` - Custom-domain marker for GitHub Pages; superseded in practice by Vercel serving
  the apex from the landing repo, but retained as the source-of-record HTML location.

## Decisions Made

- Privacy copy review (D-05) was satisfied via the 06-08 Task 3 human checkpoint ("copy approved",
  2026-08-03) — that approval was the hard gate for this plan's publish step, and publish happened
  strictly AFTER 06-08 completion, not before. The gate was honored, not bypassed.
- Deployment target ended up being the `Apsis-Landing-Page` repo on Vercel rather than GitHub Pages;
  `docs-site/` here stays the canonical source and must be kept in sync with that repo's `public/`
  copy on any future edits (recorded in STATE.md Accumulated Context).

## Deviations from Plan

None - plan executed exactly as written. The hosting mechanism (Vercel/landing-repo instead of
GitHub Pages) was left to the user's discretion per the plan's own `user_setup` note ("Claude's
discretion on mechanics") and is documented above, not a deviation from any specified requirement.

## Issues Encountered

None. The plan's blocking human-verify checkpoint (Task 3) intentionally paused for two external
dependencies — the 06-08 copy-correction gate and the user's own DNS/hosting deploy — both of which
resolved as expected.

## User Setup Required

None further. The one external service this plan required (static hosting for apsistraining.com)
is now configured and live; no additional user action remains.

## Next Phase Readiness

- REL-02 satisfied: live HTTPS privacy policy at apsistraining.com/privacy.
- Both `https://apsistraining.com/privacy` and `https://apsistraining.com/support` are ready to be
  entered into App Store Connect (Privacy Policy URL + mandatory Support URL) in plan 06-07.
- No blockers. Phase 06 Wave 1 is now fully complete (06-01, 06-02, 06-03, 06-04, 06-05, 06-08); only
  06-06 (paused at Task 3, build 9 in Beta App Review — "Waiting for Review") and 06-07 remain in the
  phase.

---
*Phase: 06-polish-app-store-submission*
*Completed: 2026-08-04*
