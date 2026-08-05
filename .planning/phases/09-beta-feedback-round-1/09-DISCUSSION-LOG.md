# Phase 9: Beta feedback round 1 - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-08-04
**Phase:** 09-beta-feedback-round-1
**Areas discussed:** Units-pref split semantics, Food quantity oz/lb entry, Keyboard/Done fix approach, Onboarding explainer step, Lifting logger delete-exercise (owner-added), Session-screen keyboard safety (owner-added), Rest-timer notification bug (owner-added)

---

## Units-pref split semantics

| Option | Description | Selected |
|--------|-------------|----------|
| Weight vs distance (2 prefs) | Body & lifts = weight-based; Runs = distance-based | |
| Lifting screens vs running screens | Surface-based split | |
| Three prefs: lifts / body / runs | Separate lift-load, bodyweight, and run units | ✓ |

**User's choice:** Three prefs: lifts / body / runs

| Option | Description | Selected |
|--------|-------------|----------|
| One choice + mixed option | Single Metric/Imperial sets all three; "Mixed" expands three toggles | ✓ |
| Three rows on one screen | Explicit but heavier step | |
| Single choice, refine in Settings | Split hidden at first run | |

**User's choice:** One choice + mixed option (recommended)

| Option | Description | Selected |
|--------|-------------|----------|
| Three rows, always visible | Lifts / Bodyweight / Runs rows in Settings | ✓ |
| Master toggle + expandable detail | One row showing Metric/Imperial/Mixed | |
| Units section screen | Dedicated sub-screen | |

**User's choice:** Three rows, always visible (recommended)

| Option | Description | Selected |
|--------|-------------|----------|
| Copy old value to all three | Silent seed from existing units value | ✓ |
| Copy + prompt once | Seed + one-time review notice | |
| Reset to metric, announce | Fresh defaults, flips imperial users | |

**User's choice:** Copy old value to all three (recommended)

---

## Food quantity oz/lb entry

| Option | Description | Selected |
|--------|-------------|----------|
| g / oz / lb segments | Three-segment control beside the field | |
| Tap unit to cycle | Suffix cycles units | |
| Follows units pref only | No in-sheet control | |

**User's choice:** FREEFORM — expand the unit set to g, kg, oz, lb, tsp, tbsp
**Notes:** Owner expanded scope beyond the roadmap's oz/lb wording.

| Option | Description | Selected |
|--------|-------------|----------|
| Serving-data based, else hidden | tsp/tbsp only with a real grams-per-volume basis | ✓ |
| Water-standard approximation | Fixed 5g/15g, wrong for oils/flours | |
| Small density table | Curated densities + fuzzy matching | |

**User's choice:** Serving-data based, else hidden (recommended)

| Option | Description | Selected |
|--------|-------------|----------|
| Chip row under input | Compact chips, conditional availability | ✓ |
| Tappable unit → mini sheet | Second modal layer | |
| Tap unit to cycle | Six-step cycle, tedious | |

**User's choice:** Chip row under input (recommended)

| Option | Description | Selected |
|--------|-------------|----------|
| Last-used per food, else pref | Per-food memory, bodyweight-pref fallback | ✓ |
| Bodyweight pref always | Predictable, no memory | |
| Always grams | Universal default | |

**User's choice:** Last-used per food, else pref (recommended)

| Option | Description | Selected |
|--------|-------------|----------|
| Confirm sheet only | What the feedback named | |
| Confirm sheet + quick-add | Slightly wider | |
| Everywhere grams appear | Sheet + quick-add + custom food + recipe ingredients | ✓ |

**User's choice:** Everywhere grams appear
**Notes:** Chips apply to quantity fields only — custom-food per-100g macro basis stays grams.

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, serving chip | qty × servingGrams → grams | ✓ |
| No — hint only | Passive text hint as today | |

**User's choice:** Yes, serving chip (recommended)

---

## Keyboard/Done fix approach

| Option | Description | Selected |
|--------|-------------|----------|
| Done bar above keyboard | iOS input-accessory bar; tap-outside also enabled | ✓ |
| Tap-outside only | No visible button | |
| Done button in the sheet | Competes with Log button | |

**User's choice:** Done bar above keyboard (recommended)

| Option | Description | Selected |
|--------|-------------|----------|
| Qty + macros + Log button | Everything above the keyboard; log without dismissing | ✓ |
| Qty row + macro preview | Done reveals Log | |
| Just the quantity row | Minimum fix | |

**User's choice:** Qty + macros + Log button (recommended)

| Option | Description | Selected |
|--------|-------------|----------|
| All decimal-pad inputs | Shared component, app-wide rollout | ✓ |
| Food confirm sheet only | Smallest diff | |
| Nutrition surfaces only | Nutrition-side only | |

**User's choice:** All decimal-pad inputs (recommended)

---

## Onboarding explainer step

| Option | Description | Selected |
|--------|-------------|----------|
| First, before any inputs | Pitch at peak attention, motivates threshold asks | ✓ |
| Last, before landing on TODAY | Context lands at the dashboard | |
| Split: hook first, stats last | Two touchpoints | |

**User's choice:** First, before any inputs (recommended)

| Option | Description | Selected |
|--------|-------------|----------|
| Swipeable cards | Three cards, page dots, skip | ✓ |
| Single scrollable screen | Dense one-pager | |
| One rich visual screen | Annotated mock dashboard | |

**User's choice:** Swipeable cards (recommended)

| Option | Description | Selected |
|--------|-------------|----------|
| Athlete-literate | ATL/CTL/TSB named directly | |
| Conceptual only | Plain-language metaphors | |
| Two-layer | Conceptual cards + "the math" expandable | ✓ |

**User's choice:** Two-layer

| Option | Description | Selected |
|--------|-------------|----------|
| Skippable + in Settings | Skip affordance + "How Apsis works" Settings row | ✓ |
| Skippable, onboarding-only | Wizard only | |
| Mandatory swipe-through | No skip | |

**User's choice:** Skippable + in Settings (recommended)

| Option | Description | Selected |
|--------|-------------|----------|
| Real components, sample data | HssRing / ReadinessLight / mini TrendChart | ✓ |
| Text-first mono cards | No mockups | |
| Custom illustrations | Purpose-drawn diagrams | |

**User's choice:** Real components, sample data (recommended)

| Option | Description | Selected |
|--------|-------------|----------|
| Settings only, silent | Consistent with silent units migration; release notes point at it | ✓ |
| One-time TODAY notice | Dismissible pointer card | |

**User's choice:** Settings only, silent (recommended)

---

## Lifting logger delete-exercise (owner-added during discussion)

**Origin:** Freeform feedback at the wrap-up gate: "when you are logging a lift you cannot
delete an exercise only a set."

| Option | Description | Selected |
|--------|-------------|----------|
| Overflow menu on card | "···"/× in ExerciseCard header; confirm when committed sets exist | ✓ |
| Swipe card to delete | Hidden gesture | |
| Long-press for actions | Invisible until discovered | |

**User's choice:** Overflow menu on card (recommended)

---

## Session-screen keyboard safety (owner-added during discussion)

**Origin:** Same freeform feedback: "after you add enough exercises the keyboard covers
most of the latest exercise."
**Resolution:** Folded into the app-wide keyboard decisions — focused set field
auto-scrolls above the keyboard; shared Done bar applies. Mechanism is Claude's discretion.

---

## Rest-timer notification bug (owner-added during discussion)

**Origin:** Freeform feedback at the final gate: starting a new set before rest ends
(without Skip) leaves stale notifications firing 3–4 deep.
**Resolution:** Fully specified fix, no options needed — committing a new set cancels the
prior countdown + scheduled notification. Root cause verified during discussion:
`startRestTimer` (sessionStore.ts:304) nulls `restNotificationId` without cancelling.

---

## Claude's Discretion

- Converted-quantity display precision and chip ordering
- Bottom-sheet keyboard mechanics for the qty+macros+Log visibility target
- Session-screen scroll-into-view mechanism
- Explainer card copy drafting (owner reviews)
- Persistence mechanism for last-used-per-food unit
- Units migration shape (columns vs rename) within the seed-from-old-value behavior

## Deferred Ideas

None — the three extra items raised during discussion were folded into phase scope by the
owner rather than deferred.
