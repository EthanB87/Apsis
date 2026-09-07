# Phase 6: Polish & App Store Submission - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-12
**Phase:** 06-polish-app-store-submission
**Areas discussed:** Crash reporting (REL-03), Privacy policy & label, Store listing & screenshots, Submission logistics, Exercise catalog (user-raised)

---

## Crash reporting (REL-03)

| Option | Description | Selected |
|--------|-------------|----------|
| No SDK for v1.0 (Recommended) | Apple built-in crash reports only; REL-03 vacuous; Sentry in v1.1 | |
| Add Sentry now | Install @sentry/react-native + scrubbing layer, audit, declare on label | ✓ |
| Sentry, crashes only | Sentry with only native crash capture | |

**User's choice:** Add Sentry now — user went beyond the deadline-conservative recommendation.

| Option | Description | Selected |
|--------|-------------|----------|
| Crashes + JS errors (Recommended) | No tracing/replay, pruned breadcrumbs | ✓ |
| Crashes only | Misses RN-layer bugs | |
| Full telemetry | Max insight, max audit surface | |

| Option | Description | Selected |
|--------|-------------|----------|
| Allowlist (Recommended) | beforeSend keeps only known-safe fields | ✓ |
| Denylist + PII off | Deletes known-sensitive keys | |

---

## Privacy policy & label

| Option | Description | Selected |
|--------|-------------|----------|
| GitHub Pages (Recommended) | Free static page | |
| Own domain | apsistraining.com — user owns it | ✓ |
| Notion/hosted page | Fastest, least professional | |

**User's choice:** apsistraining.com/privacy (domain already owned).

| Option | Description | Selected |
|--------|-------------|----------|
| Claude drafts it (Recommended) | Tailored to offline/on-device posture, user reviews | ✓ |
| Generator service | Termly/iubenda boilerplate | |

**Notes:** Nutrition label posture (Crash Data only; Health & Fitness not "collected"
since HealthKit data never leaves device) recorded as researcher-verify item, not asked.

---

## Store listing & screenshots

| Option | Description | Selected |
|--------|-------------|----------|
| Framed + captions (Recommended) | Device frames on brand-dark backgrounds, mono captions | ✓ |
| Raw captures | Straight screenshots | |
| Marketing-heavy | Illustrated panels | |

**Featured screens (multi-select):** TODAY hero ✓, Lift ledger ✓, Run + History ✓, Apple Health ✓ (all four)

| Option | Description | Selected |
|--------|-------------|----------|
| Apsis — Hybrid Training (Recommended) | Brand + search terms in name | ✓ |
| Just Apsis | Brand only | |
| Keyword-first | Max discovery | |

| Option | Description | Selected |
|--------|-------------|----------|
| Athlete-direct (Recommended) | Terse second-person, HYROX/tactical register | ✓ |
| Explainer | Gentler problem-first copy | |

| Option | Description | Selected |
|--------|-------------|----------|
| Free (Recommended) | No IAP; monetize later | ✓ |
| Paid up front | Revenue day one | |
| Free + placeholder IAP | Subscription scaffolding | |

| Option | Description | Selected |
|--------|-------------|----------|
| Health & Fitness (Recommended) | Category peers: Strong/Hevy/Strava | ✓ |
| Sports | Event-app category | |

| Option | Description | Selected |
|--------|-------------|----------|
| 6.9" only (Recommended) | ASC scales down automatically | ✓ |
| 6.9" + 6.5" | Hand-tailored older-device set | |

---

## Submission logistics

| Option | Description | Selected |
|--------|-------------|----------|
| Short self-TestFlight (Recommended) | 2–3 day release-build self smoke test | |
| Straight to review | No beta | |
| External beta first | Public TestFlight link, outside testers | ✓ |

**User's choice:** External beta — user accepted the timeline pressure flagged in the option text.

| Option | Description | Selected |
|--------|-------------|----------|
| ~1 week, small group (Recommended) | July 15–22 hard stop, submit July 23–25 | ✓ |
| Beta until it's ready | Deadline goes soft | |
| Shrink to internal-only | Fallback if recruiting stalls | |

**Notes:** Internal-only fallback retained as the contingency if recruiting stalls by July 15.

| Option | Description | Selected |
|--------|-------------|----------|
| Crashes/blockers only (Recommended) | Feature feedback banks for v1.1 | |
| Blockers + top UX friction | Also take quick UX fixes | ✓ |

| Option | Description | Selected |
|--------|-------------|----------|
| Manual release (Recommended) | User presses Release | ✓ |
| Auto-release | Live on approval | |
| Phased release | 7-day rollout | |

| Option | Description | Selected |
|--------|-------------|----------|
| Full walkthrough note (Recommended) | Offline, HealthKit optional, on-device data posture | ✓ |
| Minimal note | One line | |

| Option | Description | Selected |
|--------|-------------|----------|
| 1.0.0 + auto-increment (Recommended) | EAS autoIncrement buildNumber | ✓ |
| 0.9.x beta, 1.0.0 submit | Split versions | |

| Option | Description | Selected |
|--------|-------------|----------|
| Exempt — declare in Info.plist (Recommended) | ITSAppUsesNonExemptEncryption=false | ✓ |
| Answer per submission | Manual questionnaire | |

---

## Exercise catalog (user-raised mid-discussion)

User observed the lifting logger's catalog is small and asked how bodyweight movements
handle weight. Investigation confirmed: 43 seeded movements, no custom-exercise creation,
bwFactor effective-load formula (weight field = added load), and an inconsistency —
ab-wheel/hanging-leg-raise have bwFactor null and score ~0 HSS.

| Option | Description | Selected |
|--------|-------------|----------|
| Fold into Phase 6 (Recommended) | ~150 curated movements + bwFactor fixes, before July 15 beta | ✓ |
| Fix bwFactors only | Two-line fix, catalog to v1.1 | |
| Defer all to v1.1 | Ship 43 as-is | |

---

## Claude's Discretion

- Static hosting mechanics for apsistraining.com/privacy
- Sentry setup details (DSN handling, env split, release tagging)
- Keyword field contents
- Screenshot production tooling
- bwFactor values for new catalog entries

## Deferred Ideas

- Custom exercise creation → v1.1
- Sentry beyond crashes (tracing/breadcrumbs/replay) → v1.1
- Monetization model → v1.1+
