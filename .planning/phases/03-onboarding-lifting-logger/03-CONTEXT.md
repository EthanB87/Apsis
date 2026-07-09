# Phase 3: Onboarding & Lifting Logger - Context

**Gathered:** 2026-07-09
**Status:** Ready for planning

<domain>
## Phase Boundary

A user completes onboarding once — sex, bodyweight, threshold HR, threshold pace into
`user_profile` — then logs a full lifting session at Strong/Hevy entry speed with live
HSS feedback, fully offline. Covers ONB-01..04 and LIFT-01..08. Includes the first real
app UI: tab navigation, onboarding wizard, active-workout screen, settings. The Phase 4
dashboard (readiness band, trend chart, day-grouped history) is explicitly NOT this
phase; the Home tab ships as a placeholder.

This phase also resolves Phase 02's deferred D-12: the bodyweight-movement /
loaded-carry logging convention, including two small pure additions to
`packages/engine` (rep-max-table e1RM estimator, RPE-scaled carry stress).

</domain>

<decisions>
## Implementation Decisions

### Onboarding & threshold capture
- **D-01:** Multi-step wizard — one input per screen (3–5 steps), big touch targets,
  progress indicator. Mandatory and one-time: blocks on first launch until complete, so
  all downstream code may assume a profile row exists (no null-profile branches).
- **D-02:** Threshold capture offers two paths per input: "I know my numbers" direct
  entry OR "estimate for me".
  - Threshold pace estimate: race-time picker — pick distance (5k / 10k / half) +
    finish time, derive threshold pace via standard race-pace conversion (e.g., 5k pace
    × ~1.05).
  - Threshold HR estimate: ask for max HR if known (threshold ≈ max HR × 0.90); else
    fall back to age-based formula ((220 − age) × 0.90). Estimate path may collect
    age/birth-year for the fallback.
- **D-03:** Validation is soft: accept any numeric input, show an inline "are you
  sure?" warning outside plausible ranges (bodyweight 30–250 kg, threshold HR 100–220,
  threshold pace 2:30–12:00 /km). Never block save — mirrors engine clamp-and-warn
  (Phase 02 D-15).
- **D-04:** Wizard ends with a review screen: all captured values shown (estimates
  labeled "estimated"), tap-to-edit, then Save. The same review pattern is reused as
  the settings profile editor (ONB-02).
- **D-05:** Units (km↔mi, kg↔lb display) are asked in the wizard and changeable in
  Settings (ONB-04). Profile edits (thresholds, bodyweight) apply to FUTURE
  calculations only — stored scores are never rewritten (they're version-stamped per
  Phase 02 D-06).

### Set entry (LIFT-01..04, LIFT-06)
- **D-06:** Load/reps entry = pre-filled values with +/− steppers (weight ±2.5 kg /
  ±5 lb; reps ±1); tapping the number opens a numeric keypad for direct entry. An
  unchanged pre-fill completes in 1 tap (the checkmark).
- **D-07:** Pre-population: each new set clones the previous set; the first set of an
  exercise pre-fills from that exercise's previous session (LIFT-03). First-ever
  logging of an exercise shows blank load/reps with keypad focus — no fabricated
  defaults.
- **D-08:** RPE quick-row is inline per set row: compact 6·7·8·9·10 segment control at
  the end of each row, pre-selected to that exercise's last-used RPE, never behind a
  modal (LIFT-04). Half-point RPE (e.g., 7.5) via long-press is optional polish.
- **D-09:** Set completion is an explicit per-row checkmark — checking commits the set
  (fires rest timer + live HSS recompute); unchecking undoes. A small "W" chip on the
  row toggles warmup (excluded from HSS by the engine).
- **D-10:** Exercise picker (LIFT-01): "Add exercise" opens a search-first bottom
  sheet — search field auto-focused, recents/frequents listed above the full A–Z
  library grouped by body part. All local, instant filtering.
- **D-11:** Add/remove sets (LIFT-06): "+ Add set" row at the card bottom clones the
  previous set's values; removal via standard iOS swipe-left → Delete.
- **D-12:** Imperial display: steppers move in native 5 lb increments and display
  whole lb; entered lb converts to exact kg for storage (225 lb → 102.06 kg). Display
  must round-trip to the entered number — a lifter never sees 224.9.

### Persistence & live HSS (LIFT-08)
- **D-13:** Persist-per-set: every checkmark writes the set row to SQLite immediately,
  recomputes session HSS via the engine, and updates `workout.hss` + the header
  display. Mid-workout crash loses nothing.
- **D-14:** Crash/kill recovery: a `workout` row without a finished marker is an open
  session; on next launch show an auto-resume prompt — "Resume workout from 14:32?
  [Resume] [Finish now] [Discard]". (Requires a finished-at/status column on
  `workout` — schema migration.)

### Bodyweight movements & loaded carries (resolves Phase 02 D-12)
- **D-15:** Effective load for BW movements = profile bodyweight × per-exercise factor
  + added weight. Factors come from biomechanics literature (pull-up ≈0.95, dip ≈0.95,
  push-up ≈0.64, lunge ≈0.85×BW+load — researcher to verify/complete the table for all
  seeded BW movements).
- **D-16:** Effective load is computed from profile bodyweight at log time and
  persisted into the set's `loadKg` — historical sets never drift when bodyweight
  changes (consistent with D-05 edits-apply-forward).
- **D-17:** BW set-row UI: load field reads "+0 kg" (added weight — vest, belt,
  dumbbells, implement), pre-filled from last session; computed effective load shown
  subtly (e.g., "≈ 78 kg effective"). Implement movements (wall balls, KB swings, DB
  lunges) use the same model: bwFactor + implement weight as "added" — added weight
  always means "what you're holding".
- **D-18:** e1RM for BW movements uses a rep-max table (Brzycki/table hybrid) instead
  of Epley, because Epley degrades above ~12 reps where BW work lives. Barbell lifts
  keep Epley per Phase 02 D-10. The new estimator is a pure function added to
  `packages/engine` with its own tests.
- **D-19:** Loaded carries and sleds (farmer's carry, sled push) get a third entry
  mode: load + duration + RPE per set (no reps).
- **D-20:** Carry/sled stress formula: RPE-scaled duration — stress ≈ durationMin ×
  (RPE/10)² × k, reusing the endurance IF² shape with RPE standing in for IF, plus a
  load-vs-bodyweight multiplier. New pure function in `packages/engine` with its own
  golden test (calibration anchor: 4×40 m heavy farmer's carry ≈ a hard accessory
  block, well under the ~100 HSS threshold-run anchor).
- **D-21:** Per-exercise metadata lives on the `exercise` table: add `bwFactor` (real,
  null = not a BW movement) and `entryMode` ('reps' | 'timed') columns via drizzle
  migration; update seed data with factors and modes.

### Session flow & rest timer (LIFT-05, LIFT-07)
- **D-22:** Active session = one scrollable screen of exercise cards (header + set
  rows + add-set), "Add exercise" at the bottom, sticky header with elapsed time +
  live session HSS, Finish button. The Strong/Hevy shape.
- **D-23:** Live HSS displays in the sticky header with a count-up tick animation on
  every checked set; tapping it opens a breakdown sheet.
- **D-24:** Breakdown sheet shows per-exercise stress subtotals + set counts + session
  total (rolled up from `sessionHSSDetailed` per-set output). No raw formula internals.
- **D-25:** Rest timer: global default duration in Settings (e.g., 2:00) +
  per-exercise override saved and remembered across sessions. Banner countdown with
  +30s and skip; haptic + sound at zero.
- **D-26:** Timer state is timestamp-based (`endsAt`) so backgrounding is free; a
  local notification (expo-notifications) fires on expiry when backgrounded/locked and
  is cancelled if the user returns early. Notification permission is requested on
  first timer use — NOT during onboarding.
- **D-27:** Finish → summary screen: session HSS (big), per-exercise volume/set
  counts, engine warnings list; Done returns to tabs. Discard lives behind a menu
  (never adjacent to Finish) with a confirm dialog (LIFT-07).
- **D-28:** Discard is a soft delete: sets `deletedAt` on the workout; the session
  disappears from history and ALL HSS/load_daily computations exclude it. No recovery
  UI in v1.0 — data survives as a support/debug safety net. (Schema: `deletedAt`
  column on `workout`; every load query filters it.)
- **D-29:** Engine warnings surface as a subtle ⚠ badge on the affected set row (tap
  for message) + the full list on the finish summary. Never interrupts the logging
  loop.

### Navigation & app shell
- **D-30:** Build the real tab bar this phase: Home / Log / Settings (expo-router
  tabs). Phase 4 fills the Home tab in place — no navigation rework later.
- **D-31:** Home tab in this phase is a branded "coming soon" placeholder pointing to
  the Log tab. No readiness band, no session list — readiness display and its ONB-03
  gating states are Phase 4's HOME requirements. (ONB-03 is satisfied structurally
  this phase: readiness is never shown anywhere, and onboarding is mandatory-complete
  before the app is usable at all.)
- **D-32:** Settings tab scope: profile editor (wizard review-screen pattern), units
  toggle, default rest-timer duration, about/version footer at most. No notification
  preferences, no data management (deferred).

### Claude's Discretion
- Exact wizard step count/ordering and copy; race-pace conversion constants;
  age-fallback input design.
- State management wiring (zustand is approved stack but not yet installed), query
  patterns over op-sqlite/drizzle, recompute-on-write mechanics for `load_daily`.
- Rest-timer banner visuals, tick-animation implementation, haptics details.
- Exact BW factor values (literature-verified during research), rep-max table choice,
  carry-stress `k` calibration value — all pinned by engine tests.
- Migration mechanics for new columns (`bwFactor`, `entryMode`, `workout.finishedAt`
  or status, `workout.deletedAt`) and any needed seed updates.
- Breakdown sheet layout, exercise-card visual design, empty states.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Build spec (authoritative)
- `BUILD.md` §5 — data model. NOTE: the shipped schema in `packages/db/src/schema.ts`
  deviates from §5 in places (e.g., `setNumber` vs `setIndex`, no `source` column yet);
  the shipped schema + drizzle migrations win, extended per D-14/D-21/D-28.
- `BUILD.md` §6 "Phase 1 — Local logger" — original lifting-log flow spec and exit
  criteria this phase implements (lifting half).
- `BUILD.md` §3 — approved dependencies (zustand, react-query optional; no new deps
  beyond expo-notifications without justification).

### Requirements & roadmap
- `.planning/REQUIREMENTS.md` — ONB-01..04, LIFT-01..08 (all mapped to this phase).
- `.planning/ROADMAP.md` — Phase 03 goal + 5 success criteria.

### Prior phase decisions (engine contract)
- `.planning/phases/02-hss-engine/02-CONTEXT.md` — D-05/D-06 (detailed results +
  version stamping), D-10 (Epley in engine, heaviest-set caching), D-11 (resolveIF
  precedence), D-12 (the deferred BW convention this phase resolves), D-15
  (clamp-and-warn).
- `packages/engine/src/index.ts` — public engine barrel: `sessionHSS(Detailed)`,
  `strengthStress(Detailed)`, `estimateE1RM`, `dailyHSS`, trend/readiness functions.
  This phase ADDS pure functions here (D-18 rep-max estimator, D-20 carry stress) —
  engine purity rules apply (no I/O, no Date.now(), time passed in).

### Existing code
- `packages/db/src/schema.ts` — six-table schema; this phase migrates it (D-14, D-21,
  D-28).
- `packages/db/src/seed.ts` — `STARTER_EXERCISES` (40+ movements) to be extended with
  `bwFactor`/`entryMode` values.
- `packages/shared/src/index.ts` — `Sex`, `Units`, `ActivityType`, `ReadinessBand`
  types.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `packages/engine` — complete, tested HSS engine (61 tests). Logger calls
  `strengthStressDetailed`/`sessionHSSDetailed` per checked set; `estimateE1RM` for
  barbell e1RM caching; warnings[] feeds D-29 badges.
- `packages/db` — schema, migrations pipeline (drizzle-kit → bundled .sql →
  `useMigrations` on startup), idempotent exercise seeding — all proven in Phase 01.
- `apps/mobile` — Expo SDK 56 + expo-router tabs template boots with op-sqlite;
  Metro/babel already handle .sql bundling. The `(tabs)` template screens are
  placeholders to replace (D-30).

### Established Patterns
- Engine purity: new engine functions (D-18, D-20) must be pure TS, tested, zero deps.
- Parameterized drizzle query builders only — no raw SQL with user values (T-1-01).
- All data stored metric (kg, sec/km); units are a display concern only (D-12 kg/lb
  round-trip rule).
- Version-stamped engine outputs (Phase 02 D-06) → profile edits apply forward only.

### Integration Points
- zustand (approved, not yet installed) for active-session state; op-sqlite JSI writes
  are synchronous — per-set persist (D-13) is cheap.
- `load_daily` recompute-on-write: saving/updating a workout triggers engine
  `dailyHSS` + trend recompute for affected dates (BUILD.md §5 acceptance).
- Phase 4 consumes this phase's nav shell (Home tab slot), profile (IF resolution for
  runs), and the proven write→recompute→UI reactive chain.
- Phase 5 (HealthKit) will import bodyweight — D-16's log-time snapshot rule already
  accommodates changing bodyweight.

</code_context>

<specifics>
## Specific Ideas

- Strong/Hevy are the explicit UX benchmarks: pre-filled steppers, checkmark-to-commit,
  one scrollable session screen. "Match Strong/Hevy entry speed" is existential, not
  polish.
- The live HSS tick in the sticky header is THE differentiator moment (LIFT-08) — the
  athlete watches training load accumulate as they train. Make the animation feel
  earned, not gimmicky.
- "Honest number" thesis extends to inputs: no fabricated defaults for first-time
  exercises, estimates labeled as estimates, warnings visible (badge + finish screen),
  effective load shown transparently ("≈ 78 kg effective").
- Discard must be hard to hit accidentally (menu + confirm) but data-safe when used
  (soft delete).

</specifics>

<deferred>
## Deferred Ideas

- **Live Activity / Dynamic Island rest-timer countdown** — best-in-class timer UX;
  needs ActivityKit native module. v1.1.
- **Trash/recovery UI for discarded sessions** — soft-deleted data already survives
  (D-28); surface it in a future release.
- **Notification preference toggles in Settings** — banner/haptic/sound controls
  beyond the timer's own UI. Revisit if TestFlight feedback demands it.
- **Data export / delete-all-data** — belongs with Phase 6 privacy prep or v1.1.
- (Carried from Phase 02, now partially resolved: the BW stress path is handled via
  effective-load + factors (D-15) and carry stress (D-20) rather than an alternate
  RPE-only formula. If factors prove awkward for specific HYROX movements, revisit in
  v1.1 with logged RPE data.)

</deferred>

---

*Phase: 03-onboarding-lifting-logger*
*Context gathered: 2026-07-09*
