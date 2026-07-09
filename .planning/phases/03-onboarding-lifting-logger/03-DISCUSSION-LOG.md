# Phase 3: Onboarding & Lifting Logger - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-09
**Phase:** 03-onboarding-lifting-logger
**Areas discussed:** Onboarding & threshold capture, Set-entry ergonomics, Bodyweight movements (deferred D-12), Session flow & rest timer, Navigation & landing screen, Settings scope, HSS breakdown & warnings

---

## Onboarding & threshold capture

| Option | Description | Selected |
|--------|-------------|----------|
| Multi-step wizard | One input per screen (3–5 steps), progress indicator | ✓ |
| Single scrollable form | All four inputs on one screen | |
| Two screens: about-you + thresholds | Grouped easy vs needs-thought inputs | |

**User's choice:** Multi-step wizard (recommended)

| Option | Description | Selected |
|--------|-------------|----------|
| Estimate from a recent effort | 'I know my numbers' OR estimate path | ✓ |
| Direct entry with helper text | Manual entry with explainers | |
| Defaults by sex/age | Silent population defaults | |

**User's choice:** Estimate from a recent effort (recommended)

| Option | Description | Selected |
|--------|-------------|----------|
| Mandatory, one-time | Wizard blocks until complete on first launch | ✓ |
| Skippable — log now, profile later | Readiness prompts for profile | |
| Partial skip — thresholds only | Sex + bodyweight required, thresholds optional | |

**User's choice:** Mandatory, one-time (recommended)

| Option | Description | Selected |
|--------|-------------|----------|
| Units in wizard + settings | Edits apply to future only | ✓ |
| Settings only, default metric | One less wizard step | |
| Units in wizard; edits recompute history | Retroactive recompute cascade | |

**User's choice:** Units in wizard + settings (recommended)

| Option | Description | Selected |
|--------|-------------|----------|
| Race time picker | Distance + finish time → threshold pace | ✓ |
| Recent comfortable-hard pace | Direct ~1-hour pace question | |
| Both options in the wizard | Picker + direct pace tab | |

**User's choice:** Race time picker (recommended)

| Option | Description | Selected |
|--------|-------------|----------|
| Age-based formula | (220 − age) × 0.90 | |
| From max HR if known | ×0.90, age formula fallback | ✓ |
| Leave HR blank — pace only | resolveIF pace fallback | |

**User's choice:** From max HR if known

| Option | Description | Selected |
|--------|-------------|----------|
| Soft ranges, warn only | Inline 'are you sure?', never blocks | ✓ |
| Hard limits, block save | Reject out-of-range | |
| No validation | Trust user, engine clamps | |

**User's choice:** Soft ranges, warn only (recommended)

| Option | Description | Selected |
|--------|-------------|----------|
| Yes — review screen | Final step shows all values, tap-to-edit | ✓ |
| No — save on last input | One less screen | |

**User's choice:** Yes — review screen (recommended)

---

## Set-entry ergonomics

| Option | Description | Selected |
|--------|-------------|----------|
| Steppers + tap-to-type | Pre-filled +/− steppers, tap number for keypad | ✓ |
| Always keypad | Hevy-style keypad flow | |
| Scroll wheels | Picker wheels | |

**User's choice:** Steppers + tap-to-type (recommended)

| Option | Description | Selected |
|--------|-------------|----------|
| Inline per set row | 6·7·8·9·10 segment per row, last-used pre-selected | ✓ |
| One shared row above keyboard | Single docked RPE bar | |
| Per-exercise default + per-set override | Stamp-all with chip override | |

**User's choice:** Inline per set row (recommended)

| Option | Description | Selected |
|--------|-------------|----------|
| Checkmark per row + warmup toggle | ✓ commits set, 'W' chip toggles warmup | ✓ |
| Auto-commit on entry | Set counts when values exist | |
| Swipe gestures | Swipe complete/delete, long-press warmup | |

**User's choice:** Checkmark per row + warmup toggle (recommended)

| Option | Description | Selected |
|--------|-------------|----------|
| Search-first sheet w/ recents | Auto-focused search, recents above A–Z library | ✓ |
| Category drill-down | Body-part categories | |
| Flat searchable list screen | Full-screen list, no recents | |

**User's choice:** Search-first sheet w/ recents (recommended)

| Option | Description | Selected |
|--------|-------------|----------|
| '+ Add set' + swipe-to-delete | Clone previous set, iOS swipe delete | ✓ |
| Add + explicit delete icons | × on each row | |
| Edit mode toggle | Mode switch for delete/reorder | |

**User's choice:** '+ Add set' button + swipe-to-delete (recommended)

| Option | Description | Selected |
|--------|-------------|----------|
| Native lb steps, store exact kg | 5 lb steps, exact kg storage, display round-trips | ✓ |
| kg-native steps converted | ±2.5 kg always, odd lb display | |
| Round-trip rounding | Store kg rounded 0.5 | |

**User's choice:** Native lb steps, store exact kg (recommended)

| Option | Description | Selected |
|--------|-------------|----------|
| You decide | Claude's discretion on wiring | |
| Persist per set + recompute | Write to SQLite per checkmark, crash-safe | ✓ |
| In-memory until save | Zustand until Finish, one transactional write | |

**User's choice:** Persist per set + recompute

| Option | Description | Selected |
|--------|-------------|----------|
| Empty + keypad focus | Blank first set for never-logged exercise | ✓ |
| Sensible defaults per exercise | Starter loads in seed data | |
| Zero-filled | 0 kg × 0 reps | |

**User's choice:** Empty + keypad focus (recommended)

---

## Bodyweight movements (deferred D-12)

| Option | Description | Selected |
|--------|-------------|----------|
| BW × per-exercise factor + added | Literature factors, effective load computed | ✓ |
| Full bodyweight + added | 100% BW for every movement | |
| User enters load manually | Barbell-style manual entry | |

**User's choice:** BW × per-exercise factor + added (recommended)

| Option | Description | Selected |
|--------|-------------|----------|
| '+kg added' field, default 0 | Added weight semantics, effective shown subtly | ✓ |
| Show computed effective load | Full effective load editable | |
| Hide load entirely for BW | Reps + RPE only, expander for weight | |

**User's choice:** '+kg added' field, default 0 (recommended)

| Option | Description | Selected |
|--------|-------------|----------|
| Same Epley on effective load | One code path for all movements | |
| Rep-max table for high-rep BW | Brzycki/table hybrid above ~12 reps | ✓ |
| You decide | Claude's discretion | |

**User's choice:** Rep-max table for high-rep BW

| Option | Description | Selected |
|--------|-------------|----------|
| Strength w/ distance-as-reps | Meters in the reps field | |
| Route to conditioning (Phase 4) | Endurance segments later | |
| Time-based set entry | Load + duration + RPE row, bespoke stress | ✓ |

**User's choice:** Time-based set entry

| Option | Description | Selected |
|--------|-------------|----------|
| RPE-scaled duration | durationMin × (RPE/10)² × k + load multiplier | ✓ |
| Effective-load rep equivalence | 10 s ≈ 1 rep through strength formula | |
| You decide | Research literature, planner picks | |

**User's choice:** RPE-scaled duration (recommended)

| Option | Description | Selected |
|--------|-------------|----------|
| Columns on exercise table | bwFactor + entryMode via migration | ✓ |
| Hardcoded map in app code | TS map exerciseId → factor/mode | |
| You decide | Claude's discretion | |

**User's choice:** Columns on exercise table (recommended)

| Option | Description | Selected |
|--------|-------------|----------|
| Profile BW at log time, stored on set | Historical sets never drift | ✓ |
| Always current profile BW | Live recompute from profile | |
| Ask per session | Prompt bodyweight at session start | |

**User's choice:** Profile BW at log time, stored on set (recommended)

| Option | Description | Selected |
|--------|-------------|----------|
| BW factor + implement as 'added' | Added = what you're holding | ✓ |
| Implement weight only (factor 0) | Barbell-style implement load | |
| You decide | Classify during planning | |

**User's choice:** BW factor + implement as 'added' (recommended)

---

## Session flow & rest timer

| Option | Description | Selected |
|--------|-------------|----------|
| One active screen, exercise cards | Scrollable cards, sticky header, Finish | ✓ |
| Exercise-at-a-time pager | One exercise per screen | |
| Checklist from a template | Pre-build then run | |

**User's choice:** One active screen, exercise cards (recommended)

| Option | Description | Selected |
|--------|-------------|----------|
| Sticky header number + tick animation | Count-up on checked set, tap for breakdown | ✓ |
| Header number only, no breakdown | No drill-down | |
| Floating pill above Finish | Bottom-right pill | |

**User's choice:** Sticky header number + tick animation (recommended)

| Option | Description | Selected |
|--------|-------------|----------|
| Global default + per-exercise override | Settings default, per-exercise memory | ✓ |
| Global only | Single duration | |
| Per-set picker | Choose per set | |

**User's choice:** Global default + per-exercise override (recommended)

| Option | Description | Selected |
|--------|-------------|----------|
| Finish screen + hard-delete discard | Real delete + load_daily recompute | |
| Save silently, toast HSS | Toast only | |
| Finish screen + archive discard | Soft-delete, recoverable | ✓ |

**User's choice:** Finish screen + archive discard

| Option | Description | Selected |
|--------|-------------|----------|
| Safety net only, no UI | deletedAt flag, no recovery screen in v1.0 | ✓ |
| Undo snackbar (30s) | Temporary undo | |
| Full trash screen | Settings → discarded list | |

**User's choice:** Safety net only, no UI (recommended)

| Option | Description | Selected |
|--------|-------------|----------|
| Local notification on expiry | endsAt timestamps + expo-notifications | ✓ |
| In-app only | No notification | |
| Live Activity / Dynamic Island | ActivityKit — v1.1 material | |

**User's choice:** Local notification on expiry (recommended)

| Option | Description | Selected |
|--------|-------------|----------|
| Auto-resume prompt | Resume / Finish now / Discard on launch | ✓ |
| Silent auto-resume | Straight back into session | |
| Auto-finish stale sessions | Finalize after N hours | |

**User's choice:** Auto-resume prompt (recommended)

---

## Navigation & landing screen

| Option | Description | Selected |
|--------|-------------|----------|
| Tabs now: Home / Log / Settings | Real tab bar this phase, Phase 4 fills Home | ✓ |
| Single stack, workout-centric | No tabs until Phase 4 | |
| Tabs: Log / History / Settings | History first-class now | |

**User's choice:** Tabs now: Home / Log / Settings (recommended)

| Option | Description | Selected |
|--------|-------------|----------|
| Today + recent sessions list | Sessions + HSS + Start CTA | |
| Placeholder 'coming soon' | Branded empty state pointing to Log | ✓ |
| Mini readiness preview | Scope creep into Phase 4 | |

**User's choice:** Placeholder 'coming soon'

---

## Settings scope

| Option | Description | Selected |
|--------|-------------|----------|
| Profile + units + timer only | Exactly requirement-driven scope | ✓ |
| Add notification preferences | Timer sound/haptic toggles | |
| Add data management | Export/delete-all | |

**User's choice:** Profile + units + timer only (recommended)

---

## HSS breakdown & warnings

| Option | Description | Selected |
|--------|-------------|----------|
| Per-exercise subtotals | Stress contribution + set count per exercise | ✓ |
| Per-set full detail | Every set's stress, e1RM, clamps | |
| Total + top contributor only | Number + 'mostly from: X' | |

**User's choice:** Per-exercise subtotals (recommended)

| Option | Description | Selected |
|--------|-------------|----------|
| Subtle badge + finish screen list | ⚠ on set row + summary list, never interrupts | ✓ |
| Toast per warning | Transient toast per warning | |
| Silent (log only) | Stored, never shown | |

**User's choice:** Subtle badge + finish screen list (recommended)

---

## Claude's Discretion

- Wizard step count/ordering/copy; race-pace conversion constants; age-fallback input design
- State management wiring (zustand install), query patterns, load_daily recompute mechanics
- Rest-timer banner visuals, tick animation, haptics
- Exact BW factor values (literature-verified), rep-max table choice, carry-stress k calibration
- Migration mechanics for new columns; breakdown sheet layout; empty states

## Deferred Ideas

- Live Activity / Dynamic Island rest-timer countdown (v1.1)
- Trash/recovery UI for discarded sessions (v1.1)
- Notification preference toggles in Settings
- Data export / delete-all-data (Phase 6 privacy prep or v1.1)
