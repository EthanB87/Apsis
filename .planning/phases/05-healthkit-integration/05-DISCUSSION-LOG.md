# Phase 5: HealthKit Integration - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-11
**Phase:** 05-HealthKit Integration
**Areas discussed:** Import scope & sync triggers, Dedupe & provenance, Write-back policy, Bodyweight import, Permission-denied & partial grants, First-run import experience, Sync status & failure surfacing

---

## Import scope & sync triggers

| Option | Description | Selected |
|--------|-------------|----------|
| 90 days | ATL/CTL EWMA converges; new user can skip/shorten the 14-day calibrating window | ✓ |
| 28 days | Matches trend window exactly, but CTL under-converged | |
| All history | Unbounded import size, diminishing returns on 28-day EWMA | |

**User's choice:** 90 days initial import depth.

| Option | Description | Selected |
|--------|-------------|----------|
| On app foreground | Silent delta-check each open/foreground; no background entitlements | ✓ |
| Manual 'Sync now' only | Predictable but stale-by-default | |
| Background delivery (HKObserverQuery) | Push-style but heavy entitlement/review surface | |

**User's choice:** On app foreground.

| Option | Description | Selected |
|--------|-------------|----------|
| Settings toggle | Opt-in row, no new screens, cleanly cuttable (recommended) | |
| One-time TODAY banner + Settings | More discoverable, adds dashboard surface | |
| Prompt during onboarding | Highest connect rate, touches shipped wizard | ✓ |

**User's choice:** Prompt during onboarding — user chose against the recommendation, prioritizing connect rate.

| Option | Description | Selected |
|--------|-------------|----------|
| Settings row too | Covers existing installs, decliners, re-grants | ✓ |
| Onboarding only | Existing installs could never connect | |

**User's choice:** Settings row too (fallback entry point).

| Option | Description | Selected |
|--------|-------------|----------|
| Run + Row + broad cardio | Running→run, Rowing→erg, other cardio→conditioning | ✓ |
| Running + Rowing only | Clean 1:1 mapping, misses cycling/HIIT load | |
| Running only | Literal HK-01 minimum | |

**User's choice:** Run + Row + broad cardio.

---

## Dedupe & provenance

| Option | Description | Selected |
|--------|-------------|----------|
| Same day + similar metrics | Same localDate + type + duration ±~15% | ✓ |
| Same day + same type (coarse) | Would drop genuine two-run days | |
| Exact time-range overlap | Not viable — manual entries have no time-of-day | |

**User's choice:** Same day + similar metrics.

| Option | Description | Selected |
|--------|-------------|----------|
| Manual entry wins | HK import skipped; never mutates existing data | ✓ |
| Imported entry wins | Richer HR but silently rewrites user data | |
| Merge HR into manual | Best data, partial-mutation machinery | |

**User's choice:** Manual entry wins.

| Option | Description | Selected |
|--------|-------------|----------|
| Subtle source badge | Mono 'APPLE HEALTH' chip in History + session detail | ✓ |
| Detail screen only | Unexplained imports in History read as a bug | |
| No visual distinction | Violates the honest-number ethos | |

**User's choice:** Subtle source badge (both surfaces).

| Option | Description | Selected |
|--------|-------------|----------|
| Soft hint, never block | Inline note on run form when a similar import exists that day | ✓ |
| Don't handle it | Badge makes duplicates obvious; user deletes one | |
| Auto-supersede the import | Save silently deletes another row — surprising | |

**User's choice:** Soft hint, never block.

| Option | Description | Selected |
|--------|-------------|----------|
| Exclude strength workouts | Apsis is source of truth for lifting; no sets/reps in HK | ✓ |
| Import as conditioning | Scores lifting with endurance math — dishonest | |
| Import only if no Apsis lift that day | Conditional cross-type dedupe, wrong formula anyway | |

**User's choice:** Exclude strength workouts.

| Option | Description | Selected |
|--------|-------------|----------|
| Quiet inline notice | Transient mono line on TODAY when a sync imports something | ✓ |
| Fully silent | Ring jumping unexplained reads as a glitch | |
| Summary sheet | Interruption on every app-open with new data | |

**User's choice:** Quiet inline notice.

---

## Write-back policy

| Option | Description | Selected |
|--------|-------------|----------|
| Immediately on finish/save | Fire-and-forget on existing paths; failures never block | ✓ |
| Batched at next sync | One HK I/O path, but late appearance + queue state | |
| Immediate + retry queue | Most robust, most infrastructure | |

**User's choice:** Immediately on finish/save.

| Option | Description | Selected |
|--------|-------------|----------|
| Delete from Health too | Keeps Health consistent; needs HK UUID per written workout | ✓ |
| Leave it in Health | Discarded sessions pollute the health record | |

**User's choice:** Delete from Health too.

| Option | Description | Selected |
|--------|-------------|----------|
| Basics + HSS metadata | Type/times/distance + session HSS custom key; no calories | ✓ |
| Bare minimum | HSS doesn't travel with the workout | |
| Basics + HSS + estimated calories | Apsis has no calorie model — dishonest | |

**User's choice:** Basics + HSS metadata. Initially answered freeform asking about v1.1 nutrition tracking; advised that HK permissions are per-type (dietary types additive later, zero architectural cost now) and that writing fabricated calories would pollute future energy-balance math. User confirmed basics + HSS, no calories.

| Option | Description | Selected |
|--------|-------------|----------|
| No backfill | Write-back go-forward from connection time | ✓ |
| One-time backfill on connect | Bulk-write path + backdated-sample handling | |

**User's choice:** No backfill.

---

## Bodyweight import

| Option | Description | Selected |
|--------|-------------|----------|
| Ongoing silent sync | Most-recent Health sample per foreground sync; D-16 forward-only makes it safe | ✓ |
| One-time on connect | Profile drifts stale for regular weigh-ins | |
| Confirm each change | Recurring interruption without safety payoff | |

**User's choice:** Ongoing silent sync.

| Option | Description | Selected |
|--------|-------------|----------|
| Most recent wins | Timestamps compete on recency; self-correcting | ✓ |
| Manual edit pins until next sample | Effectively the same rule | |
| Manual always wins | One casual edit silently kills smart-scale flow | |

**User's choice:** Most recent wins.

| Option | Description | Selected |
|--------|-------------|----------|
| No — import only | HK-02 is one-way; no write permission for weight | ✓ |
| Yes — two-way | Marginal value, feedback-loop risk | |

**User's choice:** No — import only.

---

## Permission-denied & partial grants

| Option | Description | Selected |
|--------|-------------|----------|
| Sheet completed = Connected | Honest about what iOS lets us know; sub-copy points to Health app | ✓ |
| Write-grant as proxy | Precise-looking but often wrong about reads | |
| Infer from read results | Empty history indistinguishable from denial | |

**User's choice:** Sheet completed = Connected.

| Option | Description | Selected |
|--------|-------------|----------|
| Skip silently, note Settings | Skippable step, one quiet line, no re-prompts | ✓ |
| One later reminder | Adds a dashboard surface for the first-to-cut feature | |
| Re-ask at each relevant moment | Persistent annoyance | |

**User's choice:** Skip silently, note Settings.

| Option | Description | Selected |
|--------|-------------|----------|
| In-app sync toggle | Off pauses HK I/O; sub-copy points to Health app for true revocation | ✓ |
| No in-app disconnect | Dead-end UX where the user turned it on | |

**User's choice:** In-app sync toggle.

---

## First-run import experience

| Option | Description | Selected |
|--------|-------------|----------|
| Background, TODAY fills in | Onboarding finishes immediately; reactive chain live-updates the dashboard | ✓ |
| Brief blocking step with progress | Cleaner reveal, more failure states + UAT surface | |
| Defer to first TODAY visit | First dashboard look is empty when data was right there | |

**User's choice:** Background, TODAY fills in.

| Option | Description | Selected |
|--------|-------------|----------|
| After review/save, last step | Minimal change to the UAT-verified wizard; profile exists before import | ✓ |
| Before bodyweight | Couples profile capture to async HK reads | |
| After thresholds, before review | Review would wait on async HK data | |

**User's choice:** After review/save, last step.

---

## Sync status & failure surfacing

| Option | Description | Selected |
|--------|-------------|----------|
| Last-synced timestamp | One mono line: 'LAST SYNC 9:41 AM' | ✓ |
| Nothing | Can't distinguish broken vs off vs nothing-to-import | |
| Sync detail screen | Over-built for a v1.0 adapter | |

**User's choice:** Last-synced timestamp.

| Option | Description | Selected |
|--------|-------------|----------|
| Silent + retry next foreground | Log-only; timestamp stops advancing; delta from last successful sync | ✓ |
| Quiet error state in Settings | 'SYNC FAILED · TAP TO RETRY' after repeated failures | |
| Alert on failure | Interrupts the logging flow the app protects | |

**User's choice:** Silent + retry next foreground.

## Claude's Discretion

- Exact HKWorkoutActivityType → activityType mapping table; dedupe duration tolerance constant (~±15%).
- Echo-exclusion mechanics (bundle-ID filter vs written-UUID set); `workout.source` + HK-UUID column shapes and migration.
- Imported-deleted tombstones (swipe-deleted imports must not resurrect on next sync).
- HSS metadata key naming; HK anchored-query vs date-window delta mechanics.
- Import IF resolution (rides resolveIF, HR-wins precedence); missing-HR fallback per engine warnings.
- TODAY import-notice presentation details; onboarding step copy/visual design.

## Deferred Ideas

- Nutrition/HealthKit dietary integration (read/write dietary energy + macros) — v1.1, pairs with NUTR-01; v1.0 write-backs stay calorie-free to keep energy-balance math clean.
- Background delivery (HKObserverQuery) — post-launch if foreground sync feels stale.
- Write-back retry queue — v1.0 is fire-and-forget.
- Historical backfill of pre-Phase-5 sessions to Health.
- HR merge into duplicate manual entries (rejected partial-mutation path).
