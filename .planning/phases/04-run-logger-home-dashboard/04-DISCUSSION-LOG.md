# Phase 4: Run Logger & Home Dashboard - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-10
**Phase:** 4-Run Logger & Home Dashboard
**Areas discussed:** Design language, Run entry form, Home layout + trend chart, History & day view, Erg/conditioning behavior, Chart tooltip, Ring/tile taps, Tab bar naming

---

## Design language for Phase 4

| Option | Description | Selected |
|--------|-------------|----------|
| Hybrid | Design-doc hero ring on home + ledger language for forms/rows/history | ✓ |
| Extend the ledger everywhere | No ring; instrument readouts only | |
| Follow DESIGN-SYSTEM.md as written | Full HUD spec incl. chips | |

**User's choice:** Hybrid (recommended)

Follow-ups in this area:
- Readiness presentation: **Status light under ring** (pulsing dot + mono label; steel ring + BUILDING TREND · DAY N/14 while calibrating) over ring-takes-band-color and text-only
- Run form styling: **Ledger fields** over conventional form
- Finish screens: **84px mini-ring on both run and lift finish** over number readouts / you-decide
- Ring animation: **Animate once per day** over every-visit / only-on-change
- Daily empty state: **Ring shows 0 + prompt, readiness always live** over readiness-first
- Tab structure: **4 tabs — add History** over keep-3 (recommended) and 5-tab design-doc layout — user chose more nav than recommended
- Plate-orbit mark: **"Animate but no runner just the plate orbit"** (free-text) — deviation from design doc §4; placement chosen: **calibrating state**
- One-volt discipline: **Ring owns volt** (semantic state colors allowed on readiness light)

---

## Run entry form

| Option | Description | Selected |
|--------|-------------|----------|
| Single screen | One ledger card, all fields visible | ✓ |
| Two steps | Essentials then extras | |
| Wizard | One input per screen | |

**User's choice:** Single screen (recommended)

Follow-ups:
- Duration entry: **Smart digit entry** (right-to-left h:mm:ss fill) over separate H·M·S fields / wheel picker
- Live pace: **Pace readout row** (mono, live per keystroke, /KM·/MI·/500M per type) over inline third field
- Date + note: **Quiet row + sheet** (mono TODAY row → native date sheet; single growing note field) over always-visible
- Save flow: **Finish screen with mini-ring** over inline reveal
- Validation: **Clamp-and-warn** (duration only required; D-03 continuity) over require-distance-for-run/erg

---

## Home layout + trend chart

| Option | Description | Selected |
|--------|-------------|----------|
| Ring → stats → chart | HUD hierarchy: state then evidence | ✓ |
| Ring → chart → stats | Trend as second element | |

**User's choice:** Ring → stats → chart (recommended)

Follow-ups:
- Chart series: **2 lines + TSB readout** (ATL bone, CTL ash) over 3 lines / band fill
- Interactivity: **Scrub with tooltip** — user explicitly chose OVER the static-v1 recommendation
- Stat tiles: **ATL · CTL · TSB** over load+volume mix
- Calibrating chart: **Growing chart + day counter** over hidden-until-day-14
- Today's session rows: **Design-doc session rows** (title + mono metadata + right-aligned HSS) over minimal rows

---

## History & day view

| Option | Description | Selected |
|--------|-------------|----------|
| Day rows → expand inline | Accordion days, session tap pushes detail | ✓ |
| Day rows → push day screen | Dedicated day detail screen | |
| Flat session list | Date separators only | |

**User's choice:** Day rows → expand inline (recommended)

Follow-ups:
- Double-session labeling: **Mono chip + adjusted math** ("2 SESSIONS · ADJUSTED" chip; expansion shows raw values + "INCL. +N DOUBLE-DAY LOAD")
- Rest days: **Show rest days quietly** (thin ash REST rows) — user chose over the hide-rest-days recommendation
- Paging: **Infinite scroll by month** with mono month headers
- Edit/delete: **Delete only, recompute forward** (soft-delete + load_daily recompute) over edit+delete / read-only

---

## Second round (user-requested extra areas)

- Erg/conditioning form behavior: **Fields adapt per type** — RUN km/mi + /KM·/MI pace; ERG meters + /500M split; CONDITIONING duration/HR/note only
- Chart tooltip content: **Date + all four values** (JUL 8 · HSS 142 · ATL 41 · CTL 55 · TSB +14), snap-to-day, rest days show HSS 0
- Ring & tile taps: **Ring → today-breakdown sheet; tiles → one-line mono explainers**
- Tab bar naming: **TODAY · LOG · HISTORY · SETTINGS** (HOME renames to TODAY, plate glyph icon)

---

## Claude's Discretion

- Tooltip snap mechanics and axis label density
- Stat-tile explainer copy
- History month-header treatment
- Optional erg distance quick-presets (500/1000/2000m)

## Deferred Ideas

- Editing past sessions (v1.1 — stale-score story needed)
- 5-tab layout (TRENDS · PROFILE split)
- Plate-orbit in boot splash / home header (only calibrating placement chosen)
- Run-type chips (Z2 · TEMPO · INTERVALS · LONG) — not a v1.0 requirement
- Weekly tonnage/mileage stat tiles (needs aggregation queries)
