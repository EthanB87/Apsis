# Phase 3: Onboarding & Lifting Logger - Research

**Researched:** 2026-07-09
**Domain:** Expo Router app shell (navigation/onboarding gate), zustand session state + SQLite
persistence, expo-notifications/expo-haptics, and two new pure-TS engine additions
(bodyweight-movement e1RM, loaded-carry stress) grounded in exercise-science literature.
**Confidence:** MEDIUM (stack/navigation findings are web-cross-checked; biomechanics factors
and calibration constants are literature-informed but require engine-test verification —
see `## Assumptions Log`)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Onboarding & threshold capture**
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

**Set entry (LIFT-01..04, LIFT-06)**
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

**Persistence & live HSS (LIFT-08)**
- **D-13:** Persist-per-set: every checkmark writes the set row to SQLite immediately,
  recomputes session HSS via the engine, and updates `workout.hss` + the header
  display. Mid-workout crash loses nothing.
- **D-14:** Crash/kill recovery: a `workout` row without a finished marker is an open
  session; on next launch show an auto-resume prompt — "Resume workout from 14:32?
  [Resume] [Finish now] [Discard]". (Requires a finished-at/status column on
  `workout` — schema migration.)

**Bodyweight movements & loaded carries (resolves Phase 02 D-12)**
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

**Session flow & rest timer (LIFT-05, LIFT-07)**
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

**Navigation & app shell**
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

### Deferred Ideas (OUT OF SCOPE)
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
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-------------------|
| ONB-01 | User completes onboarding capturing sex, bodyweight, threshold HR, and threshold pace | `Stack.Protected` gating pattern (Pattern 1); D-02 race-pace/threshold-HR conversion research (Open Questions, A6); soft-validation pattern (Security Domain V5) |
| ONB-02 | User can view and edit profile inputs later from settings | Review-screen reuse pattern (D-04, Recommended Project Structure — `onboarding/review.tsx` reused by `(tabs)/settings`) |
| ONB-03 | Readiness band is gated behind completed onboarding (never shows wrong numbers) | Satisfied structurally this phase per D-31 — onboarding gate (Pattern 1) blocks all app usage, and no readiness UI exists yet (Home tab is a placeholder) |
| ONB-04 | User can toggle display units (km ↔ mi); data is always stored in metric | `lib/units.ts` design + imperial round-trip Code Example (D-12) |
| LIFT-01 | User can search the seeded exercise library inline (< 2 taps to find a movement) | `@gorhom/bottom-sheet` recommendation (Standard Stack, Pattern/Don't-Hand-Roll), local in-memory filter design (Architectural Responsibility Map) |
| LIFT-02 | User can log a set (load, reps, RPE, warmup flag) in ≤ 3 taps | Set-row component structure (Recommended Project Structure — `SetRow.tsx`), stepper/keypad pattern (D-06, existing Code Example) |
| LIFT-03 | Each set pre-populates with the previous-session weight + reps for that exercise | Wave 0 test gap `previous-session-query.test.ts`; db query pattern noted in Architecture |
| LIFT-04 | RPE entry is a persistent quick-row (6–10), last value pre-selected, never behind a modal | D-08 unchanged by research; `SetRow.tsx` component slot in project structure |
| LIFT-05 | Auto-rest timer starts on set completion (configurable, persistent banner) | Timestamp-based timer + `expo-notifications` background-delivery research (Pitfall 2, D-26); Environment Availability flags physical-device UAT need |
| LIFT-06 | User can add and remove sets inline | `react-native-gesture-handler` `Swipeable` recommendation (Don't Hand-Roll) |
| LIFT-07 | User can save or discard a session (discard confirmed); session HSS shown on finish | Soft-delete pattern (D-28) + Wave 0 test gap `soft-delete.test.ts` |
| LIFT-08 | Session HSS updates live as each set is logged (differentiator) | Per-set persist-then-recompute pattern (Pattern 2), Reanimated count-up research (Code Examples / State of the Art), existing `sessionHSSDetailed` test coverage |

</phase_requirements>

## Summary

Phase 3 is the first real UI phase: it turns the tested Phase 02 engine into a usable app.
Three technical threads converge here. First, **navigation/gating**: Expo Router forked from
React Navigation in SDK 56 — no `@react-navigation/*` imports are allowed — and the
SDK-53+ `Stack.Protected` guard pattern is the clean, declarative way to make onboarding
mandatory-before-tabs (D-01) without hand-rolled redirect logic scattered across screens.
Second, **state/persistence**: zustand holds only in-memory active-session UI state; SQLite
(via op-sqlite, already synchronous/JSI) stays the single source of truth per D-13, so the
zustand store should NOT use `persist`+AsyncStorage — auto-resume (D-14) is rebuilt from a
DB query for an unfinished `workout` row on relaunch, not from a second persisted copy.
Third, **the engine additions**: D-18 (bodyweight e1RM) and D-20 (carry/sled stress) are new
pure functions that must follow the exact `strengthStressDetailed`/`enduranceStressDetailed`
pattern already established in `packages/engine` (clamp-and-warn via `clampRange`, `Detailed`
+ bare-number facade, config-driven constants, zero I/O). Literature confirms Brzycki
degrades above ~10 reps (same failure mode as Epley, worse — it's undefined at 37 reps), so
a genuine rep-max **table** (not a single formula) is needed for the 15–30 rep ranges common
in bodyweight HYROX work. Biomechanics literature (Suprak et al. 2011 force-plate study;
Dempster/Chaffin segment-mass tables) directly supports the pull-up/dip ≈0.95 and push-up
≈0.65 factors already proposed in CONTEXT.md D-15, but provides no equivalent data for
lunge/step-up/goblet-squat or for core isometric holds — those remain coaching-consensus
estimates and are flagged accordingly.

**Primary recommendation:** Build the app shell with `Stack.Protected` gating a `(tabs)`
group behind a root-layout profile check; keep zustand in-memory-only for the active session
with per-set SQLite writes as the durable store; add the two new engine functions as
sibling modules to `strength.ts`/`endurance.ts` using the same clamp-and-warn + Detailed
pattern; use `@gorhom/bottom-sheet` v5 (Reanimated-4-compatible) for the exercise picker;
use `expo-crypto`'s `randomUUID()` for all new IDs (Hermes has no native Web Crypto).

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Onboarding wizard + validation | Browser/Client (RN screens) | — | Pure UI flow, no server; soft-validation logic lives in the screen/hook layer |
| Profile persistence (`user_profile`) | Database/Storage (SQLite via drizzle) | Client (form state) | Single local row; op-sqlite is the source of truth, zustand/React state is transient |
| Unit display conversion (km↔mi, kg↔lb) | Client (presentation layer) | — | D-05: storage always metric; conversion is a pure display-time function, never touches the DB |
| Exercise search/picker | Client (in-memory filter over seeded `exercise` rows) | Database (seed source) | All local, instant filtering — no query round-trip per keystroke |
| Active session state (in-progress sets, timer) | Client (zustand store) | Database (per-set persist) | Zustand = ephemeral UI state; SQLite = durable state (D-13); DB wins on conflict/resume |
| Set persistence + live HSS recompute | Database/Storage (op-sqlite write) + Engine (pure compute) | Client (triggers the write) | Engine never touches I/O; the screen/store calls engine then writes result via drizzle |
| Bodyweight-movement e1RM / carry stress (D-18, D-20) | Engine (`packages/engine`, pure TS) | — | New pure functions; no I/O, no wall-clock reads, config-driven constants |
| Rest timer (countdown, background survival) | Client (timestamp-based `endsAt` state) | OS (local notification) | Client owns the countdown UI; OS-level `expo-notifications` only fires when backgrounded |
| Local notification scheduling/cancelling | OS / native module (`expo-notifications`) | Client (schedules on timer start, cancels on return) | Permission + scheduling is inherently a native-bridge concern |
| Tab navigation shell | Client (expo-router `(tabs)` group) | — | File-based routing; no server involvement |
| Onboarding gate (mandatory before any tab) | Client (`Stack.Protected` guard in root layout) | Database (profile-exists check) | Guard reads a DB-backed boolean; routing logic itself is purely client-side |

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| expo-router | ~56.2.11 (already installed) | Tab shell, onboarding stack, `Stack.Protected` gating | Already pinned in `apps/mobile/package.json`; SDK 56 forked from React Navigation — do not import `@react-navigation/*` directly `[CITED: docs.expo.dev/router]` |
| zustand | 5.0.14 | Active-workout session state (in-memory only, no persist middleware) | Already approved in CLAUDE.md/BUILD.md §3; matches project's "light state, avoid Redux" constraint `[VERIFIED: npm registry]` |
| @op-engineering/op-sqlite + drizzle-orm 0.45.2 | 16.2.2 / 0.45.2 (already installed) | Per-set synchronous persistence (D-13), profile storage, migrations | Already the project's DB layer from Phase 01; extend schema via drizzle-kit, do not introduce a second persistence mechanism `[VERIFIED: npm registry]` |
| expo-crypto | ~56.0.4 (SDK-56 line; verify with `npx expo install`) | `randomUUID()` for `workout.id` / `strength_set.id` / `endurance_segment.id` | Hermes has no native Web Crypto API — bare `crypto.randomUUID()` throws at runtime even under New Architecture; expo-crypto is a native module that works without a polyfill and is already Expo-ecosystem-native `[ASSUMED — package discovered via WebSearch, not yet installed; verify exact SDK-56-line patch via `npx expo install expo-crypto`]` |
| @gorhom/bottom-sheet | 5.2.14 | Exercise picker sheet (D-10), breakdown sheet (D-24) | v5 ships first-class Reanimated-4 + New-Architecture support (peer dep `reanimated >=4.0.0-`), matching the project's pinned `react-native-reanimated 4.5.0`. Earlier majors were broken under Reanimated 4 `[ASSUMED — package discovered via WebSearch; SUS on legitimacy gate due to "too-new" publish-date signal, but OK verdict — see Package Legitimacy Audit]` |
| expo-notifications | ~56.0.20 (SDK-56 line; verify via `npx expo install`) | Rest-timer completion notification when backgrounded (D-26) | Only viable local-notification API in the Expo ecosystem; requires an explicit permission request even for local-only use `[ASSUMED — flagged SUS on legitimacy gate, see audit]` |
| expo-haptics | ~56.0.3 (SDK-56 line; verify via `npx expo install`) | Haptic feedback: RPE tap (`selectionAsync`), set checkmark (`impactAsync`), timer-zero (`notificationAsync`) | Standard Expo haptics module; three purpose-built methods map cleanly onto D-08/D-09/D-25 interactions `[ASSUMED — flagged SUS on legitimacy gate, see audit]` |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| react-native-reanimated | 4.5.0 (already installed) | Count-up tick animation on the live-HSS header (D-23), bottom-sheet animations | Already a peer dep of `@gorhom/bottom-sheet`; drive the HSS ticker with `withTiming` on a shared value rather than adding a separate animated-number package (CLAUDE.md: "ask before adding others") |
| react-native-gesture-handler | (SDK-bundled, already installed) | Swipe-to-delete set rows (D-11), bottom-sheet gestures | Already a peer dep of `@gorhom/bottom-sheet`; iOS swipe-left→Delete is a built-in RN `Swipeable`/gesture-handler pattern, no new package needed |
| drizzle-kit | 0.31.10 (already installed, dev dep) | Generate migrations for new columns (`bwFactor`, `entryMode`, `workout.finishedAt`/status, `workout.deletedAt`) | Run `npx drizzle-kit generate` from `packages/db` after any `schema.ts` edit; SQLite supports `ALTER TABLE ADD COLUMN` directly (no table-recreation) as long as the new column has no non-constant default |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `@gorhom/bottom-sheet` | Expo's native `@expo/ui` BottomSheet drop-in | Documented against SDK 57, availability in SDK 56 unconfirmed; lacks inline-peek and full customization vs. gorhom. Revisit once SDK 57 is the project baseline. |
| `expo-crypto` for UUIDs | `uuid` npm package + `react-native-get-random-values` polyfill | Extra dependency + must-import-first-in-index.js footgun for the polyfill; expo-crypto avoids both since it's a native module, not a JS polyfill |
| Custom Reanimated count-up hook | `react-native-animated-numbers` / `use-count-up` npm packages | Adds a dependency for ~20 lines of logic; CLAUDE.md's "ask before adding others" dependency policy favors the hand-rolled hook |
| Zustand `persist` + AsyncStorage for session resume | DB-query-based resume (query for unfinished `workout` row) | `persist` would create a second source of truth alongside the D-13 per-set SQLite writes, risking drift on crash; DB-only resume matches D-14 exactly |

**Installation:**
```bash
cd apps/mobile
npx expo install zustand expo-crypto expo-notifications expo-haptics
npm install @gorhom/bottom-sheet
```

**Version verification:** `npm view` confirms current registry versions (checked 2026-07-09):
`@gorhom/bottom-sheet@5.2.14` (published 2026-05-09), `zustand@5.0.14`. Expo-suffixed
packages (`expo-crypto`, `expo-notifications`, `expo-haptics`) publish on a fast rolling
cadence across the whole `expo/expo` monorepo — the SDK-56-aligned version is whatever
`npx expo install` resolves at execution time (SDK-56-line versions observed during
research: `expo-notifications@56.0.20`, `expo-crypto@56.0.4`, `expo-haptics@56.0.3` — do
not hand-pin the `expo-notifications@57.x`/`expo-haptics@57.x`/`expo-crypto@57.x` "latest"
tags surfaced by a bare `npm view <pkg> version`, those track SDK 57).

## Package Legitimacy Audit

| Package | Registry | Age (latest publish) | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----------------------|-----------|--------------|---------|-------------|
| @gorhom/bottom-sheet | npm | 2026-05-09 | ~2.18M/wk | github.com/gorhom/react-native-bottom-sheet | OK | Approved |
| zustand | npm | 2026-05-28 | ~41.9M/wk | github.com/pmndrs/zustand | OK | Approved (already project-standard per CLAUDE.md) |
| expo-notifications | npm | 2026-07-03 | ~3.19M/wk | github.com/expo/expo | SUS ("too-new") | Flagged — see note below |
| expo-haptics | npm | 2026-06-25 | ~3.43M/wk | github.com/expo/expo | SUS ("too-new") | Flagged — see note below |
| expo-crypto | npm | 2026-06-25 | ~2.69M/wk | github.com/expo/expo | SUS ("too-new") | Flagged — see note below |

**Packages removed due to [SLOP] verdict:** none.

**Packages flagged as suspicious [SUS]:** `expo-notifications`, `expo-haptics`, `expo-crypto`
— all three were flagged solely on the "too-new" publish-date heuristic. This is very likely
a **false positive specific to the Expo monorepo's release cadence**: Expo re-publishes every
`expo-*` package on nearly every SDK point release (weekly-ish), so `publishedAt` for the
`latest` dist-tag is almost always recent regardless of how long the package has actually
existed (all three have existed since early Expo SDK versions, have 2.5M+–3.4M weekly
downloads, no `postinstall` script, and point at the official `github.com/expo/expo` repo —
the same repo already relied on for `expo`, `expo-router`, `expo-constants`, etc. in the
existing `apps/mobile/package.json`). The planner should still add a lightweight
`checkpoint:human-verify` before first install (per protocol) but this is a low-risk,
almost-certainly-legitimate flag, not a slopsquat signal — treat it as a formality, not a
blocker.

*`@gorhom/bottom-sheet`, `expo-crypto`, `expo-notifications`, and `expo-haptics` were all
discovered via WebSearch/training knowledge, not an authoritative source lookup — tag as
`[ASSUMED]` per the package-name-provenance rule regardless of the OK/SUS verdicts above.*

## Architecture Patterns

### System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│  App Launch (apps/mobile/app/_layout.tsx)                            │
│  useMigrations() → seedExercises() → query user_profile row exists?  │
└───────────────────────────┬────────────────────────────────────────┘
                             │
              ┌──────────────┴───────────────┐
              │  Stack.Protected guard         │
              ▼                                ▼
   [no profile row]                  [profile row exists]
   app/onboarding/*  (wizard)        app/(tabs)/*  (Home | Log | Settings)
   D-01..D-05                                    │
   ├─ step screens (sex, BW, thr HR, thr pace)    │
   ├─ estimate paths (race-pace picker,           ▼
   │  max-HR / age fallback)              app/(tabs)/log/index.tsx
   └─ review screen → SAVE → INSERT       "Start workout" → creates
      user_profile row (drizzle)          `workout` row (expo-crypto
                                           UUID) → navigates to
                                           active-session screen
                                                    │
                                                    ▼
                              ┌───────────────────────────────────────┐
                              │ Active Session Screen (D-22)           │
                              │ zustand sessionStore (in-memory only)  │
                              │  ├─ "Add exercise" → bottom sheet      │
                              │  │   (@gorhom/bottom-sheet, D-10)      │
                              │  │   search-first, local filter over   │
                              │  │   seeded `exercise` rows            │
                              │  ├─ per-exercise card → set rows       │
                              │  │   (steppers, keypad, RPE row)       │
                              │  ├─ checkmark commits a set:           │
                              │  │   1. compute effective loadKg       │
                              │  │      (BW factor + added, D-15/17)   │
                              │  │   2. compute e1rmKg                 │
                              │  │      (Epley OR rep-max table, D-18) │
                              │  │   3. INSERT strength_set (drizzle)  │
                              │  │   4. engine.sessionHSSDetailed()    │
                              │  │      over all committed sets so far │
                              │  │   5. UPDATE workout.hss             │
                              │  │   6. start rest timer (endsAt)      │
                              │  │      → expo-notifications if bg     │
                              │  └─ sticky header: elapsed time +      │
                              │      live HSS (Reanimated count-up)    │
                              └───────────────────┬─────────────────────┘
                                                    │ Finish / Discard
                                                    ▼
                              ┌───────────────────────────────────────┐
                              │ Finish Summary (D-27)                  │
                              │  session HSS, per-exercise volume,     │
                              │  engine warnings[] list                │
                              │  Discard (menu+confirm) → soft delete  │
                              │  (workout.deletedAt, D-28) — every     │
                              │  load_daily/HSS query filters it out   │
                              └───────────────────┬─────────────────────┘
                                                    │
                                                    ▼
                                    Done → app/(tabs)/index.tsx
                                    (Home placeholder, D-31)

Crash/kill recovery (D-14): on next launch, root layout queries for a
`workout` row with no `finishedAt`/status='open' → auto-resume prompt
before rendering the tab shell.
```

### Recommended Project Structure

```
apps/mobile/
├── app/
│   ├── _layout.tsx                 # migrations + seed + profile-exists Stack.Protected gate
│   ├── onboarding/
│   │   ├── _layout.tsx             # wizard stack (no tab bar)
│   │   ├── sex.tsx                 # step screens — one input per screen (D-01)
│   │   ├── bodyweight.tsx
│   │   ├── threshold-hr.tsx        # direct entry OR estimate path (D-02)
│   │   ├── threshold-pace.tsx      # direct entry OR race-time picker (D-02)
│   │   └── review.tsx              # tap-to-edit review + Save (D-04) — reused by Settings
│   ├── (tabs)/
│   │   ├── _layout.tsx             # Home / Log / Settings native tabs (D-30)
│   │   ├── index.tsx               # Home placeholder (D-31)
│   │   ├── log/
│   │   │   ├── index.tsx           # "Start workout" entry
│   │   │   └── session.tsx         # active-session screen (D-22) — or a modal stack route
│   │   └── settings/
│   │       ├── index.tsx           # profile editor (reuses onboarding/review.tsx pattern), units, rest-timer default
│   ├── session/
│   │   └── finish.tsx              # finish summary (D-27), presented modally from log/session
│   └── modal.tsx                   # (existing template file — repurpose or remove)
├── components/
│   ├── session/
│   │   ├── ExercisePickerSheet.tsx # @gorhom/bottom-sheet, search-first (D-10)
│   │   ├── SetRow.tsx              # steppers + keypad + RPE segment control (D-06/D-08)
│   │   ├── RestTimerBanner.tsx     # persistent banner, +30s/skip (D-25)
│   │   └── HSSBreakdownSheet.tsx   # bottom sheet, per-exercise subtotal (D-24)
│   └── BootStates.tsx              # existing — extend for auto-resume prompt (D-14)
├── stores/
│   └── sessionStore.ts             # zustand — active session UI state, in-memory only
└── lib/
    ├── units.ts                   # km<->mi, kg<->lb display conversion (D-05, D-12)
    └── effectiveLoad.ts           # bodyweight*factor+added computation (D-15/D-17), calls into @apsis/engine estimators

packages/engine/src/
├── bodyweight.ts                  # NEW: estimateE1RMFromRepMaxTable (D-18)
├── carry.ts                       # NEW: carryStressDetailed / carryStress (D-20)
└── config.ts                      # extend EngineConfig: repMaxTable-related consts if needed, kCarry

packages/db/src/
└── schema.ts                      # extend: exercise.bwFactor, exercise.entryMode,
                                    #         workout.finishedAt (or status), workout.deletedAt
```

### Pattern 1: Onboarding gate via `Stack.Protected`

**What:** SDK 53+ declarative route protection — wrap the `(tabs)` group in a guard that
only renders once a `user_profile` row exists; unauthenticated/incomplete state falls back
to the onboarding stack.
**When to use:** Any mandatory, one-time gate that must block the entire app (D-01).
**Example:**
```tsx
// Source: pattern synthesized from docs.expo.dev/router/advanced/protected/ (web-verified, MEDIUM confidence)
// apps/mobile/app/_layout.tsx (extends existing migrations/seed boot sequence)
import { Stack } from 'expo-router';

export default function RootLayout() {
  const { success, error } = useMigrations(db, migrations);
  const hasProfile = useProfileExists(); // drizzle query, only runs after `success`

  if (error) return <ErrorScreen />;
  if (!success || hasProfile === 'loading') return <LoadingScreen />;

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Protected guard={!hasProfile}>
        <Stack.Screen name="onboarding" />
      </Stack.Protected>
      <Stack.Protected guard={hasProfile}>
        <Stack.Screen name="(tabs)" />
      </Stack.Protected>
    </Stack>
  );
}
```
**Note:** `[ASSUMED — synthesized from search snippets, not fetched from the live docs page
this session; verify exact `Stack.Protected` prop names against
docs.expo.dev/router/advanced/protected/ before implementation]`.

### Pattern 2: Per-set persist-then-recompute (D-13)

**What:** Every checked set triggers a synchronous write, then an engine recompute over the
full accumulated session, then a UI update — never the reverse order.
**When to use:** Any mutation that must both persist durably AND update the live HSS header.
**Example:**
```typescript
// Source: pattern derived from existing packages/engine/src/session.ts public API (HIGH confidence — first-party code)
async function commitSet(input: NewStrengthSet) {
  // 1. compute effective load + e1RM (pure, engine-adjacent helpers)
  const loadKg = computeEffectiveLoad(input, profile.bodyweightKg);
  const e1rmKg = input.exercise.bwFactor != null
    ? estimateE1RMFromRepMaxTable(loadKg, input.reps)   // D-18
    : estimateE1RM(loadKg, input.reps);                  // existing Epley (D-10)

  // 2. persist immediately (D-13) — op-sqlite JSI write is synchronous/cheap
  await db.insert(strengthSet).values({ id: randomUUID(), loadKg, e1rmKg, ...input });

  // 3. recompute session HSS over ALL committed sets so far (not incremental delta —
  //    keeps the engine the single source of truth for the formula)
  const allSets = await db.select().from(strengthSet).where(eq(strengthSet.workoutId, workoutId));
  const { hss, warnings } = sessionHSSDetailed({ strengthSets: allSets.map(toEngineSet) });

  // 4. persist the updated session HSS + surface warnings (D-29)
  await db.update(workout).set({ hss }).where(eq(workout.id, workoutId));
  sessionStore.setState({ liveHss: hss, warnings });
}
```

### Pattern 3: New engine module structure (D-18/D-20)

**What:** New engine functions must mirror `strengthStressDetailed`'s shape exactly:
clamp-and-warn every input via `clampRange`, never throw, return a `*Detailed` result plus
a bare-number facade, and take an optional `Partial<EngineConfig>` override.
**When to use:** `packages/engine/src/bodyweight.ts` (D-18) and `packages/engine/src/carry.ts` (D-20).
**Example:**
```typescript
// Source: pattern extracted from packages/engine/src/strength.ts (HIGH confidence — first-party code)
import { clampRange } from './clamp';
import { mergeConfig } from './config';

/** NSCA-style %1RM-by-reps table (D-18) — flat rows blow up at high reps instead of
 * dividing by a shrinking denominator like Brzycki. Extend/tune via a golden test. */
const REP_MAX_TABLE: ReadonlyArray<{ reps: number; pct: number }> = [
  { reps: 1, pct: 1.0 }, { reps: 2, pct: 0.95 }, { reps: 5, pct: 0.87 },
  { reps: 10, pct: 0.75 }, { reps: 15, pct: 0.65 }, { reps: 20, pct: 0.55 },
  { reps: 30, pct: 0.45 }, // floor — do not extrapolate below this row
];

export function estimateE1RMFromRepMaxTable(loadKg: number, reps: number): number {
  const repsClamp = clampRange(reps, 1, 30, 'reps'); // D-15 clamp-and-warn
  const pct = interpolateRepMaxPct(repsClamp.value); // linear interp between table rows
  return loadKg / pct;
}
```

### Anti-Patterns to Avoid

- **Persisting active-session state via zustand `persist` + AsyncStorage:** creates a second
  source of truth alongside the D-13 per-set SQLite writes. On crash, which one wins? Resume
  from the DB's open `workout` row only (D-14).
- **Importing from `@react-navigation/*` in any app-code file:** SDK 56's expo-router fork
  makes this a hard break, not a deprecation warning `[CITED: docs.expo.dev]`.
- **Using bare Epley for bodyweight movements with reps > ~12:** D-18 exists specifically
  because Epley (and Brzycki) both degrade in this range — always route BW-movement sets
  through the rep-max table, never the barbell estimator.
- **Recomputing session HSS incrementally (adding only the new set's delta):** re-run
  `sessionHSSDetailed` over the full accumulated set list every time — it's cheap (small N),
  keeps the engine as the single source of truth, and avoids float-drift from repeated
  partial sums.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Bottom sheet with search-first input + snap points | Custom `Modal` + `Animated` gesture logic | `@gorhom/bottom-sheet` v5 | Keyboard-avoidance, snap-point physics, and backdrop gesture handling are notoriously fiddly to get right on iOS; v5 is Reanimated-4-native |
| Local notification scheduling/permission state machine | Custom `setTimeout` + manual permission-dialog tracking | `expo-notifications` | iOS permission dialogs are one-shot (no re-prompt) and background timer firing requires a real OS-level notification, not JS `setTimeout` (JS timers don't fire when the app is backgrounded/killed) |
| UUID generation | Home-grown random-string generator | `expo-crypto`'s `randomUUID()` | Hermes lacks Web Crypto; a hand-rolled generator risks collision-prone weak randomness for primary keys |
| Swipe-to-delete list row | Custom `PanResponder` + threshold math | `react-native-gesture-handler`'s `Swipeable` (already a transitive dep) | Standard iOS swipe-left→Delete gesture physics are a solved, tested problem |
| %1RM-by-reps estimation for high-rep sets | A single extrapolated formula (Brzycki/Epley) pushed past its valid range | A rep-max **table** with interpolation + a floor | Both closed-form formulas are documented to diverge above ~10-12 reps; a table with capped rows avoids the "confidently wrong" failure mode of an extrapolated formula |

**Key insight:** Everything in this phase that touches native OS behavior (notifications,
haptics, gestures, crypto) has a well-trodden Expo-ecosystem module; the only genuinely novel
code is the two new engine formulas (D-18, D-20), and those must follow the *existing*
in-repo pattern (clamp-and-warn, Detailed+facade) rather than invent a new style.

## Common Pitfalls

### Pitfall 1: `@react-navigation/*` imports silently breaking at SDK 56
**What goes wrong:** Any accidental `import { useNavigation } from '@react-navigation/native'`
(common muscle memory, or copy-pasted from an older tutorial/StackOverflow answer) fails or
behaves inconsistently under the SDK 56 expo-router fork.
**Why it happens:** expo-router used to re-export React Navigation primitives; SDK 56 forked
away from that.
**How to avoid:** Import navigation primitives (`useRouter`, `Stack`, `Tabs`, `Link`,
`Redirect`) exclusively from `expo-router`.
**Warning signs:** TypeScript resolves the import fine (package still in `node_modules` as a
transitive dep) but runtime navigation behavior is subtly wrong.

### Pitfall 2: JS `setTimeout`-based rest timer dies when backgrounded
**What goes wrong:** A rest timer implemented as `setTimeout(..., 120000)` simply doesn't
fire if the user locks the phone or switches apps — the countdown silently stops.
**Why it happens:** RN JS timers are throttled/suspended when the JS thread isn't active in
the foreground.
**How to avoid:** Per D-26, the timer state is timestamp-based (`endsAt = Date.now() + ms`)
so the UI recomputes remaining time from a wall-clock diff on every render/foreground event,
AND a real `expo-notifications` local notification is scheduled for `endsAt` so the OS (not
the JS thread) delivers the completion signal when backgrounded.
**Warning signs:** Timer "looks right" in the simulator with the app foregrounded but never
fires after backgrounding on a real device.

### Pitfall 3: Extrapolating Brzycki/Epley past their valid rep range
**What goes wrong:** A 25-rep bodyweight push-up set fed into Epley or Brzycki produces a
wildly inflated (Epley) or negative/undefined (Brzycki, denominator `37-reps` goes negative
past 37 reps, and is already unreliable well before that) e1RM, silently poisoning the
strength-stress calculation.
**Why it happens:** Both formulas were derived from barbell-lift data in the 1-10 rep range;
neither models the endurance-dominant physiology of high-rep bodyweight sets.
**How to avoid:** D-18's rep-max table with a hard floor row (e.g. 30 reps) and
clamp-and-warn on out-of-table reps, exactly like the existing `MAX_REPS` guard in
`strength.ts`.
**Warning signs:** e1RM values for high-rep bodyweight exercises look implausibly high
compared to a lifter's known barbell 1RMs.

### Pitfall 4: SQLite migration silently no-ops with the wrong drizzle-kit driver
**What goes wrong:** Adding `bwFactor`/`entryMode`/`deletedAt` columns via drizzle-kit with
the wrong `driver` setting in `drizzle.config.ts` produces migration files that "run" but
leave the on-device DB unchanged.
**Why it happens:** Already documented in `packages/db/drizzle.config.ts`'s own comment
block as "RESEARCH Pitfall 5" from Phase 01 — the `driver: 'expo'` setting is load-bearing.
**How to avoid:** The config is already correct; just don't change `driver` when adding this
phase's migration. Regenerate via `npx drizzle-kit generate` from `packages/db`, verify the
new numbered `.sql` file's contents before committing.
**Warning signs:** `useMigrations()` reports `success: true` but querying the new column
throws "no such column."

### Pitfall 5: Treating `entryMode`/`bwFactor` as meaningful for `type: 'endurance'` seeded exercises
**What goes wrong:** Assigning a `bwFactor` or `entryMode` value to `run`/`ski-erg`/
`rowing-erg`/`assault-bike` (seeded as `type: 'endurance'`) implies they'll be logged as
`strength_set` rows, but Phase 3 only builds the lifting logger — endurance logging is
Phase 4 (`RUN-*`).
**Why it happens:** The `bwFactor`/`entryMode` columns live on the shared `exercise` table,
so every row technically has the fields even when irrelevant.
**How to avoid:** Leave `bwFactor: null` and `entryMode: null` (or a neutral default) on all
`type: 'endurance'` seed rows this phase; they're simply not exercised by any Phase 3 code
path.
**Warning signs:** None functionally — this is a data-hygiene note so a future engineer
doesn't misread a stray value as intentional.

## Code Examples

### Effective-load computation for a bodyweight movement (D-15/D-16/D-17)
```typescript
// Source: derived from CONTEXT.md D-15/D-16/D-17 — app-layer helper, NOT inside packages/engine
// (the engine only receives the final loadKg; it has no knowledge of bodyweight or factors)
function computeEffectiveLoad(
  exercise: { bwFactor: number | null },
  addedKg: number,
  profileBodyweightKg: number
): number {
  if (exercise.bwFactor == null) return addedKg; // ordinary barbell/implement lift
  // D-16: snapshot bodyweight AT LOG TIME — never recompute historical sets when
  // profile bodyweight later changes (consistent with D-05 edits-apply-forward)
  return profileBodyweightKg * exercise.bwFactor + addedKg;
}
```

### Imperial stepper round-trip (D-12)
```typescript
// Source: derived from CONTEXT.md D-12 — must round-trip exactly, no 224.9 kg artifacts
const LB_PER_KG = 2.2046226218;

function lbToKgExact(lb: number): number {
  return lb / LB_PER_KG; // e.g. 225 lb -> 102.058... kg, stored as-is
}

function kgToDisplayLb(kg: number): number {
  return Math.round(kg * LB_PER_KG); // display rounds to whole lb; storage stays exact kg
}
// Stepper increments the DISPLAYED lb value by 5, then re-derives kg via lbToKgExact —
// never increments the stored kg value directly, which is what causes 224.9 drift.
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|---------------|--------|
| `@react-navigation/*` imported directly in Expo apps | `expo-router` file-based routing only | SDK 56 (2026) | Any tutorial/StackOverflow snippet referencing `@react-navigation` imports needs translation to expo-router equivalents |
| Manual `Redirect`-based auth/onboarding gates | `Stack.Protected` guard components | SDK 53+ | Cleaner, more declarative; still functionally equivalent to a manual redirect if unavailable/misbehaving |
| `@gorhom/bottom-sheet` v4 and earlier (Reanimated 3-only) | v5 (Reanimated 4 + New Architecture native support) | ~2026 | Must pin v5, not just "latest major that happened to work last year" |

**Deprecated/outdated:**
- Epley-only e1RM for all exercise types: still correct for barbell lifts (D-10, unchanged),
  but insufficient for the bodyweight-movement rep ranges this phase introduces (D-18).

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `Stack.Protected` prop/API shape as shown in Pattern 1 | Architecture Patterns | Minor — expo-router docs should be re-checked at implementation time; wrong prop names are a quick compile-time fix, not a design-level risk |
| A2 | `expo-crypto`, `expo-notifications`, `expo-haptics`, `@gorhom/bottom-sheet` package names/versions | Standard Stack, Package Legitimacy Audit | Low — all four are corroborated by npm registry lookups (existence, download counts, official repos) but were discovered via WebSearch/training knowledge, not an authoritative docs source this session |
| A3 | Bodyweight factors for lunge/split-squat/step-up/goblet-squat (~0.85×BW+load) and the entire implement-movement category (wall-ball, kb-swing, sandbag-lunge) | Don't Hand-Roll / bodyweight table below | Medium — these are coaching-consensus estimates, not measured (no force-plate study found for these movements specifically); if badly wrong, strength-stress for these exercises will be mis-scaled relative to barbell lifts, undermining the "one honest number" thesis for HYROX-heavy users |
| A4 | Core isometric-hold movements (plank, ab-wheel, hanging-leg-raise) have **no** confidently-sourced bwFactor | Open Questions | Medium — recommend `bwFactor: null` (excluded from the effective-load model, logged as plain reps/hold with only added weight counted) rather than fabricating a number for these three |
| A5 | Carry/sled stress formula shape (`durationMin * (RPE/10)^2 * kCarry * loadRatioMultiplier`) and its constant `kCarry` | Common Pitfalls / Code Examples region, D-20 | Medium — no published formula combines these three inputs for loaded carries; the shape is an engine-consistent extrapolation from Foster's session-RPE and the existing IF² endurance shape, not a cited external source. D-20 already requires a golden test to pin the constant — treat that test's result as authoritative over this research's suggested shape if they conflict |
| A6 | Race-pace-to-threshold-pace conversion offsets (5K pace ×~1.03-1.05, 10K pace ×~1.01-1.02, half-marathon pace ×~1.0) | Code Examples / Common Pitfalls (threshold HR/pace section) | Low — coaching heuristics (Pfitzinger), not a single peer-reviewed formula; D-03's soft-validation (never block save) already absorbs the risk of an imprecise estimate |
| A7 | SQLite `ALTER TABLE ADD COLUMN` works without table recreation for this phase's new columns | Common Pitfalls (Pitfall 4), Code Examples | Low — standard SQLite behavior for nullable columns without a non-constant default; drizzle-kit already handles the fallback-to-recreation case automatically if this assumption is wrong |

**If this table is empty:** N/A — see entries above; several require confirmation before
being treated as locked decisions, particularly A3/A4 (bodyweight factors for the full
seeded-exercise list) and A5 (carry-stress formula).

## Open Questions (RESOLVED)

> Both questions below are operationally resolved by the phase plans:
> - **Q1 (RESOLVED)** — 03-02 Task 1 adopts the full proposed bwFactor/entryMode table verbatim as the seed-data source of truth. Treat the "Proposed full bwFactor / entryMode table" below as the locked table for this phase.
> - **Q2 (RESOLVED)** — 03-04 Task 1 handles the `Stack.Protected` onboarding gate with the documented `<Redirect>` fallback if the API shape differs from Pattern 1.

1. **What `bwFactor`/`entryMode` values apply to every seeded BW/implement/carry exercise, not just the four D-15 examples?** *(RESOLVED — adopted in 03-02 Task 1.)*
   - What we know: pull-up ≈0.95, dip ≈0.95, push-up ≈0.65 (Suprak-supported), lunge ≈0.85
     (coaching-consensus starting point per CONTEXT.md).
   - What's unclear: chin-up, split-squat, goblet-squat, step-up, box-jump, box-step-over,
     burpee-broad-jump, wall-ball, kb-swing, sandbag-lunge, thruster, atlas-stone, and the
     three core isometric movements (plank, ab-wheel, hanging-leg-raise) have no
     research-grounded factor found this session.
   - Recommendation: use the proposed full table below as a starting point (chin-up = same
     as pull-up ≈0.95; box-jump/box-step-over/burpee-broad-jump ≈1.0, full bodyweight
     translated, tag confidence LOW; wall-ball/kb-swing/sandbag-lunge/thruster treated as
     implement movements per D-17 with bwFactor ≈0.85-1.0 depending on movement pattern,
     LOW confidence; atlas-stone treated as a standard loaded lift, `bwFactor: null`;
     plank/ab-wheel/hanging-leg-raise → `bwFactor: null`, logged as bodyweight-only reps/
     hold with no effective-load contribution beyond any added weight) — planner/discuss-phase
     should confirm this table with the user before it's locked, since D-15 explicitly asked
     the researcher to "verify/complete the table."

**Proposed full bwFactor / entryMode table** (LOW-MEDIUM confidence — see Assumptions A3/A4):

| Exercise id | bwFactor | entryMode | Basis |
|---|---|---|---|
| pull-up | 0.95 | reps | Dempster segment tables (hand+forearm ≈5% BW excluded) — MEDIUM |
| chin-up | 0.95 | reps | Same biomechanics as pull-up — MEDIUM |
| dip | 0.95 | reps | Same biomechanics as pull-up (hands/wrists fixed) — MEDIUM |
| push-up | 0.65 | reps | Suprak et al. 2011 force-plate study (horizontal) — MEDIUM |
| lunge | 0.85 | reps | Coaching-consensus single-leg-support estimate — LOW |
| split-squat | 0.85 | reps | Same as lunge — LOW |
| step-up | 0.90 | reps | Near-full BW translated through one leg — LOW |
| goblet-squat | null | reps | Two-leg squat; convention is load=held weight only, like back squat — MEDIUM (matches existing barbell-lift convention) |
| box-jump | 1.0 | reps | Full BW translated vertically (ballistic, not force-plate-verified) — LOW |
| box-step-over | 0.90 | reps | Similar to step-up — LOW |
| burpee-broad-jump | 1.0 | reps | Full BW moved — LOW |
| wall-ball | 0.30 | reps | Implement movement (D-17): BW factor covers squat-drive contribution, ball weight is "added" — LOW |
| kb-swing | 0.30 | reps | Implement movement; hip-hinge BW contribution + kettlebell as "added" — LOW |
| sandbag-lunge | 0.85 | reps | Lunge pattern + sandbag as "added" — LOW |
| thruster | null | reps | Standard barbell/DB lift convention (like squat/press) — LOW, flag for user confirmation |
| atlas-stone | null | reps | Standard loaded-lift convention — LOW |
| farmers-carry | null | timed | Uses D-20 carry-stress path instead of bwFactor |
| yoke-carry | null | timed | Uses D-20 carry-stress path instead of bwFactor |
| sled-push | null | timed | Uses D-20 carry-stress path instead of bwFactor |
| sled-pull | null | timed | Uses D-20 carry-stress path instead of bwFactor |
| battle-rope | null | timed | Timed conditioning effort; no clean %BW convention found — LOW |
| plank | null | timed | Isometric hold; no confident %BW value found — flagged, see A4 |
| ab-wheel | null | reps | Long-lever core movement; no confident %BW value found — flagged, see A4 |
| hanging-leg-raise | null | reps | Core movement; no confident %BW value found — flagged, see A4 |
| all barbell/machine lifts (squat, deadlift, bench, ohp, row, etc.) | null | reps | Unchanged — standard Epley/loadKg convention (D-10, Phase 02) |
| run, ski-erg, rowing-erg, assault-bike | null | null | `type: 'endurance'` — not logged via `strength_set` this phase (Pitfall 5) |

2. **Does `Stack.Protected` exist and behave as described in the current SDK 56 expo-router version installed (`~56.2.11`)?** *(RESOLVED — 03-04 Task 1 implements the gate with a documented `<Redirect>` fallback.)*
   - What we know: SDK 53+ shipped `Stack.Protected`; multiple 2026 sources describe it as
     the current recommended pattern.
   - What's unclear: exact prop name/behavior wasn't verified against the live docs page
     this session (no MCP docs tool was available; only WebSearch summaries).
   - Recommendation: the planner's first onboarding-gate task should include a quick doc
     check (`docs.expo.dev/router/advanced/protected/`) before finalizing the gate
     implementation; fall back to a manual `<Redirect>` in a nested layout if `Stack.Protected`
     doesn't behave as expected — both are described in the same source material as valid.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js / npm registry access | Verifying package versions during planning/execution | ✓ | — (verified via `npm view` this session) | — |
| pnpm workspace tooling | Installing new deps into `apps/mobile` | ✓ (already used in Phase 01/02) | pnpm@9.15.9 | — |
| Physical iOS device or simulator with dev build | Testing rest-timer background notifications (D-26), haptics (expo-haptics doesn't fire on simulator for haptics) | Unknown — not probed this session (no device/simulator access from this research environment) | — | Manual on-device UAT step required; flag as a `checkpoint:human-verify` before considering LIFT-05/D-26 done |
| Expo Go | N/A | ✗ (intentionally — project uses dev builds per CLAUDE.md) | — | `npx expo run:ios` / EAS dev build (already established in Phase 01) |

**Missing dependencies with no fallback:** none — physical-device testing for notifications/
haptics has a documented manual fallback (human verification checkpoint), not a hard block.

**Missing dependencies with fallback:** physical iOS device for background-notification and
haptics testing — falls back to a human-verify checkpoint in the plan.

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | vitest 4.1.9 (already configured in `packages/engine` and `packages/db`) |
| Config file | `packages/engine/vitest.config.mts`, `packages/db/vitest.config.mts` — no config exists yet for `apps/mobile` |
| Quick run command | `pnpm --filter @apsis/engine test` / `pnpm --filter @apsis/db test` |
| Full suite command | `pnpm -r test` (all workspace packages) |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|--------------------|-------------|
| ONB-01 | Onboarding captures sex/BW/threshold HR/threshold pace | manual-only (UI flow, no vitest coverage planned) | — | N/A — UAT via `/gsd-verify-work` |
| ONB-02 | Profile viewable/editable from Settings | manual-only | — | N/A |
| ONB-03 | Readiness band gated behind onboarding (structurally: readiness never shown this phase) | manual-only + code inspection | — | N/A |
| ONB-04 | Units toggle km↔mi, storage stays metric | unit | `vitest run lib/units.test.ts` (new file, `apps/mobile` or a shared util package) | ❌ Wave 0 |
| LIFT-01 | Exercise search < 2 taps | manual-only | — | N/A |
| LIFT-02 | Log a set in ≤3 taps (load/reps/RPE/warmup) | manual-only (UX speed is a UAT criterion, not unit-testable) | — | N/A |
| LIFT-03 | Set pre-populates from previous session | integration (drizzle query logic) | `vitest run packages/db/src/__tests__/previous-session-query.test.ts` (new) | ❌ Wave 0 |
| LIFT-04 | RPE quick-row, last-value pre-selected, never modal | manual-only (UI structure) | — | N/A |
| LIFT-05 | Auto-rest timer, configurable, persistent banner | manual-only (timer/background behavior needs a real device) | — | N/A — flag `checkpoint:human-verify` |
| LIFT-06 | Add/remove sets inline | manual-only | — | N/A |
| LIFT-07 | Save or discard (confirmed); session HSS on finish | integration (soft-delete query filtering) | `vitest run packages/db/src/__tests__/soft-delete.test.ts` (new) | ❌ Wave 0 |
| LIFT-08 | Live HSS updates per set | unit (the recompute call itself, not the UI animation) | `vitest run packages/engine/src/__tests__/session.test.ts` (existing — already covers `sessionHSSDetailed`) | ✅ |
| (new) D-18 rep-max-table e1RM estimator | pure function correctness (table lookup, interpolation, clamp-and-warn) | unit | `vitest run packages/engine/src/__tests__/bodyweight.test.ts` (new) | ❌ Wave 0 |
| (new) D-20 carry/sled stress formula | pure function + calibration golden test | unit | `vitest run packages/engine/src/__tests__/carry.test.ts` (new) | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `pnpm --filter @apsis/engine test` and/or `pnpm --filter @apsis/db test` (whichever package the task touched)
- **Per wave merge:** `pnpm -r test` (full workspace)
- **Phase gate:** Full suite green before `/gsd-verify-work`; UI/UX flows (marked manual-only
  above) are verified via `/gsd-verify-work` conversational UAT, not vitest — this matches
  BUILD.md §3's "focus test budget on the engine package, not UI" guidance and the phase's
  hard timeline constraint.

### Wave 0 Gaps
- [ ] `packages/engine/src/__tests__/bodyweight.test.ts` — covers D-18 (rep-max table estimator: table-row values, interpolation, out-of-range clamp+warning)
- [ ] `packages/engine/src/__tests__/carry.test.ts` — covers D-20 (carry/sled stress + the required calibration golden test: "4×40m heavy farmer's carry ≈ a hard accessory block, well under the ~100 HSS threshold-run anchor")
- [ ] `packages/db/src/__tests__/previous-session-query.test.ts` — covers LIFT-03 (query for an exercise's most recent prior set)
- [ ] `packages/db/src/__tests__/soft-delete.test.ts` — covers LIFT-07/D-28 (discard sets `deletedAt`; every load/HSS query excludes soft-deleted workouts)
- [ ] No `apps/mobile` test framework exists yet (no vitest/jest config, no `@testing-library/react-native` installed). Per BUILD.md §3 this is intentional for a 4-week timeline — UI flows rely on manual UAT via `/gsd-verify-work` rather than component tests. If the planner wants component-level coverage for the wizard/session screens, `@testing-library/react-native@14.0.1` would need to be installed and configured as a new Wave 0 task — treat as optional/discretionary, not a gap blocking this phase.

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-------------------|
| V2 Authentication | No | Single-user, fully offline, no auth in v1.0 (per BUILD.md) |
| V3 Session Management | No | No server sessions; "session" in this phase means a workout session, not an auth session |
| V4 Access Control | No | Single local user, no multi-tenant boundary |
| V5 Input Validation | Yes | Soft-validation pattern already established: `clampRange` in `packages/engine` (D-15 clamp-and-warn) for engine inputs; onboarding form inputs use the same "accept any numeric input, warn outside plausible range, never block save" pattern (D-03) at the UI layer — no new library needed, this is hand-rolled per BUILD.md §3's "plain RN components" guidance |
| V6 Cryptography | Partial | No cryptographic secrets in this phase; UUID generation (`expo-crypto`'s `randomUUID`) uses a CSPRNG-backed native implementation rather than a hand-rolled PRNG — sufficient for non-security-critical local primary keys, do not use `Math.random()`-based ID generation |
| V7 Error Handling / Logging | Yes (continuation of Phase 01 pattern) | Existing `_layout.tsx` pattern: raw errors `console.error`'d for developer diagnostics only, generic string shown to the user (already established, T-1-02 equivalent) — extend the same pattern to any new error paths this phase introduces (migration failures for the new columns, notification-permission-denied states) |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|----------------------|
| SQL injection via raw string interpolation | Tampering | Already mitigated project-wide: drizzle parameterized query builders only (T-1-01, established Phase 01) — this phase's new queries (previous-session lookup, soft-delete filtering) must follow the same discipline |
| Weak ID generation for primary keys | Tampering / Spoofing (low severity, local-only DB) | `expo-crypto`'s native `randomUUID()` (CSPRNG-backed) instead of `Math.random()`-based ID generation, which is predictable |
| Sensitive data (HealthKit-derived bodyweight, HR) leaking into crash/analytics reports | Information Disclosure | Out of scope for this phase (REL-03 covers this in Phase 06) but worth noting: bodyweight/threshold values captured in onboarding this phase are exactly the kind of data REL-03's later scrubbing rule will need to cover — don't log raw profile values to any future crash reporter integration |
| Notification permission denial silently breaking the rest-timer UX | (not a security threat, but a robustness gap) | D-26 already specifies: request permission on first timer use (not onboarding), and the timer's core countdown (timestamp-based `endsAt`) must work correctly even if the user denies notification permission — the notification is a nice-to-have completion signal, not the source of truth for the countdown |

## Sources

### Primary (HIGH confidence)
- `packages/engine/src/*.ts` (existing first-party code) — exact patterns for `clampRange`, `Detailed`+facade functions, `mergeConfig`, engine barrel structure
- `packages/db/src/schema.ts`, `packages/db/drizzle.config.ts` (existing first-party code) — current six-table schema, migration driver config, prior "RESEARCH Pitfall 5" note
- `BUILD.md` §3–§6 (project-authoritative spec) — approved dependencies, data model, phased plan
- `.planning/phases/03-onboarding-lifting-logger/03-CONTEXT.md` — all D-01..D-32 locked decisions

### Secondary (MEDIUM confidence — WebSearch cross-checked with multiple corroborating results)
- Expo Router v56 fork from React Navigation, `Stack.Protected` gating pattern — [expo.dev/blog/expo-router-v56-decoupling-from-react-navigation](https://expo.dev/blog/expo-router-v56-decoupling-from-react-navigation), [docs.expo.dev/router/advanced/protected/](https://docs.expo.dev/router/advanced/protected/)
- expo-notifications permission/scheduling behavior — [docs.expo.dev/versions/latest/sdk/notifications/](https://docs.expo.dev/versions/latest/sdk/notifications/)
- `@gorhom/bottom-sheet` v5 Reanimated-4/New-Architecture support — [github.com/gorhom/react-native-bottom-sheet](https://github.com/gorhom/react-native-bottom-sheet), [github.com/gorhom/react-native-bottom-sheet/issues/2592](https://github.com/gorhom/react-native-bottom-sheet/issues/2592)
- Zustand 5 RN best practices (no persist for DB-backed state) — [zustand.docs.pmnd.rs/reference/integrations/persisting-store-data](https://zustand.docs.pmnd.rs/reference/integrations/persisting-store-data)
- Hermes lacks Web Crypto; `expo-crypto` as the fix — [docs.expo.dev/versions/latest/sdk/crypto/](https://docs.expo.dev/versions/latest/sdk/crypto/)
- Suprak et al. 2011 push-up %BW force-plate study — [researchgate.net/publication/41548700](https://www.researchgate.net/publication/41548700_The_Effect_of_Position_on_the_Percentage_of_Body_Mass_Supported_During_Traditional_and_Modified_Push-up_Variants)
- Dempster/Chaffin body-segment-mass tables — [semanticscholar.org/paper/Properties-of-body-segments...](https://www.semanticscholar.org/paper/Properties-of-body-segments-based-on-size-and-Dempster-Gaughran/049a8d6ca75a7507acc0c71cf2d2d2762bce3f60)
- Brzycki formula rep-range accuracy limits — [arvo.guru/resources/one-rep-max-formulas](https://arvo.guru/resources/one-rep-max-formulas), [betterlifefitness.net/tools/strength/brzycki-equation-calculator](https://betterlifefitness.net/tools/strength/brzycki-equation-calculator)
- Riegel formula + Pfitzinger threshold-pace heuristics — [runaerix.com/resources/wiki/riegels-formula](https://runaerix.com/resources/wiki/riegels-formula), [runnerscalc.com/pages/lactate-threshold-calculator](https://www.runnerscalc.com/pages/lactate-threshold-calculator)
- Lactate threshold HR as %maxHR — [runnersconnect.net/how-to-calculate-your-lactate-threshold/](https://runnersconnect.net/how-to-calculate-your-lactate-threshold/)
- Foster session-RPE training-load method — [frontiersin.org/journals/neuroscience/articles/10.3389/fnins.2017.00612/full](https://www.frontiersin.org/journals/neuroscience/articles/10.3389/fnins.2017.00612/full)
- Drizzle-kit generate/migrate workflow — [orm.drizzle.team/docs/migrations](https://orm.drizzle.team/docs/migrations), [orm.drizzle.team/docs/drizzle-kit-generate](https://orm.drizzle.team/docs/drizzle-kit-generate)
- expo-haptics API methods — [docs.expo.dev/versions/latest/sdk/haptics/](https://docs.expo.dev/versions/latest/sdk/haptics/)

### Tertiary (LOW confidence — single-source or extrapolated, flagged in Assumptions Log)
- Carry/sled RPE-scaled duration stress formula shape and calibration example (no direct external source — A5)
- Bodyweight factors for lunge/split-squat/step-up/goblet-squat and implement movements (coaching-consensus, not force-plate-verified — A3)
- Core isometric-hold movements (plank/ab-wheel/hanging-leg-raise) explicitly flagged as unresolved (A4)
- Reanimated count-up animation pattern (synthesized from general search results, not a single canonical source)

## Metadata

**Confidence breakdown:**
- Standard stack (navigation, state, notifications, haptics, bottom sheet): MEDIUM — WebSearch cross-checked, but no context7/official-docs MCP tool was available this session to reach HIGH
- Architecture (onboarding gate, session flow, per-set persist pattern): MEDIUM-HIGH — session/persist pattern is directly derived from existing first-party engine/db code (HIGH); the `Stack.Protected` gate specifics are MEDIUM (web-only verification)
- Bodyweight-movement biomechanics factors: MEDIUM for pull-up/dip/push-up (literature-supported), LOW for the remaining ~15 seeded BW/implement movements (coaching-consensus only) — see Open Questions table
- Rep-max table design (D-18): MEDIUM — Brzycki/Epley degradation is well-documented; the specific table row values proposed are a reasonable NSCA-style starting point but not verbatim from a single cited table
- Carry/sled stress formula (D-20): LOW — no external formula exists combining these inputs; shape is an engine-consistent extrapolation, constant `k` explicitly deferred to a golden test per D-20
- Pitfalls: MEDIUM-HIGH — several are already-documented first-party lessons from Phase 01/02 (drizzle driver, engine clamp pattern); the RN-specific ones (backgrounded timers, navigation import breakage) are web-corroborated

**Research date:** 2026-07-09
**Valid until:** ~2026-08-08 (30 days) for stable findings (schema/engine patterns, biomechanics
literature); ~2026-07-16 (7 days) for fast-moving Expo-ecosystem package version numbers
(`expo-notifications`/`expo-haptics`/`expo-crypto` SDK-56-line patch versions) — always
re-verify with `npx expo install` at implementation time rather than trusting the pinned
versions above.
