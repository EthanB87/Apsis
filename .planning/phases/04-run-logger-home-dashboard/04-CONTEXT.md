# Phase 4: Run Logger & Home Dashboard - Context

**Gathered:** 2026-07-10
**Status:** Ready for planning

<domain>
## Phase Boundary

A user logs a run/erg/conditioning session in under a minute (activity type, distance +
duration with live pace, optional HR/note, editable date) and sees session HSS on a finish
screen. The home tab becomes a live dashboard: 200px HSS ring + readiness light above the
fold, ATL/CTL/TSB stat tiles, a scrubbing 28-day trend chart, and today's session rows.
History becomes its own tab: day-grouped ledger with double-session penalty labeling.
Requirements: RUN-01..06, HOME-01..06.

</domain>

<decisions>
## Implementation Decisions

### Design language (Phase 4 surfaces)
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

### Run entry form (RUN-01..06)
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

### Home layout + trend chart (HOME-01..04)
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

### History & day view (HOME-05..06)
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

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Design
- `DESIGN-SYSTEM.md` — The palette (binding everywhere), HSS ring spec (§5), status-light
  copy, stat-tile pattern, session-row pattern, chart styling (§5), tab-bar language.
  NOTE: component specs were superseded by the user for the LOGGING surface (Phase 3
  ledger design); for Phase 4 surfaces the doc applies per the D-01 hybrid decision, with
  deviations D-07 (4 tabs, not 5) and D-08 (plate orbit without runner).
- `.planning/phases/03-onboarding-lifting-logger/03-UI-SPEC.md` — Amended Set-row section
  documents the shipped ledger design that D-03/D-23 rows must match.
- `apps/mobile/constants/theme.ts` — Live token source (Spacing/Typography/Radius/Mono);
  contract scale (md=12) adopted in Phase 3 plan 03-11.

### Engine & data
- `packages/engine/src/trend.ts` — ATL/CTL/TSB EWMA + readinessBand (signature: (tsb,
  ctl, opts { historyDays }, cfg?)) — the 14-day calibrating gate lives here.
- `packages/engine/src/endurance.ts`, `packages/engine/src/session.ts`,
  `packages/engine/src/daily.ts` — enduranceStressDetailed per-segment, sessionHSS,
  dailyHSS with doublePenalty (D-26's "+N DOUBLE-DAY LOAD" math comes from here).
- `packages/db/src/schema.ts` — endurance_segment already has activityType/distanceM/
  durationS/avgHr; check whether a note/tag column exists for RUN-05 (migration likely).
- `packages/shared/src/units.ts` — exact km↔mi, kg↔lb converters (Phase 3 added
  fractional-lb display helpers; pace formatting may need additions).

### Prior context
- `.planning/phases/03-onboarding-lifting-logger/03-CONTEXT.md` — D-03 soft validation,
  D-05 units policy (display-only conversion, future-only profile edits) — both carried
  forward into D-12/D-15.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `apps/mobile/components/session/` — ledger field styling (SetRow's inset value fields),
  LiveHssHeader instrument readouts, HSS breakdown sheet (D-24 reuses its pattern),
  finish-screen flow (D-14 extends it with the mini-ring).
- `apps/mobile/app/(tabs)/index.tsx` — Home placeholder explicitly waiting for HOME-*.
- Engine: trend/daily/endurance modules fully built and tested in Phase 2 — Phase 4 is
  purely a consumer.
- Rest-timer/notification and crash-resume infrastructure — do NOT touch; runs only in
  the lifting path.

### Established Patterns
- Focus-gated store access: any screen touching a session store must use useFocusEffect,
  never bare useEffect (Phase 3 stacked-screen loop lesson — logged in PROJECT.md).
- Write → recompute → UI reactive chain proven end-to-end in the lifting logger; the run
  save should ride the same load_daily recompute path.
- Soft-delete + forward recompute convention (workout.deletedAt) extends to D-29.
- Profile-units display conversion at the UI edge only; storage is always metric.

### Integration Points
- victory-native + @shopify/react-native-skia are NOT yet installed — the chart stack is
  locked in the tech-stack doc (victory-native 41.x, Skia ^2.x, reanimated 4 already
  present). Installation + Metro/Expo config is Phase 4 setup work; research the D-19
  scrub-tooltip gesture API specifically.
- Tab bar `(tabs)/_layout.tsx` gains the HISTORY tab and the TODAY rename (D-07).
- RUN-05 note field likely needs a schema migration (endurance_segment or workout level —
  planner decides; workout-level note serves conditioning sessions with no segment
  detail... verify against engine session shape).

</code_context>

<specifics>
## Specific Ideas

- "Animate but no runner, just the plate orbit" — the brand mark animates as nested
  plate ellipses orbiting slowly; the runner glyph from DESIGN-SYSTEM.md §4 is dropped.
- The user explicitly upgraded chart interactivity to scrub-with-tooltip over the
  recommended static v1 — treat the tooltip as a real requirement, not polish.
- The user explicitly chose showing rest days as quiet ash "REST" rows — the history
  ledger should read like a training calendar, not a highlights reel.
- Speed bar remains Strong/Hevy parity: "logs a run in under a minute" is the phase's
  headline criterion — the single-screen form with smart duration entry serves it.

</specifics>

<deferred>
## Deferred Ideas

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

</deferred>

---

*Phase: 4-Run Logger & Home Dashboard*
*Context gathered: 2026-07-10*
