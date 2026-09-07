# Phase 4: Run Logger & Home Dashboard - Research

**Researched:** 2026-07-10
**Domain:** React Native (Expo SDK 56) run/conditioning logger + reactive load-trend dashboard, consuming an existing pure-TS HSS engine
**Confidence:** MEDIUM-HIGH (stack facts VERIFIED against installed packages/registry; one architectural gap discovered that CONTEXT.md did not anticipate — see Summary)

## Summary

Phase 4 has two halves: a fast single-screen run/erg/conditioning logger (RUN-01..06) and a
reactive Home dashboard (HOME-01..06) built on `victory-native` + `react-native-svg`. The
engine math (strength/endurance/session/daily/trend) is fully built and tested from Phase 2 —
Phase 4 is a consumer of `sessionHSSDetailed`, `dailyHSS`, `computeLoadTrendSeries`, and
`readinessBand`, exactly as CONTEXT.md's canonical_refs describe.

**Critical finding not surfaced in CONTEXT.md:** `load_daily` is never written anywhere in the
current codebase (`git grep`-verified: zero writes across `apps/mobile`). Phase 3's
`lib/finishWorkout.ts` only sets `workout.finishedAt` — it never touches `load_daily`. This
means the "write → recompute → UI reactive chain proven end-to-end via the lifting logger"
claim in CONTEXT.md's code_context is true only for `workout.hss` (per-session), **not** for
the day/trend rollup Home depends on. Phase 4 must build the *entire* `load_daily` recompute
pipeline from scratch, AND retrofit it into the existing lifting finish flow — otherwise Home's
ATL/CTL/TSB and readiness band would only ever reflect runs, never lifts, silently breaking the
phase's Core Value ("one honest combined training-load number"). This is the single highest-risk
item for planning and should be its own early wave/plan, not a footnote inside the run-entry plan.

A second load-bearing engine detail: `computeLoadTrendSeries(dailyHSSByDay)` always starts
folding from `atl=0, ctl=0` at index 0 of whatever array you pass it — there is no "resume from
stored state" API. The only correct v1.0 pattern is a **full-history recompute**: build one
contiguous (gap-filled) array of daily HSS values from the athlete's first-ever finished session
through today, run `computeLoadTrendSeries` once, and upsert every resulting row into
`load_daily`. Do this after every workout write that changes historical rollups (run save, lift
finish, session delete).

**Primary recommendation:** Build a single shared `recomputeLoadDaily(db)` pipeline (packages/db
or apps/mobile/lib) used by both the run-save flow and a retrofitted lifting finish flow, install
`victory-native` + `@shopify/react-native-skia` + `react-native-svg` +
`@react-native-community/datetimepicker` per the verified versions below, and add one drizzle
migration for `workout.note`.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Run/erg/conditioning entry form (RUN-01..06) | Client (RN screen + local component state) | Database/Storage (SQLite insert on save) | Single-screen, no server; local validation only |
| Live pace calculation (RUN-02) | Client | — | Pure arithmetic on in-memory field state, no persistence needed until save |
| Session HSS computation | Database/Storage-adjacent pure engine (`packages/engine`, called from the client's save handler) | — | Engine is pure TS with no I/O; the client calls it synchronously after reading/writing SQLite |
| Day/trend rollup (ATL/CTL/TSB/band) | Database/Storage (`load_daily` table) + pure engine (`computeLoadTrendSeries`) | Client (renders the persisted result) | Trend state must be durable and queryable across app restarts, not recomputed ad hoc in a component |
| Home dashboard render (ring, stat tiles, chart) | Client | Database/Storage (read-only queries) | Pure presentation over persisted `load_daily`/`workout` rows |
| History ledger + pagination | Client (list/accordion UI) | Database/Storage (paginated day-grouped queries) | Read-heavy, no engine computation needed at render time (values already in `load_daily`/`workout`) |
| Soft-delete + recompute (D-29) | Database/Storage (soft-delete write) triggers Client-invoked pure-engine recompute | — | Mirrors Phase 3's `discardWorkout` pattern exactly |

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01 (Hybrid direction):** Home gets DESIGN-SYSTEM.md's signature hero — the 200px
  volt HSS ring with count-up + readiness status light — while forms, rows, and history
  use Phase 3's approved ledger language (tabular, mono captions, tap-to-type inset
  fields). Palette remains binding everywhere.
- **D-02 (Readiness presentation):** Status light under the ring — pulsing dot + mono
  label: PRIMED · GREEN LIGHT (volt) / CAUTION · HOLD STEADY (amber) / OVERREACHING ·
  RED ZONE (molten). During the 14-day calibrating period the ring renders in steel with
  a "BUILDING TREND · DAY N/14" mono label instead of a band.
- **D-03 (Run form styling):** Ledger fields — inset steel tap-to-type fields, mono
  uppercase captions (DISTANCE · DURATION · AVG HR), mono tabular values. Same language
  as the approved set rows.
- **D-04 (Finish-screen mini-ring):** Both run AND lift finish screens get the 84px
  session-HSS mini-ring with count-up, tying the finish moment to the home hero.
- **D-05 (Ring animation policy):** Animate fill + count-up once per day (first Home view
  of the day, or when today's HSS changes); instant render on repeat visits.
- **D-06 (Daily empty state):** Before any session today, the ring renders at 0 with the
  readiness light still live (readiness comes from history), plus a quiet "LET'S WORK"
  prompt and ghost Start Workout / Log Run shortcuts. Readiness never hides (outside
  calibration).
- **D-07 (Tab structure):** 4 tabs — TODAY · LOG · HISTORY · SETTINGS. Home renames to
  TODAY with the plate glyph icon; LOG keeps the volt +; HISTORY gets a ledger/calendar
  glyph; SETTINGS keeps the gear. Mono uppercase labels, volt active / ash inactive
  (existing conventions).
- **D-08 (Plate-orbit mark):** Animated plate orbit — the tilted plate ellipses in slow
  continuous orbit, NO runner glyph (user-directed deviation from DESIGN-SYSTEM.md §4).
  Lives in the calibrating state where the readiness light will eventually appear.
- **D-09 (One-volt discipline):** The ring + its number own volt above the fold. The
  readiness light uses its semantic state color (volt only when PRIMED). Chart lines
  stay off volt (bone/ash); buttons on home go ghost.
- **D-10 (Single screen):** One ledger card: activity segment (RUN · ERG · CONDITIONING)
  up top, DISTANCE · DURATION · AVG HR fields, live pace readout, date + note tucked
  below, volt Save. No steps, no wizard.
- **D-11 (Duration entry):** Smart digit entry — one mono field, numeric keypad, digits
  fill right-to-left as h:mm:ss (typing 4530 → 45:30; 13000 → 1:30:00).
- **D-12 (Live pace readout):** A live mono readout row under the fields — "PACE 5:30
  /KM" (or /MI per profile units) — updating per keystroke, styled like the session HUD
  readouts. Erg shows /500M split; conditioning shows no pace row.
- **D-13 (Date + note):** Quiet mono "TODAY" row at the bottom; tap opens a native date
  sheet (no future dates). Note is a single optional ledger field, placeholder "ADD
  NOTE", grows to one extra line. Both stay out of the fast path.
- **D-14 (Save flow):** Save → finish screen with the 84px mini-ring counting up the
  session HSS + mono pace/distance/duration summary; Done returns to TODAY. Same
  pattern as the lift finish flow.
- **D-15 (Validation):** Clamp-and-warn (Phase 3 D-03 continuity): duration is the only
  required field; distance optional (conditioning has none); HR optional. Inline "are
  you sure?" warnings on implausible values (pace <2:30/km, HR >220); never block save.
- **D-16 (Per-type field morphing):** RUN: distance km/mi, pace /KM or /MI. ERG:
  distance in meters, split as /500M. CONDITIONING: distance and pace hidden entirely —
  duration + HR + note only.
- **D-17 (Scroll order):** Mono timestamp + greeting → 200px HSS ring + readiness light
  (above the fold) → ATL · CTL · TSB stat tile row → 28-day trend chart → today's
  session rows.
- **D-18 (Chart series):** ATL (bone) and CTL (ash) as lines — the acute-vs-chronic
  crossover picture — with TSB as a mono number readout (its stat tile doubles as the
  chart's TSB display; one source of truth). No volt on the chart.
- **D-19 (Chart interactivity):** Scrub with tooltip — touch-drag shows a mono tooltip
  with a hairline cursor snapping to the nearest day. USER EXPLICITLY CHOSE this over
  the static-v1 recommendation; plan the gesture work.
- **D-20 (Tooltip content):** "JUL 8 · HSS 142 · ATL 41 · CTL 55 · TSB +14" — date +
  all four values. Rest days show HSS 0 but still show ATL/CTL/TSB (EWMA always has
  values).
- **D-21 (Stat tiles):** ATL · CTL · TSB tiles per the design-doc pattern (big number +
  mono caption ATL · ACUTE / CTL · CHRONIC / TSB · BALANCE).
- **D-22 (Calibrating chart state):** The chart renders whatever days exist (1, 5, 12…)
  with a "BUILDING TREND · DAY N/14" mono caption; the animated plate-orbit sits in the
  hero where the readiness light will live (see D-08).
- **D-23 (Today's session rows):** Design-doc session rows — title (Archivo semibold) +
  mono metadata line (LOWER · 6 LIFTS · RPE 8 / 6.2 KM · 5:30 /KM · 142 BPM) + session
  HSS right-aligned. "TODAY · N SESSIONS" mono header. Tap opens session detail.
- **D-24 (Ring/tile taps):** Tapping the ring opens a today-breakdown sheet (sessions +
  double-day math, same pattern as the live-HSS breakdown sheet). Tapping a stat tile
  flips a one-line mono explainer ("ATL — 7-day acute load: what you've done lately").
- **D-25 (Structure):** History is its own tab (see D-07): chronological ledger of day
  rows (date · day HSS · session count). Tapping a day expands its sessions inline
  (accordion); tapping a session pushes the session detail.
- **D-26 (Double-session labeling):** Day rows with 2+ sessions get a small amber-tinted
  mono chip "2 SESSIONS · ADJUSTED"; expanding shows the honest math — sessions' raw HSS
  values, then "DAY TOTAL 142 · INCL. +12 DOUBLE-DAY LOAD".
- **D-27 (Rest days):** Shown quietly — thin ash "REST" rows so the ledger shows the true
  calendar rhythm. USER EXPLICITLY CHOSE this over hiding rest days.
- **D-28 (Paging):** Infinite scroll by month — most recent ~30 days load instantly,
  older chunks fetch on scroll, mono month header rows ("JULY 2026").
- **D-29 (Edit/delete):** Delete only — swipe-to-delete a session (soft-delete,
  consistent with set rows) triggers a load_daily recompute from that date forward.
  Editing past sessions is deferred (see Deferred Ideas).

### Claude's Discretion

- Exact tooltip snap mechanics and chart axis label density.
- Stat-tile explainer copy.
- History month-header treatment details.
- Erg distance quick-presets (500/1000/2000m) if they aid speed — optional.

### Deferred Ideas (OUT OF SCOPE)

- **Editing past sessions** (fields of a saved run/lift) — deferred from D-29; needs a
  stale-score/recompute story. Candidate for v1.1.
- **5-tab layout (TRENDS · PROFILE split)** — DESIGN-SYSTEM.md's full nav; revisit after
  v1.0 if TODAY gets crowded.
- **Animated plate-orbit beyond the calibrating state** (boot splash, home header brand
  moment) — options discussed, only the calibrating placement chosen for now.
- **Run-type chips (Z2 · TEMPO · INTERVALS · LONG)** from DESIGN-SYSTEM.md §5 — not a
  v1.0 requirement; RUN-01's activity types cover the need.
- **Weekly tonnage/mileage stat tiles** — considered for the tile row, ATL/CTL/TSB chosen;
  volume tiles are a nice v1.1 addition once aggregation queries exist.

</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| RUN-01 | User can log a session with an activity type (Run / Erg / Conditioning) | `workout.type='endurance'` + `endurance_segment.activityType` enum (`run/erg/conditioning/sled/other`) already in schema; segmented control per D-10/UI-SPEC §7 |
| RUN-02 | User enters distance + duration and pace auto-calculates live | Pure client-side arithmetic on `distanceM`/`durationS` fields; reuse `formatPaceMinSec`/`paceSecPerKmToSecPerMi` from `packages/shared/src/units.ts` |
| RUN-03 | User can optionally enter average HR | `endurance_segment.avgHr` column already exists; feeds `resolveIF` |
| RUN-04 | Session date defaults to today and is editable | `workout.localDate` (text YYYY-MM-DD) already exists; reuse `todayLocalDate()` pattern from `log/index.tsx`; new `@react-native-community/datetimepicker` dep for the date sheet |
| RUN-05 | User can add an optional free-text note / tag | **Schema gap** — `workout.note` column does not exist; new drizzle migration required (see Package/Schema section) |
| RUN-06 | Session HSS is shown on the finish screen | `sessionHSSDetailed({ enduranceSegments: [...] })` → `.hss`; retrofit `app/session/finish.tsx` per D-04's 84px mini-ring |
| HOME-01 | Home screen shows today's readiness band prominently, above the fold | `readinessBand()` fed from the newly-built `load_daily` recompute pipeline (see Summary — this is net-new plumbing, not existing) |
| HOME-02 | Home screen shows today's total HSS | `load_daily.dayHss` for today's `localDate`, or 0 if no row yet |
| HOME-03 | Home screen shows a 28-day ATL/CTL/TSB trend chart | `victory-native` `CartesianChart` reading the last 28 `load_daily` rows |
| HOME-04 | Home shows a calibrating state until 14+ days of data exist | `readinessBand`'s `historyDays` gate (`calibratingMinHistoryDays`, default engine config) — historyDays counts from the athlete's FIRST-EVER finished session, not account creation (verified in `trend.ts`) |
| HOME-05 | User can view workout history grouped by day with day HSS + session count | `load_daily` for day HSS; a new grouped-count query (session count is NOT a `load_daily` column — derive live) |
| HOME-06 | Double-session penalty is labeled on the day view when sessionCount > 1 | `dailyHSS(sessionScores)` already applies `config.doublePenalty` when `sessionScores.length > 1`; the "+Y DOUBLE-DAY LOAD" label is `dailyHSS(scores) - sum(scores)` |

</phase_requirements>

## Standard Stack

### Core (new dependencies this phase)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `victory-native` | **41.26.0** [VERIFIED: npm registry, published 2026-06-09] | 28-day ATL/CTL/TSB trend chart with scrub gesture (D-19) | Skia-based, Formidable-maintained (`FormidableLabs/victory-native-xl`), 378K weekly downloads; already locked in TECH-STACK.md and UI-SPEC.md |
| `@shopify/react-native-skia` | **^2.6.9** [VERIFIED: npm registry — peer dep of victory-native] | GPU canvas backing victory-native | Official Shopify library, 1.25M weekly downloads. Peer range confirmed via `npm view victory-native@41.26.0 peerDependencies`: `"@shopify/react-native-skia": ">=1.2.3 <3.0.0"` — **do not** let `expo install` resolve a 3.x version |
| `react-native-svg` | **15.15.5** [VERIFIED: npm registry] | HSS ring geometry (200px home + 84px mini-ring, D-01/D-04) | Standard SVG-in-RN library (5.28M weekly downloads); a stroke-dashoffset `Circle` is the correct primitive for a progress ring — no dedicated "ring gauge" library needed |
| `@react-native-community/datetimepicker` | **9.1.0** [VERIFIED: npm registry] | Native iOS date sheet for RUN-04/D-13 | Official React Native Community package, 1.91M weekly downloads; no equivalent ships with Expo SDK 56 core |
| `react-native-gesture-handler` | **3.0.2** (already installed) [VERIFIED: apps/mobile/package.json] | Chart scrub gesture + existing swipe/sheet gestures | Already satisfies victory-native's peer requirement (`>=2.0.0`); no upgrade needed |
| `react-native-reanimated` | **4.3.1** (already installed) [VERIFIED: apps/mobile/package.json] | Ring count-up/fill animation, chart shared values | Already satisfies both victory-native's (`>=3.0.0`) and Skia's (`>=3.19.1`) peer requirements; no upgrade needed |

**Note on TECH-STACK.md drift:** TECH-STACK.md (project doc) lists `react-native-reanimated 4.5.0` and describes `react-native-gesture-handler` as "(SDK bundled)". The **actually installed** versions are `reanimated 4.3.1` and `gesture-handler 3.0.2` [VERIFIED: apps/mobile/package.json] — both satisfy every peer requirement checked above, so no version bump is required for this phase. Do not blindly upgrade to chase the doc's numbers; verify peer ranges before touching either.

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `drizzle-orm` `onConflictDoUpdate` | 0.45.2 (already installed) [VERIFIED: `node_modules/drizzle-orm/sqlite-core/query-builders/insert.d.ts`] | `load_daily` upsert during the full-history recompute | Confirmed signature: `insert(table).values([...]).onConflictDoUpdate({ target: table.column, set: {...}, where? })` — read directly from the installed `.d.ts`, not a web-synthesized example (Phase 3 lesson, STATE.md) |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `react-native-svg` stroke-dashoffset ring | A dedicated progress-ring library (e.g. `react-native-circular-progress`) | Adds a dependency for something 40 lines of SVG + Reanimated already does exactly to the UI-SPEC's exact spec (capped fill fraction, custom count-up, inside-label placement) — hand-rolling wins here per "Don't Hand-Roll" nuance below |
| `victory-native` scrub via `useChartPressState` | A raw Skia `Canvas` + manual `PanGestureHandler` | victory-native's `CartesianChart` + `useChartPressState` (see Code Examples) is the documented, maintained path for exactly this "touch-drag → nearest-point tooltip" interaction (D-19) — reinventing it duplicates already-solved gesture/coordinate-mapping code |
| Full-history `load_daily` recompute per write | An incremental "resume from last stored ATL/CTL" recompute | `computeLoadTrendSeries` has no resume API (always starts atl=0/ctl=0 at array index 0); building a parallel resume-aware fold would duplicate `ewmaStep`'s private logic and risk drift from the engine's canonical math. Full recompute is O(days-since-first-session) — cheap for a mobile app's realistic v1.0 dataset (weeks to low hundreds of days) |

**Installation:**
```bash
cd apps/mobile
npx expo install victory-native @shopify/react-native-skia react-native-svg @react-native-community/datetimepicker
```
Then `npx expo prebuild` (or the project's existing dev-build rebuild step) is required — these are all native modules, same as `op-sqlite`/HealthKit; **cannot** be verified in Expo Go.

**Version verification performed this session:**
```
npm view victory-native version                        → 41.26.0 (2026-06-09)
npm view victory-native@41.26.0 peerDependencies        → skia >=1.2.3 <3.0.0, gesture-handler >=2.0.0, reanimated >=3.0.0
npm view @shopify/react-native-skia versions            → latest 2.6.9 (2026-06-28); peer: react >=19.0, react-native >=0.78, reanimated >=3.19.1
npm view react-native-svg version                       → 15.15.5
npm view @react-native-community/datetimepicker version → 9.1.0, peer expo >=52.0.0
```

## Package Legitimacy Audit

| Package | Registry | Age (latest publish) | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|------|-----------|-------------|---------|-------------|
| `victory-native` | npm | 2026-06-09 (~1 mo) | 378,468/wk | github.com/FormidableLabs/victory-native-xl | OK | Approved |
| `@shopify/react-native-skia` | npm | 2026-06-28 (~2 wk) | 1,253,895/wk | github.com/Shopify/react-native-skia | **SUS** ("too-new" signal) | Flagged — see note below |
| `react-native-svg` | npm | 2026-05-11 | 5,281,587/wk | github.com/software-mansion/react-native-svg | OK | Approved |
| `@react-native-community/datetimepicker` | npm | 2026-03-17 | 1,911,664/wk | github.com/react-native-datetimepicker/datetimepicker | OK | Approved |

**Packages removed due to [SLOP] verdict:** none.

**Packages flagged as suspicious [SUS]:** `@shopify/react-native-skia` — the legitimacy gate's "too-new" heuristic fired on the *latest patch's* publish date (2.6.9, ~2 weeks old at research time), not on the package's overall legitimacy. Context: this is Shopify's own official, actively-maintained Skia binding with 1.25M weekly downloads and an 8+ major-version history — the signal is a false-positive artifact of frequent patch releases, not a slopsquat/hallucination risk. **Still follow protocol:** the planner must insert a `checkpoint:human-verify` task before this install, and should pin the exact tested patch version (`2.6.9`, not a caret range) in `package.json` so a mid-implementation patch bump can't silently change chart rendering behavior.

## Architecture Patterns

### System Architecture Diagram

```
┌─────────────────────────────┐        ┌──────────────────────────────┐
│  Run Entry Form (RUN-01..06)│        │  Lifting Finish (RETROFIT)     │
│  single screen, local state │        │  app/session/finish.tsx        │
└──────────────┬───────────────┘        └───────────────┬────────────────┘
               │ Save                                    │ Done
               ▼                                          ▼
┌───────────────────────────────────────────────────────────────────────┐
│ Per-session write (existing pattern, extend for endurance):           │
│  1. insert workout {type:'endurance', localDate, note}                 │
│  2. resolveIF(pace|HR vs profile thresholds) → intensityFactor         │
│  3. insert endurance_segment {activityType, distanceM, durationS,      │
│     avgHr, intensityFactor, stressScore}                               │
│  4. sessionHSSDetailed({ enduranceSegments:[...] }) → hss              │
│  5. UPDATE workout SET hss = result.hss                                │
└──────────────────────────────┬──────────────────────────────────────────┘
                                 │ NEW THIS PHASE — does not exist yet
                                 ▼
┌───────────────────────────────────────────────────────────────────────┐
│ recomputeLoadDaily(db) — full-history rebuild                          │
│  1. SELECT localDate, hss FROM workout                                 │
│     WHERE finishedAt IS NOT NULL AND deletedAt IS NULL                 │
│  2. group session hss by localDate; apply dailyHSS() per day           │
│     (double-session penalty when sessionCount>1)                       │
│  3. build a CONTIGUOUS array of daily HSS from first-ever session's    │
│     localDate through today, 0-filling rest days                       │
│  4. computeLoadTrendSeries(dailyArray) → [{atl,ctl,tsb,band}, ...]      │
│  5. upsert every {localDate, dayHss, atl, ctl, tsb, readinessBand}      │
│     into load_daily (onConflictDoUpdate keyed on localDate)            │
└──────────────────────────────┬──────────────────────────────────────────┘
                                 │
                                 ▼
┌───────────────────────────────────────────────────────────────────────┐
│ Home (TODAY tab) — read-only reactive consumer                         │
│  - today's load_daily row → ring number, readiness band                │
│  - last 28 load_daily rows → victory-native trend chart + scrub tooltip│
│  - today's workout rows → session list (D-23)                          │
└───────────────────────────────────────────────────────────────────────┘
                                 │
                                 ▼
┌───────────────────────────────────────────────────────────────────────┐
│ History tab — paginated read                                           │
│  - load_daily rows (day HSS/ATL/CTL/TSB) joined with a live grouped-   │
│    count query over workout (session count is NOT a load_daily column) │
│  - swipe-to-delete → softDeleteWorkout() → recomputeLoadDaily(db)       │
│    (D-29's "recompute from that date forward" — implemented as the     │
│    same full-history rebuild, simplest correct option for v1.0 scale)  │
└───────────────────────────────────────────────────────────────────────┘
```

### Recommended Project Structure
```
apps/mobile/
├── app/(tabs)/
│   ├── index.tsx              # TODAY (retrofit placeholder) — ring, stat tiles, chart, session rows
│   ├── log/
│   │   ├── index.tsx          # retrofit: add "Log Run" secondary CTA
│   │   └── run.tsx            # NEW — run entry ledger (RUN-01..06)
│   └── history/
│       └── index.tsx          # NEW — day-grouped ledger (HOME-05/06)
├── app/session/
│   ├── finish.tsx             # retrofit: 84px mini-ring, branch strength|endurance
│   └── detail.tsx             # NEW — session detail (pushed from History)
├── components/
│   ├── home/
│   │   ├── HssRing.tsx        # NEW — react-native-svg ring, shared by home (200px) + finish (84px)
│   │   ├── ReadinessLight.tsx # NEW
│   │   ├── StatTiles.tsx      # NEW
│   │   └── TrendChart.tsx     # NEW — victory-native CartesianChart + scrub tooltip
│   └── history/
│       └── DayRow.tsx         # NEW — accordion day row (D-25/26/27)
├── lib/
│   ├── recomputeLoadDaily.ts  # NEW — the pipeline described above
│   ├── runEntry.ts            # NEW — resolveIF + sessionHSSDetailed wiring for a single run save
│   └── durationDigits.ts      # NEW — smart h:mm:ss digit-entry parser (D-11)
└── stores/
    └── (no new zustand store strictly required — run entry is single-screen local state;
       reuse useSessionStore's units field pattern via useSettingsStore if simpler)
```

### Pattern 1: Full-history `load_daily` recompute
**What:** Rebuild the entire `load_daily` table from the athlete's first-ever finished session
through today, every time a workout is finished, saved, or soft-deleted.
**When to use:** After every terminal write to `workout` (finish, run-save, soft-delete).
**Example:**
```typescript
// apps/mobile/lib/recomputeLoadDaily.ts — pattern, not final code
import { and, isNotNull, isNull } from 'drizzle-orm';
import { workout, loadDaily, type DB } from '@apsis/db';
import { dailyHSS, computeLoadTrendSeries } from '@apsis/engine';

/** Local (not UTC) YYYY-MM-DD — must match log/index.tsx's todayLocalDate() exactly
 * so day boundaries never drift near midnight (Pitfall 4 below). */
function localDateString(d: Date): string { /* ... */ return ''; }

function addDaysLocal(dateStr: string, n: number): string { /* ... */ return ''; }

export async function recomputeLoadDaily(database: DB): Promise<void> {
  const rows = await database
    .select({ localDate: workout.localDate, hss: workout.hss })
    .from(workout)
    .where(and(isNotNull(workout.finishedAt), isNull(workout.deletedAt)));

  if (rows.length === 0) return; // nothing to roll up yet

  const byDate = new Map<string, number[]>();
  for (const row of rows) {
    const list = byDate.get(row.localDate) ?? [];
    list.push(row.hss ?? 0);
    byDate.set(row.localDate, list);
  }

  const firstDate = [...byDate.keys()].sort()[0];
  const today = localDateString(new Date());

  // Contiguous, gap-filled array — REST days must appear as explicit 0s (Pitfall 3).
  const dates: string[] = [];
  for (let d = firstDate; d <= today; d = addDaysLocal(d, 1)) dates.push(d);
  const dailyArray = dates.map((d) => dailyHSS(byDate.get(d) ?? []));

  const series = computeLoadTrendSeries(dailyArray); // [{atl,ctl,tsb,band}, ...] same length

  const upsertRows = dates.map((localDate, i) => ({
    localDate,
    dayHss: dailyArray[i],
    atl: series[i].atl,
    ctl: series[i].ctl,
    tsb: series[i].tsb,
    readinessBand: series[i].band,
    updatedAt: new Date(),
  }));

  await database
    .insert(loadDaily)
    .values(upsertRows)
    .onConflictDoUpdate({
      target: loadDaily.localDate,
      set: {
        dayHss: sql`excluded.day_hss`,
        atl: sql`excluded.atl`,
        ctl: sql`excluded.ctl`,
        tsb: sql`excluded.tsb`,
        readinessBand: sql`excluded.readiness_band`,
        updatedAt: sql`excluded.updated_at`,
      },
    });
}
```
Signature of `onConflictDoUpdate` [VERIFIED: `node_modules/drizzle-orm/sqlite-core/query-builders/insert.d.ts:163`] confirms `target`/`set`/optional `where`. The `excluded.*` pattern for batch-upsert `set` values should be verified against the installed drizzle-orm SQLite upsert docs/examples during planning — this is the one part of the snippet synthesized from general drizzle SQLite knowledge rather than read directly off an installed example (flagged in Assumptions Log).

### Pattern 2: Smart h:mm:ss digit entry (D-11)
**What:** A single mono field where numeric-keypad digits fill right-to-left, so "4530" → "45:30" and "13000" → "1:30:00".
**When to use:** The run form's DURATION field (the only required field, D-15).
**Example:**
```typescript
// apps/mobile/lib/durationDigits.ts — pure function, easily unit-testable
export function parseDurationDigits(raw: string): { totalSeconds: number; display: string } {
  const digits = raw.replace(/[^0-9]/g, '').slice(-6); // keep last 6 typed digits
  const padded = digits.padStart(6, '0');
  const h = Number.parseInt(padded.slice(0, 2), 10);
  const m = Number.parseInt(padded.slice(2, 4), 10);
  const s = Number.parseInt(padded.slice(4, 6), 10);
  const totalSeconds = h * 3600 + m * 60 + s;
  const display = h > 0
    ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
    : `${m}:${String(s).padStart(2, '0')}`;
  return { totalSeconds, display };
}
```
Momentary "99" in the mm/ss slots while still typing is expected/harmless — `totalSeconds` is
always computed as a flat arithmetic sum, so it self-corrects as more digits are typed; there is
no need to clamp individual mm/ss groups to 0-59 during entry.

### Pattern 3: Run-segment IF resolution (RUN-01..03)
**What:** Resolve `intensityFactor` per activity type before calling `enduranceStressDetailed`.
**When to use:** The run-save handler, once per segment.
**Example:**
```typescript
// Source: packages/engine/src/endurance.ts (existing, read this session)
import { resolveIF, enduranceStressDetailed } from '@apsis/engine';

// RUN: prefer pace (computed from distanceM/durationS) over HR unless HR present —
// resolveIF's own HR-over-pace precedence (D-11 in the engine) handles this; just
// supply both fields when available and let the engine choose.
const paceSecPerKm = distanceM > 0 ? durationS / (distanceM / 1000) : undefined;
const { intensityFactor, warnings: ifWarnings } = resolveIF({
  avgHR,
  thresholdHR: profile.thresholdHr,
  paceSecPerKm: activityType === 'run' ? paceSecPerKm : undefined, // Pitfall 8 — ERG must NOT pass its split here
  thresholdPaceSecPerKm: profile.thresholdPaceSecPerKm,
});

const { es: hss, warnings: stressWarnings } = enduranceStressDetailed({ durationS, intensityFactor });
```

### Pattern 4: victory-native scrub tooltip (D-19/D-20)
**What:** Touch-drag across the trend chart snaps to the nearest day and shows a tooltip.
**When to use:** `components/home/TrendChart.tsx`.
**Example:**
```typescript
// Source: https://nearform.com/open-source/victory-native/docs/cartesian/chart-gestures
// [CITED: nearform.com/open-source/victory-native/docs] — official victory-native docs
import { CartesianChart, useChartPressState, Line } from 'victory-native';

function TrendChart({ data }: { data: { day: number; atl: number; ctl: number }[] }) {
  const { state, isActive } = useChartPressState({ x: 0, y: { atl: 0, ctl: 0 } });

  return (
    <CartesianChart data={data} xKey="day" yKeys={['atl', 'ctl']} chartPressState={state}>
      {({ points }) => (
        <>
          <Line points={points.atl} color={Colors.dark.text} strokeWidth={2} />
          <Line points={points.ctl} color={Colors.dark.mutedText} strokeWidth={2} />
          {/* isActive.value + state.x.position.value drive the hairline cursor + tooltip card */}
        </>
      )}
    </CartesianChart>
  );
}
```
`GestureHandlerRootView` already wraps the whole app root (`apps/mobile/app/_layout.tsx`, added
for `@gorhom/bottom-sheet`/`Swipeable` in Phase 3) — **no additional root-wrapping is needed**
for the chart's gesture to work.

### Anti-Patterns to Avoid
- **Re-deriving ATL/CTL/TSB in a component:** Never hand-roll EWMA math in `TrendChart.tsx` or
  anywhere in `apps/mobile` — always read persisted `load_daily` rows or call
  `computeLoadTrendSeries` from `@apsis/engine`.
- **Per-day incremental `load_daily` writes without a full recompute:** Writing only "today's"
  row without re-running the fold from the first-ever session will silently desync ATL/CTL from
  what the engine would actually compute (see Pitfall 2).
- **Feeding ERG split pace into `ifFromPace`/`resolveIF`'s `paceSecPerKm`:** compares against a
  *running* threshold pace — semantically wrong for rowing/ski-erg splits (Pitfall 8).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| ATL/CTL/TSB EWMA math | A custom exponential-average implementation in the UI or a new db-layer function | `computeLoadTrendSeries` (`@apsis/engine`, already built + tested Phase 2) | Single source of truth for the formula; a UI-layer reimplementation would drift on the next constant re-fit |
| Double-session penalty math | A `sessionCount > 1 ? total * 1.2 : total` inline in a component | `dailyHSS(sessionScores)` (`@apsis/engine`) | Keeps the multiplier config-driven (`config.doublePenalty`) and consistent everywhere it's shown (Home ring, History chip) |
| Trend chart rendering + gestures | Raw `react-native-svg` polylines + manual `PanResponder` | `victory-native` `CartesianChart` + `useChartPressState` | D-19's scrub-tooltip interaction is exactly what victory-native's press-gesture API is built for; reinventing coordinate-mapping/nearest-point logic duplicates already-maintained code |
| Unit conversion (km↔mi, pace formatting) | Ad hoc `* 0.621371` literals in the run form | `packages/shared/src/units.ts` (`kmToDisplayMi`, `paceSecPerKmToSecPerMi`, `formatPaceMinSec`) | Already exact round-trip-safe conversions used by onboarding/SetRow/Settings; a second conversion path risks off-by-a-rounding-error display drift |
| Native date picker | A custom modal date grid | `@react-native-community/datetimepicker` | Standard, accessible, matches iOS-native date-sheet UX D-13 asks for ("native date sheet") |

**Key insight:** The engine (`packages/engine`) is explicitly the project's IP/moat (per
`.claude/CLAUDE.md`) and is already fully built for every computation this phase needs. Every
"Don't Hand-Roll" item above traces back to the same rule: Phase 4 is a *consumer* of the engine
and of Phase 3's shared conversion utilities, never a re-implementer.

## Common Pitfalls

### Pitfall 1: Lifting flow never wired to `load_daily`
**What goes wrong:** Only the new run-save path calls the recompute pipeline; the existing
lifting `finish.tsx`/`finishWorkout.ts` flow is left untouched. Home then only ever reflects
runs, silently violating HOME-01..04 and the app's Core Value.
**Why it happens:** CONTEXT.md's code_context section says "Phase 4 is purely a consumer" of the
engine, which is easy to over-read as "load_daily plumbing already exists" — it doesn't (verified
via `git grep` this session).
**How to avoid:** Treat "retrofit `finishWorkout`/`finish.tsx`'s Done handler to call
`recomputeLoadDaily(db)`" as an explicit, first-class task in the plan, not an afterthought of
the run-entry plan.
**Warning signs:** On-device UAT shows the readiness band/ring changing after a run but not
after a lift.

### Pitfall 2: Partial/"forward-only" recompute drifting from the engine's canonical math
**What goes wrong:** An optimization attempt seeds `atl`/`ctl` from the previously-stored
`load_daily` row at the changed date and only folds forward from there, without going through
`computeLoadTrendSeries`'s own `ewmaStep`/`ewmaLambda` internals (which are not exported).
**Why it happens:** Looks like an obvious performance win ("only recompute what changed"), and
D-29's UI-SPEC copy literally says "recompute from that date forward," inviting a partial
implementation.
**How to avoid:** Implement "recompute from that date forward" as **originating** a full rebuild
from the athlete's first-ever session every time (Pattern 1) — for v1.0's realistic data volumes
this is cheap and guaranteed correct. Do not attempt a resume-from-stored-state optimization
without also exporting/duplicating the engine's private `ewmaStep` function, which risks drift.
**Warning signs:** ATL/CTL numbers in `load_daily` disagree with what `computeLoadTrend` would
produce if run fresh over the same full history.

### Pitfall 3: Non-contiguous daily-HSS array skips rest days in the EWMA fold
**What goes wrong:** Building the array to feed `computeLoadTrendSeries` by only including dates
that actually have a `workout` row (skipping rest days entirely) changes the EWMA's effective
time-decay — each array index is treated as "one day" by the engine regardless of the real
calendar gap between sessions.
**Why it happens:** SQL `GROUP BY localDate` naturally produces a sparse result set; it's easy to
map that directly into the trend-series array without explicitly gap-filling.
**How to avoid:** Always build a *calendar-contiguous* array (Pattern 1's `for` loop from
`firstDate` to `today`), inserting `dailyHSS([])` (= 0) for every day with no session.
**Warning signs:** ATL/CTL respond to sessions as if they happened on consecutive days even when
weeks apart in the History ledger.

### Pitfall 4: `localDate` timezone drift between the run form's date picker and "today"
**What goes wrong:** The run entry form computes "today" one way (e.g. via the date picker
library's own locale/UTC default) while `recomputeLoadDaily`'s "today" boundary and
`log/index.tsx`'s existing `todayLocalDate()` use local-time `YYYY-MM-DD`. Near midnight in
certain timezones, a session logged as "today" in the form lands one calendar day off in
`load_daily`.
**Why it happens:** `@react-native-community/datetimepicker` and JS `Date` UTC methods are easy
to reach for by default; the project's existing convention (`log/index.tsx`'s
`todayLocalDate()`) is local-time and easy to miss if not explicitly reused.
**How to avoid:** Export and reuse a single `todayLocalDate()`/`localDateString(Date)` helper
(promote the existing `log/index.tsx` inline function to a shared `lib/` utility) everywhere a
local date string is derived in Phase 4.
**Warning signs:** A session logged just before/after midnight appears on the "wrong" day in
History or fails to move today's ring.

### Pitfall 5: `useEffect` instead of `useFocusEffect` on TODAY/HISTORY
**What goes wrong:** A screen inside the tab navigator that reads store/DB state via a bare
`useEffect` on mount re-fires (or fails to re-fire) unpredictably as expo-router keeps stacked
screens mounted-but-unfocused — this exact bug caused a Phase 3 P10 regression (stacked-screen
`rehydrateFromDb` oscillation, logged in STATE.md).
**Why it happens:** `useEffect` looks correct for "load data on screen mount" but expo-router's
tab/stack screens don't unmount on tab switch.
**How to avoid:** Every Home/History screen effect that reads `load_daily`/`workout` must use
`useFocusEffect` (already an established project convention per STATE.md).
**Warning signs:** Returning to TODAY after logging a run shows stale data, or logs show
duplicate/repeated queries on every tab switch.

### Pitfall 6: ERG intensity factor computed from the wrong pace domain
**What goes wrong:** Passing the erg's `/500m` split (or a `distanceM/durationS`-derived
"pace") into `resolveIF`'s `paceSecPerKm` parameter compares it against the athlete's
**running** threshold pace from onboarding — the two units aren't physiologically comparable, so
the resulting IF is nonsensical (systematically over- or under-stating erg intensity).
**Why it happens:** D-16 already visually treats ERG's distance/pace like RUN's ("distance in
meters, split as /500M"), making it easy to also treat them the same in the IF-resolution call.
**How to avoid:** Only pass `paceSecPerKm`/`thresholdPaceSecPerKm` into `resolveIF` for
`activityType === 'run'`. For ERG (and CONDITIONING), rely on `avgHR`/`thresholdHR` only; if
absent, `resolveIF` already falls back to a neutral `IF=1.0` with a warning — this is correct,
documented engine behavior, not a gap to fill.
**Warning signs:** Erg sessions produce implausibly high/low HSS relative to a comparable-effort
run.

### Pitfall 7: `@shopify/react-native-skia` version drift
**What goes wrong:** `npx expo install @shopify/react-native-skia` (without an explicit version)
resolves whatever is "latest compatible" at install time; because the package publishes patches
frequently (flagged SUS by the legitimacy gate for exactly this reason), a later `pnpm install`
during the same phase could silently pick up a newer patch with different rendering behavior.
**How to avoid:** Pin the exact tested version (`2.6.9`) in `package.json`, not a caret range,
until the phase is verified on-device.

## Code Examples

### Reading the last 28 days for the trend chart
```typescript
// Source: pattern derived from packages/db/src/queries.ts's existing builder-factory style
import { desc } from 'drizzle-orm';
import { loadDaily, type QueryableDB } from '@apsis/db';

export function last28DaysTrend(db: QueryableDB) {
  return db.select().from(loadDaily).orderBy(desc(loadDaily.localDate)).limit(28);
  // caller reverses to chronological order for the chart
}
```

### Session-count-per-day for History (HOME-05) — NOT a `load_daily` column
```typescript
// Source: pattern derived from packages/db/src/queries.ts's recentExerciseIds groupBy style
import { sql, and, isNotNull, isNull } from 'drizzle-orm';
import { workout, type QueryableDB } from '@apsis/db';

export function sessionCountsByDate(db: QueryableDB) {
  return db
    .select({ localDate: workout.localDate, sessionCount: sql<number>`count(*)`.as('sessionCount') })
    .from(workout)
    .where(and(isNotNull(workout.finishedAt), isNull(workout.deletedAt)))
    .groupBy(workout.localDate);
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|---------------|--------|
| N/A — no prior chart/ring implementation exists in this codebase | victory-native 41.x (Skia-based, full rewrite from the pre-v40 SVG line) | v40+ (per TECH-STACK.md, already researched) | Confirms the project doc's choice is current, not stale |

**Deprecated/outdated:** None specific to this phase beyond what TECH-STACK.md already flags
(drizzle-orm 1.0.0-rc.x avoided, Skia 3.x avoided).

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `onConflictDoUpdate`'s `set` values using `sql`excluded.column`` for a batch upsert works identically for drizzle-orm 0.45.2 against op-sqlite as it does for other SQLite drivers | Pattern 1 code example | If the `excluded.*` reference isn't supported by this exact drizzle+op-sqlite combination, the upsert would need per-row `set` literals instead — a mechanical but non-trivial rewrite; verify against an installed example or a small on-device spike before committing to the batch form |
| A2 | victory-native's `useChartPressState`/`CartesianChart` API surface shown in the Code Examples section matches the exact TypeScript signatures shipped in `victory-native@41.26.0` | Pattern 4 | The snippet was synthesized from official docs (WebFetch), not read off the installed `.d.ts` (unlike the drizzle upsert, which WAS verified against `node_modules`) — planner/executor should confirm against `node_modules/victory-native`'s types once installed, following the same discipline Phase 3 used for `Stack.Protected` (STATE.md) |
| A3 | A full-history `load_daily` recompute (Pattern 1) stays performant (sub-second, acceptable for a synchronous op-sqlite write-then-recompute UX) at v1.0's realistic data scale (a training log a few weeks to a few months old at launch) | Summary, Pattern 1, Alternatives Considered | If an athlete has a very long unbroken history (year+) by the time this code runs, the full-history fold could become a noticeably slow synchronous op-sqlite operation on save; if this becomes a problem, the mitigation is a resume-aware fold seeded from a stored `{atl, ctl}` checkpoint, which requires exporting the engine's private EWMA step functions (a Phase 2 engine change, out of this phase's scope) |
| A4 | `workout.note` (rather than a new column on `endurance_segment`) is the correct schema location for RUN-05's note field | Phase Requirements table, Package/Schema section | UI-SPEC.md already reasons through and recommends this same placement (serves CONDITIONING sessions with no segment-level detail worth separating) — flagged here only because CONTEXT.md explicitly deferred the final call to "planner/RESEARCH decision" |

**If this table is empty:** N/A — see entries above.

## Open Questions

1. **Does the drizzle-orm 0.45.2 + op-sqlite combination support the `excluded.*` reference
   pattern in `onConflictDoUpdate`'s `set` for a multi-row batch insert?**
   - What we know: `onConflictDoUpdate` itself is present and typed in the installed
     `node_modules/drizzle-orm/sqlite-core/query-builders/insert.d.ts` (VERIFIED this session).
   - What's unclear: whether the `excluded.column` SQL fragment (standard SQLite upsert syntax)
     is the idiomatic drizzle way to reference "the row that would have been inserted" inside a
     batched multi-row upsert, versus doing N separate single-row upserts.
   - Recommendation: spike this specific call shape on-device early in the plan (Wave 0-style
     validation) before building the rest of the recompute pipeline around it; falling back to a
     loop of single-row upserts is a safe, simple alternative if the batch form doesn't behave as
     expected.
   - **RESOLVED (planning):** `04-03-PLAN.md` Task 2 adopts the safe fallback outright — a loop of
     single-row `insert(loadDaily).values(row).onConflictDoUpdate(...)` calls whose `set` uses each
     row's LITERAL values (`row.dayHss`, `row.atl`, …), never an `excluded.*` reference and never a
     raw interpolated `sql` template. This sidesteps the unverified batch-`excluded` idiom entirely
     while staying fully parameterized (T-1-01), so no on-device spike is needed before building the
     rest of the pipeline.

2. **Should the full-history `load_daily` recompute run synchronously inline with the save flow
   (blocking the finish-screen navigation briefly) or be kicked off fire-and-forget?**
   - What we know: op-sqlite is JSI-synchronous and fast; Phase 3's `commitSet`/`recomputeSessionHss`
     pattern is already synchronous-await, not fire-and-forget.
   - What's unclear: whether a full-history fold (as opposed to a single-session recompute) stays
     fast enough to keep inline at larger history sizes (see Assumption A3).
   - Recommendation: keep it synchronous/awaited for v1.0 (matches the existing commitSet
     precedent and guarantees Home is never stale immediately after Done), revisit only if
     on-device UAT shows a perceptible stall.
   - **RESOLVED (planning):** `04-03-PLAN.md` Task 3 keeps the recompute synchronous — both
     `finishWorkout` and `discardWorkout` `await recomputeLoadDaily(database)` inline after their
     write (never fire-and-forget), matching the Phase 3 `commitSet`/`recomputeSessionHss`
     precedent and guaranteeing Home is never stale immediately after Done. Revisit only if
     on-device UAT surfaces a stall (tracked by Assumption A3).

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Expo CLI tooling (`npx expo install`, prebuild) | ✓ (with warning) | 20.16.0 installed; Expo CLI requests ≥20.19.4 | Upgrade Node before running `expo install`/`prebuild` for this phase to avoid CLI warnings/edge-case incompatibilities; not a hard blocker observed this session but should be resolved before Wave 0 |
| `victory-native` | HOME-03/04 trend chart | ✗ (not yet installed) | target 41.26.0 | none — required for HOME-03; no viable "static chart" fallback given D-19's locked scrub-gesture requirement |
| `@shopify/react-native-skia` | victory-native peer dep | ✗ (not yet installed) | target ^2.6.9 (pinned) | none |
| `react-native-svg` | HSS ring (D-01/D-04) | ✗ (not yet installed) | target 15.15.5 | none — ring is a hard requirement of the phase's signature component |
| `@react-native-community/datetimepicker` | RUN-04 date sheet | ✗ (not yet installed) | target 9.1.0 | Could fall back to a custom modal date grid, but D-13 explicitly specifies "native date sheet" — no fallback recommended |
| Physical iOS device / EAS dev build | All native-module verification (op-sqlite, HealthKit precedent, now Skia/svg/datetimepicker) | Unknown (not probed — requires on-device access outside this research session) | — | none — Expo Go is confirmed incompatible with this stack (TECH-STACK.md, CLAUDE.md) |

**Missing dependencies with no fallback:**
- `victory-native`, `@shopify/react-native-skia`, `react-native-svg`, `@react-native-community/datetimepicker` — all must be installed via `npx expo install` + a native rebuild before this phase's UI can be exercised on-device.

**Missing dependencies with fallback:**
- None beyond the datetimepicker note above (fallback explicitly not recommended given the locked D-13 decision).

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | `vitest 4.1.9` (packages/engine, packages/db, packages/shared only — VERIFIED via `vitest.config.mts` files present in those three packages) |
| Config file | `packages/db/vitest.config.mts` (closest analog for any new pure-logic tests this phase adds) |
| Quick run command | `pnpm --filter @apsis/db test` / `pnpm --filter @apsis/engine test` |
| Full suite command | `pnpm -r test` (repo root, runs all three package suites) |

**Gap carried from Phase 3 (STATE.md, unresolved):** `apps/mobile` has no component/integration
test harness — expo-router focus/stack regressions (like the Phase 3 P10 stacked-screen loop)
are only catchable on-device. This gap is **not** closed by this phase; on-device UAT remains the
verification method for all screen-level Phase 4 work (run form, Home, History).

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| RUN-01..06 | Run entry form fields, save flow | manual-only (on-device UAT) | — | N/A — no RN component harness (documented gap) |
| HOME-01/02 | Today's readiness band + HSS render correctly from `load_daily` | manual-only (on-device UAT) | — | N/A |
| HOME-03/04 | Trend chart renders 28 days; calibrating state before 14 days | manual-only (on-device UAT) for rendering; **unit-testable** for the underlying data-shaping logic | `pnpm --filter @apsis/db test` (new test file, see Wave 0 Gaps) | ❌ Wave 0 |
| HOME-05/06 | Day-grouped history + double-session labeling | **unit-testable** for the `dailyHSS`/gap-fill/session-count logic (pure functions); manual-only for the accordion UI | `pnpm --filter @apsis/db test` | ❌ Wave 0 |
| `recomputeLoadDaily` pipeline (net-new, not a numbered requirement but the phase's highest-risk logic) | Contiguous gap-filling, full-history fold, upsert correctness | **unit-testable** — pure input/output over a fabricated `{localDate, hss}[]` array, independent of a live op-sqlite connection (same `sqlite-proxy` pattern `packages/db/src/queries.ts`'s existing builders use for testability) | `pnpm --filter @apsis/db test` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `pnpm --filter @apsis/db test` (fast, covers any new query-builder/recompute-logic tests)
- **Per wave merge:** `pnpm -r test` (full monorepo suite)
- **Phase gate:** Full suite green, plus on-device UAT walkthrough of RUN-01..06 and HOME-01..06 (per the existing project pattern — Phase 3's LIFT-05 was explicitly deferred to phase UAT for the same class of on-device-only behavior)

### Wave 0 Gaps
- [ ] `packages/db/src/__tests__/recompute-load-daily.test.ts` (or similar) — covers the
  gap-filling + `dailyHSS` + `computeLoadTrendSeries` composition described in Pattern 1, using
  a fabricated in-memory `{localDate, hss}[]` array (no live op-sqlite connection needed,
  mirroring `packages/db/src/__tests__/previous-session-query.test.ts`'s existing
  `sqlite-proxy`-testable style)
- [ ] `packages/db/src/__tests__/session-counts.test.ts` — covers the day-grouped session-count
  query builder (HOME-05)
- [ ] Framework install: none — vitest already present in `packages/db`

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No | v1.0 is a fully offline, single-user, no-account app (REQUIREMENTS.md "Out of Scope") |
| V3 Session Management | No | No network sessions exist |
| V4 Access Control | No | Single local user, no multi-tenant data |
| V5 Input Validation | Yes | Clamp-and-warn pattern (D-15), already established in `packages/engine`'s `clampRange` + this phase's UI-level "are you sure?" heuristics (pace <2:30/km, HR >220) — both layers are independent and should not be conflated (see Pitfalls) |
| V6 Cryptography | No | No cryptographic operations in this phase's scope |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| SQL injection via raw `sql` template literals with interpolated user input (note field, distance/duration/HR values) | Tampering | Parameterized drizzle query builders exclusively — the existing project convention (`packages/db/src/queries.ts`'s doc comment: "every query here is a parameterized drizzle builder — no raw sql template literals with interpolated user-supplied values", T-1-01) must extend to every new query this phase adds, including the `load_daily` upsert and the new note-field insert |
| Raw error/stack-trace leakage to the user | Information Disclosure | Existing pattern already followed throughout the codebase: `console.error` for developer diagnostics, a hardcoded generic string for the user-facing message (T-03-08) — reuse this exactly for the new run-save and recompute error paths |

## Sources

### Primary (HIGH confidence — read directly from the installed codebase this session)
- `packages/engine/src/trend.ts`, `daily.ts`, `endurance.ts`, `session.ts`, `index.ts` — engine API surface, EWMA/calibrating-gate/double-penalty behavior
- `packages/db/src/schema.ts`, `queries.ts`, `migrations.ts` — schema gaps (`workout.note` missing, `load_daily` never written), existing query-builder conventions
- `packages/shared/src/units.ts`, `index.ts` — existing conversion/formatting helpers
- `apps/mobile/stores/sessionStore.ts`, `lib/commitSet.ts`, `lib/finishWorkout.ts`, `app/session/finish.tsx`, `app/(tabs)/log/index.tsx`, `app/(tabs)/_layout.tsx`, `app/(tabs)/index.tsx`, `app/_layout.tsx` — existing write→recompute pattern, tab structure, `GestureHandlerRootView` placement
- `apps/mobile/components/session/SetRow.tsx`, `LiveHssHeader.tsx`, `HSSBreakdownSheet.tsx`, `ScreenHeader.tsx` — reusable ledger/instrument-readout/breakdown-sheet patterns
- `apps/mobile/constants/theme.ts`, `Colors.ts` — live design tokens
- `apps/mobile/package.json` — actually-installed dependency versions (cross-checked against TECH-STACK.md's aspirational numbers; drift found and documented)
- `node_modules/drizzle-orm/sqlite-core/query-builders/insert.d.ts` — `onConflictDoUpdate` signature, verified directly against the installed type declarations
- `npm view` (victory-native, @shopify/react-native-skia, react-native-svg, @react-native-community/datetimepicker) — current registry versions, publish dates, peer dependencies
- `gsd-tools query package-legitimacy check` — package legitimacy verdicts for all four new dependencies

### Secondary (MEDIUM confidence)
- [Victory Native — Chart Gestures](https://nearform.com/open-source/victory-native/docs/cartesian/chart-gestures) — `useChartPressState`/`CartesianChart` scrub-tooltip API shape [CITED]
- [Victory Native — Getting Started / Installation](https://nearform.com/open-source/victory-native/docs/getting-started/) — peer-dependency install guidance, Expo compatibility note [CITED]

### Tertiary (LOW confidence)
- None used without cross-checking against either the installed codebase or an official docs source.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — every version/peer-dependency claim verified via `npm view` and/or installed `package.json`/`node_modules` this session
- Architecture (load_daily gap + recompute pipeline design): MEDIUM-HIGH — the *gap itself* is HIGH confidence (directly verified via grep of the actual codebase); the *recommended pipeline shape* is MEDIUM (sound application of the engine's documented, tested API, but the exact batch-upsert SQL idiom is flagged as an open question/assumption pending an on-device spike)
- Pitfalls: HIGH for project-specific items (sourced from STATE.md's own logged Phase 3 lessons and this session's direct codebase reads); MEDIUM for the victory-native/Skia-specific items (sourced from official docs, not yet exercised on-device in this repo)

**Research date:** 2026-07-10
**Valid until:** ~2026-08-09 (30 days — npm-ecosystem package versions and this codebase's own state both move fast enough that a stale re-check is warranted before reusing this document for a later phase)
