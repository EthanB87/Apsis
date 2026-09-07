# Phase 5: HealthKit Integration - Context

**Gathered:** 2026-07-11
**Status:** Ready for planning

<domain>
## Phase Boundary

Apple Health data flows into Apsis and Apsis sessions flow back to Health, with no
duplicates in either direction: import runs/cardio (distance, duration, HR) and the
most-recent bodyweight from HealthKit; write logged lifting and running sessions back
to Health. Covers HK-01..04. Adapter/import logic riding the existing
save→recompute→UI chain; UI surface is limited to one appended onboarding step, a
Settings row/toggle, a History/session-detail source badge, and a transient TODAY
import notice. Explicitly the lowest-priority v1.0 feature — first to cut if the
July 28 timeline slips (Phase 06 can proceed without it).

</domain>

<decisions>
## Implementation Decisions

### Import scope & sync triggers
- **D-01 (Initial depth):** Initial import reaches back **90 days** — enough history
  for ATL/CTL EWMA to converge, so a new user with existing Health data can skip or
  shorten the 14-day calibrating window and see a real readiness band on day one.
- **D-02 (Ongoing sync):** Silent delta-check **on app foreground** (new Health
  workouts since last successful sync). No background delivery, no manual-only button.
  Local-first: sync never blocks logging.
- **D-03 (Permission entry points):** BOTH a new **onboarding step** (new users) and a
  permanent **"Connect Apple Health" row in Settings** (existing installs, decliners,
  re-grants). Onboarding is the front door; Settings is the permanent home.
- **D-04 (Type mapping):** Import Running → `run`, Rowing → `erg`, and broad cardio
  (cycling, HIIT, hiking, swimming, elliptical, …) → `conditioning` (duration + HR
  only, no pace). Everything contributes to HSS — a Zwift ride shouldn't be invisible
  stress. Exact HKWorkoutActivityType list is Claude's discretion.
- **D-05 (Strength excluded):** Apple Watch "Traditional Strength Training" workouts
  are **never imported** — Apsis is the source of truth for lifting; watch strength
  recordings carry no sets/reps/load and can't produce an honest strength HSS.

### Dedupe & provenance (HK-03)
- **D-06 (Overlap rule):** Duplicate = **same localDate + same activity type +
  duration within ~±15%**. Manual entries have no time-of-day (schema fact), so exact
  time-range matching is not viable. A morning run + evening erg both survive; honest
  double-days stay intact.
- **D-07 (Manual wins):** When a duplicate is detected at import time, the **manual
  entry wins** and the HK import is skipped. Existing data is never mutated.
- **D-08 (Source badge):** Imported sessions get a **subtle mono "APPLE HEALTH" chip**
  on the session detail screen AND in the History row metadata line — fits the ledger
  language (mono captions, ash tint). Requires a `workout.source` column migration.
- **D-09 (Reverse-order dupes):** If the run form's selected date already has an
  imported session with similar duration, show a **soft inline hint** ("An imported
  run already covers this — saving will count both"). Save stays one tap; never
  blocks (clamp-and-warn continuity, Phase 3 D-03).
- **D-10 (Import notice):** When a foreground sync imports sessions, show a **quiet
  transient mono notice on TODAY** (e.g. "IMPORTED 2 SESSIONS FROM APPLE HEALTH") so
  the ring visibly moving is explained. Silent when nothing new.
- **D-11 (Echo exclusion):** Apsis must never re-import its own write-backs — exclude
  own-bundle samples at query time (mechanics Claude's discretion; pairs with D-14's
  HK UUID tracking).

### Write-back policy (HK-04)
- **D-12 (Timing):** Write to Health **immediately on finish/save**, fire-and-forget,
  appended to the existing lift-finish and run-save paths. A failed write logs and
  never blocks the save (local-first). No retry queue in v1.0.
- **D-13 (Payload):** **Basics + HSS metadata, no calories.** Runs → running workout
  with distance/duration; lifts → traditional strength training with duration; session
  HSS attached as a custom metadata key (e.g. `ApsisHSS`). NO fabricated calorie
  estimates — Apsis has no calorie model, and invented energy data would pollute the
  energy-balance math a v1.1 nutrition feature depends on.
- **D-14 (Delete sync):** Discarding or swipe-deleting a session in Apsis (soft
  delete) also **deletes our written sample from Health** (apps can always delete
  samples they authored). Requires storing the HK UUID per written workout — a
  `workout` column the echo-exclusion work wants anyway.
- **D-15 (No backfill):** Write-back is **go-forward only** from connection time.
  Sessions logged before Phase 5 ships stay Apsis-only.

### Bodyweight import (HK-02)
- **D-16 (Ongoing silent sync):** Each foreground sync pulls the most-recent Health
  bodyweight sample; if newer than the profile's, update it silently. Safe by
  construction — Phase 3 D-16 guarantees bodyweight changes apply forward-only
  (historical sets never drift).
- **D-17 (Conflict rule):** **Most recent wins by timestamp** — a manual Settings
  edit and a Health sample compete purely on recency. Requires persisting when the
  profile bodyweight was last set.
- **D-18 (Import-only):** Settings bodyweight edits are never written to Health.
  One-way flow; no bodyweight write permission requested.

### Permissions, connection state & failure UX
- **D-19 (Connected = sheet completed):** iOS hides read-grant status, so the
  Settings row shows "Connected" once the user completes the iOS permission sheet,
  with sub-copy "Manage permissions in the Health app." No false precision; if reads
  return nothing, the app behaves as if there's no Health data.
- **D-20 (Decline UX):** The onboarding step is explicitly skippable ("Not now");
  declining advances the wizard with one quiet line — "You can connect anytime in
  Settings." No re-prompts, no nagging.
- **D-21 (Disconnect):** The Settings row is a **sync toggle** — off pauses all HK
  reads/writes, with sub-copy pointing to the Health app for true permission
  revocation. Already-imported sessions stay.
- **D-22 (First-run import):** After onboarding permission grant, the 90-day import
  runs **in the background**; onboarding finishes immediately and TODAY starts
  calibrating, then live-updates to the real ring/band as imports land (the existing
  write→recompute→UI reactive chain). No blocking progress step.
- **D-23 (Onboarding step placement):** The HealthKit step is **appended as the last
  step, after review/save** — the shipped, UAT-verified wizard flow (sex → bodyweight
  → units → thresholds → review → save) is modified minimally, and the profile row
  (thresholds for IF resolution) already exists when the import starts.
- **D-24 (Sync status):** Settings shows one quiet mono line under the toggle —
  "LAST SYNC 9:41 AM" — from a persisted last-successful-sync value.
- **D-25 (Failure handling):** Sync/write failures are **silent** — log to console,
  last-synced timestamp stops advancing, next foreground sync retries naturally
  (delta window is measured from last SUCCESSFUL sync). No error banners; HealthKit
  is an enhancement layer and its failures never touch the local-first core.

### Claude's Discretion
- Exact HKWorkoutActivityType → activityType mapping table (D-04) and the duration
  tolerance constant for dedupe (D-06, ~±15%).
- Echo-exclusion mechanics (source bundle-ID filter vs written-UUID set) and the
  `workout.source` / HK-UUID column shapes + migration.
- Deleted-imports-stay-deleted bookkeeping (imported HK UUID tombstones so a
  swipe-deleted imported run doesn't resurrect on next sync).
- HSS metadata key naming (D-13); HK anchor/anchored-query vs date-window delta
  mechanics for the foreground sync.
- Import IF resolution details: imported runs ride resolveIF (HR wins over pace,
  Phase 2 D-11); conditioning imports have HR only; missing-HR imports fall back per
  existing engine warning behavior.
- TODAY import-notice presentation details (transient line vs toast, dismissal).
- Onboarding step copy and visual design (ledger language, palette binding).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Build spec & stack (authoritative)
- `BUILD.md` §3 — approved dependencies; `@kingstinct/react-native-healthkit` ~8.2.0
  is the locked HealthKit library (only maintained Expo-compatible option). §6 Phase 3
  ("HealthKit + polish") — original import/write-back/dedupe spec.
- `.claude/CLAUDE.md` Technology Stack §HealthKit — version pin (~8.2.0), config
  plugin requirement, dev-build + physical-device constraints.
- `apps/mobile/AGENTS.md` — read exact Expo SDK 56 versioned docs before writing code.

### Requirements & roadmap
- `.planning/REQUIREMENTS.md` — HK-01..04 (all mapped to this phase); REL-02/REL-03
  (Phase 6) depend on what health data this phase touches.
- `.planning/ROADMAP.md` — Phase 05 goal + 4 success criteria; "first to defer"
  status; Phase 06 does NOT block on this phase.

### Prior phase decisions (contracts this phase rides)
- `.planning/phases/04-run-logger-home-dashboard/04-CONTEXT.md` — run save path
  decisions; D-29 soft-delete + forward recompute convention (D-14 delete-sync
  extends it).
- `.planning/phases/03-onboarding-lifting-logger/03-CONTEXT.md` — D-16 (bodyweight
  log-time snapshot, edits apply forward — already written to accommodate HealthKit
  import), D-01 (onboarding wizard structure D-23 appends to), D-28 (soft delete).
- `.planning/phases/02-hss-engine/02-CONTEXT.md` — D-11 (resolveIF precedence: HR
  wins over pace — imported segments use the same rule).

### Existing code (integration surface)
- `apps/mobile/lib/runEntry.ts` — `saveRun` persist-then-recompute shape; the import
  path should mirror this (insert workout + endurance_segment, write HSS,
  recomputeLoadDaily). Also the D-12 write-back hook point for runs.
- `apps/mobile/lib/finishWorkout.ts` — lift finish path; D-12 write-back hook point
  for strength sessions.
- `apps/mobile/lib/recomputeLoadDaily.ts` — the recompute entry point every import
  batch must end with (once per batch, not per session).
- `packages/db/src/schema.ts` — `workout` has NO `source` column and NO HK UUID
  column yet (D-08/D-14 migrations); `endurance_segment` carries
  activityType/distanceM/durationS/avgHr/intensityFactor — imported runs fill the
  same shape. Manual workouts have `localDate` only (no time-of-day) — the schema
  fact behind D-06.
- `apps/mobile/lib/settingsStore.ts` + `app/(tabs)/settings/` — home for the D-03
  Settings row, D-21 toggle, D-24 last-sync line.
- `apps/mobile/app/onboarding/` — wizard the D-23 step appends to (post-review/save).
- `apps/mobile/lib/runEntryLogic.ts` — `resolveRunSegment` IF-resolution logic
  imported segments should reuse (pace gated to runs, HR for the rest).

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `saveRun` (`runEntry.ts`) proves the exact insert→HSS→recompute sequence an import
  needs; `resolveRunSegment` (`runEntryLogic.ts`) already gates pace-vs-HR IF
  resolution per activity type.
- `recomputeLoadDaily` full-table fold — one call after an import batch updates
  ring/band/trend everywhere; TODAY/History already react on focus.
- Session detail + History row metadata line — D-08's badge slots into existing
  ledger row components.
- Onboarding wizard step components (`WizardStep` pattern) — D-23 reuses them.

### Established Patterns
- Local-first: HK I/O must never block logging or app usability (D-12/D-25 comply).
- Clamp-and-warn, never block (Phase 3 D-03) — D-09's soft dedupe hint follows it.
- All data stored metric; HK returns quantities in requested units — convert at the
  adapter edge.
- Parameterized drizzle builders only; errors logged then re-thrown with generic
  user-facing messages (T-04-09).
- Focus-gated store access (useFocusEffect) for any screen effects the sync notice
  touches.

### Integration Points
- **EAS build gate (⚠ budget it):** `@kingstinct/react-native-healthkit` is a native
  module — requires app.json plugin entry, HealthKit entitlement,
  `NSHealthShareUsageDescription`/`NSHealthUpdateUsageDescription`, pnpm-lock sync,
  and a **fresh EAS dev build** before any on-device testing (STATE.md blocker note
  from Phase 04: stale dev client + out-of-sync lockfile blocked UAT start).
- Physical device required — simulator has minimal HealthKit data.
- Schema migration: `workout.source` + HK-UUID column(s) (drizzle migration, bundled
  .sql, same pipeline as Phases 03/04).
- Foreground sync trigger: app-state listener (AppState) — new infrastructure; keep
  it out of the logging screens.
- Phase 6 dependencies: the privacy nutrition label (REL-02) and Sentry scrub audit
  (REL-03) must reflect exactly what this phase reads/writes — keep the
  read/write-type list explicit in the plan.

</code_context>

<specifics>
## Specific Ideas

- The 90-day import exists to make day one honest AND impressive: a new user with an
  Apple Watch history should watch TODAY fill in with a real readiness band minutes
  after onboarding — no 14-day cold start.
- "Honest number" thesis extends to provenance: the APPLE HEALTH badge, the quiet
  import notice, and the refusal to fabricate calories or score watch-strength
  workouts are all the same principle.
- User is planning v1.1 nutrition tracking — the payload decision (D-13, no invented
  calories) deliberately keeps Health's energy data clean for that future feature.
- HealthKit remains the designated cut: every decision here biased toward the
  smallest honest version (no background delivery, no retry queue, no backfill, no
  error UI).

</specifics>

<deferred>
## Deferred Ideas

- **Nutrition/HealthKit dietary integration** — read dietary energy/macros from
  Health (MacroFactor/Cronometer users get credit automatically) and/or write
  Apsis-logged macros back. v1.1, pairs with NUTR-01. v1.0 write-backs stay
  calorie-free so future energy-balance math is clean.
- **Background delivery (HKObserverQuery)** — push-style sync while Apsis is closed;
  revisit post-launch if foreground sync feels stale.
- **Write-back retry queue** — persist failed HK writes and flush at next sync;
  v1.0 is fire-and-forget.
- **Historical backfill of pre-Phase-5 sessions to Health** — one-time bulk write on
  connect; deferred with no-backfill decision (D-15).
- **HR merge into duplicate manual entries** — backfill a matched manual run's
  missing avgHr from the skipped HK workout (considered at D-07, rejected for v1.0
  as a partial-mutation path).

</deferred>

---

*Phase: 5-HealthKit Integration*
*Context gathered: 2026-07-11*
