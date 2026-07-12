---
phase: 05
slug: healthkit-integration
status: verified
# threats_open = count of OPEN threats at or above workflow.security_block_on severity (the blocking gate)
threats_open: 0
asvs_level: 1
created: 2026-07-12
---

# Phase 05 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| npm registry → local build | Third-party package code enters the trusted native build | Native module source (Nitro, HealthKit bridge) |
| iOS HealthKit sheet → app | System-mediated permission boundary | Authorization grants |
| HealthKit samples → SQLite/engine | External (possibly third-party-written) numeric values are persisted and scored | Workout distance/duration, HR, bodyweight |
| app → HealthKit write / delete | Apsis writes workout samples + metadata; deletes only self-authored samples | Distance, duration, ApsisHSS metadata |
| DB read → UI | Provenance/status rendering | source column, sync timestamps, counts |

---

## Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation | Status |
|-----------|----------|-----------|----------|-------------|------------|--------|
| T-05-SC | Tampering | npm install of react-native-nitro-modules [SUS] + @kingstinct/react-native-healthkit | high | mitigate | Blocking-human legitimacy checkpoint executed before install (05-01 Task 1, user-approved 2026-07-11); versions pinned in package.json | closed |
| T-05-01 | Information Disclosure | HK logging (import/write-back/auth/sync warnings) | medium | mitigate | All HK log sites emit Error objects/booleans/counts/labels only; sanitize warning strings redact raw sample values (fix `1141ff7`, healthkitMapping.ts) — feeds Phase 06 REL-03 Sentry audit | closed |
| T-05-02 | Tampering | sanitizeHKNumeric / imported numerics | medium | mitigate | Clamp-and-warn on every HK numeric at all import call sites (healthkitImport.ts); null/NaN/non-finite discarded, out-of-bounds clamped, never throws | closed |
| T-05-03 | Elevation of Privilege | HealthKit authorization scope | low | mitigate | Shared minimal HK_READ_TYPES (workouts/HR/bodyweight) + HK_WRITE_TYPES (workout only, no bodyMass write per D-18) reused by onboarding and Settings | closed |
| T-05-04 | Tampering | Echo/resurrection of own write-backs | low | mitigate | sources NOT-filter on anchored query + tombstone-inclusive candidatesForDedupe (soft-deleted rows still block re-import, Pitfall 8/9) | closed |
| T-05-05 | Tampering | DB queries/inserts | low | mitigate | Parameterized drizzle builders throughout; `sql` fragments interpolate column refs only, never values (T-1-01 convention) | closed |
| T-05-06 | Information Disclosure | Provenance chip | low | accept | See Accepted Risks Log (AR-05-01) | closed |
| T-05-07 | Tampering | Delete-sync ownership | medium | mitigate | Health-sample delete fires only for `source === 'manual' && healthkitUuid != null` rows Apsis authored (finishWorkout.ts:94, D-14) | closed |
| T-05-08 | Information Disclosure | Write-back payload | low | accept | See Accepted Risks Log (AR-05-02) | closed |
| T-05-09 | Denial of Service | Background import during onboarding | low | mitigate | 90-day initial import is fire-and-forget with .catch (onboarding/healthkit.tsx:49, D-22); onboarding completes immediately | closed |

*Status: open · closed · open — below high threshold (non-blocking)*
*Severity: critical > high > medium > low — only open threats at or above workflow.security_block_on count toward threats_open*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-05-01 | T-05-06 | Displaying a session's own provenance (APPLE HEALTH chip) to the single local user is intended behavior; offline single-user app has no cross-user exposure | plan 05-04 threat model (user-approved plans) | 2026-07-12 |
| AR-05-02 | T-05-08 | Writing distance/duration + ApsisHSS metadata to the user's own Health store is the intended HK-04 behavior; no calories fabricated (D-13) | plan 05-06 threat model (user-approved plans) | 2026-07-12 |

*Accepted risks do not resurface in future audit runs.*

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-07-12 | 10 | 10 | 0 | /gsd-secure-phase (orchestrator L1 grep verification; T-05-01 gap found and fixed in `1141ff7`) |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-07-12
