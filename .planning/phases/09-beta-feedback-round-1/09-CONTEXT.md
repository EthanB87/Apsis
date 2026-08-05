# Phase 9: Beta feedback round 1 - Context

**Gathered:** 2026-08-04
**Status:** Ready for planning

<domain>
## Phase Boundary

TestFlight beta feedback (build 9) addressed and shipped in build 10, which supersedes
build 9 as the ASC submission candidate. The roadmap's four owner-approved items PLUS
three additional items the owner added during this discussion (same beta-feedback nature,
owner is the scope authority — ROADMAP.md's Phase 9 goal should be read as seven items):

1. **FoodConfirmSheet keyboard fix** — quantity input no longer hidden by the keyboard;
   Done/dismiss affordance added.
2. **Food quantity units** — quantity enterable in g / kg / oz / lb (+ tsp / tbsp / serving
   when the food's serving data supports it). Storage stays grams.
3. **Units preference split** — the single metric/imperial pref becomes THREE prefs
   (lifts / bodyweight / runs) via DB migration, so imperial lifts + km runs works end to end.
4. **Onboarding explainer** — swipeable cards explaining HSS, the readiness band, and
   trend statistics, first in the wizard and revisitable from Settings.
5. **(Owner-added)** Lifting logger: delete an entire exercise from an active session
   (today only sets are removable — `sessionStore` has no `removeExercise`).
6. **(Owner-added)** Lifting logger: session screen is keyboard-safe — the focused set
   field scrolls above the keyboard (plain `ScrollView` today, no avoidance).
7. **(Owner-added)** Rest-timer notification bug: committing a new set before the prior
   rest elapses must cancel the prior countdown AND its scheduled OS notification —
   today 3–4 stale notifications fire back-to-back.

After Phase 9, a new production EAS build (10) re-runs the 06-06 Task 3 beta gate; 06-07
ASC submission follows. Anything beyond these seven items is out of scope.

</domain>

<decisions>
## Implementation Decisions

### Units preference split (item 3)
- **D-01:** THREE unit preferences, not two: **lifts** (kg/lb for plate loads + volume
  stats), **bodyweight** (kg/lb for bodyweight entry/display), **runs** (km/mi for
  distance, pace, threshold pace). Every existing `units` call site maps to exactly one
  bucket. — **Reversibility:** costly — a DB migration adds the columns and ~12 call
  sites re-key to the right bucket; collapsing back later is another migration + sweep.
- **D-02:** Onboarding units step keeps the fast single Metric/Imperial choice (sets all
  three) and adds a third **"Mixed"** path that expands the three individual toggles
  inline. Zero added friction for the majority case.
- **D-03:** Settings replaces the single Units row with **three always-visible rows**
  (Lifts / Bodyweight / Runs).
- **D-04:** Migration seeds all three new prefs from the existing single `units` value —
  no display changes for build-9 testers on update, no prompt. Silent migration.

### Food quantity units (item 2)
- **D-05:** Unit set is **g, kg, oz, lb** always, plus **tsp, tbsp** and **serving** as
  conditional units. Storage stays grams (roadmap-locked).
- **D-06:** tsp/tbsp appear ONLY when the food's serving data yields a usable
  grams-per-volume basis (e.g. OFF/USDA serving "1 tbsp = 14g" or user-entered serving).
  NO fabricated densities, no water-standard approximation — macro honesty over
  convenience.
- **D-07:** **"Serving"** is a selectable unit chip whenever `servingGrams` exists
  (qty × servingGrams → grams), using the same conditional-availability mechanism as
  tsp/tbsp.
- **D-08:** Picker form: a compact **chip row under the quantity input** (g · kg · oz ·
  lb · tsp · tbsp · serving), conditional chips rendered only when available. Bone
  active-fill (Log button owns volt). Typed number reinterprets in the selected unit;
  macro preview recomputes live.
- **D-09:** Default unit on open: **last-used per food**, falling back to the bodyweight
  units pref (imperial → oz, metric → g) for first-time foods. Serves the ≤3-tap
  repeat-logging bar.
- **D-10:** Scope: unit chips go **everywhere a grams quantity is entered** — confirm
  sheet, quick-add, custom food creation, recipe ingredients. Nuance for planning: chips
  apply to QUANTITY fields only; custom-food macro definitions stay per-100g.

### Keyboard / Done fix (items 1 and 6)
- **D-11:** Done affordance is an **iOS input-accessory bar with a right-aligned Done
  button** above the decimal pad (the pad has no return key). Tap-outside dismiss also
  enabled.
- **D-12:** With the keyboard open in FoodConfirmSheet, the **quantity row, live macro
  preview, AND the volt Log button all stay visible** above the keyboard — type, watch
  macros update, log without dismissing.
- **D-13:** The Done accessory bar is built **once as a shared component** and rolls out
  to **all decimal-pad inputs app-wide** (food sheet, quick-add, custom food, run form,
  onboarding bodyweight, lifting set fields).
- **D-14:** Lifting session screen becomes keyboard-safe: the focused set field
  auto-scrolls above the keyboard (mechanism is Claude's discretion — the screen is a
  plain `ScrollView` today).

### Onboarding explainer (item 4)
- **D-15:** Placement: **first step of the wizard**, before any inputs — the pitch lands
  at peak attention and motivates the threshold HR/pace asks that follow.
- **D-16:** Format: **three swipeable cards** — HSS (one number for all training stress),
  readiness band (green/amber/red), trend (ATL/CTL/TSB + the 14-day calibration window) —
  page dots + Skip affordance.
- **D-17:** Depth: **two-layer** — conceptual card copy with an expandable "the math"
  detail on each card carrying the full ATL/CTL/TSB explanation. Terse mono voice.
- **D-18:** Visuals: cards render **real app components with representative sample data**
  (volt HSS ring, readiness light, mini trend chart) — what you learn is literally what
  TODAY shows.
- **D-19:** Skippable in onboarding + revisitable via a **"How Apsis works" row in
  Settings** reopening the same cards. Existing build-9 testers discover it via Settings
  only (silent, consistent with D-04); point testers at it in TestFlight release notes.

### Lifting logger: delete exercise (item 5)
- **D-20:** Each ExerciseCard header gets a small **overflow affordance ("···" or ×)
  opening "Remove exercise"** — explicit and discoverable, no hidden gesture. Removing an
  exercise with committed sets requires confirmation (mirrors the discard-session
  confirmation rule) and must also remove those committed sets from the DB (committed
  sets are already persisted mid-session).

### Rest-timer notification bug (item 7)
- **D-21:** Committing a new set before the prior rest elapses **cancels the prior
  countdown and its scheduled OS notification** before starting the new one — only the
  newest rest timer is ever live. Root cause located: `startRestTimer`
  (`apps/mobile/stores/sessionStore.ts:304`) nulls `restNotificationId` without
  cancelling the orphaned notification; `skipRest`/`addThirtySeconds` already cancel
  correctly — mirror their pattern.

### Claude's Discretion
- Display precision/rounding for converted quantities (oz decimals etc.) and chip ordering.
- Bottom-sheet keyboard mechanics (snap behavior, `keyboardBehavior` config) to satisfy D-12.
- Session-screen scroll-into-view mechanism (D-14).
- Explainer card copy drafting (within the DESIGN-SYSTEM.md mono voice; owner reviews).
- Where the last-used-per-food unit is persisted (e.g. a column on `food` vs a small
  key-value store) — must survive app restarts.
- Migration shape for the three unit prefs (new columns vs rename), provided D-04's
  seed-from-old-value behavior holds and the round-trip migration proof pattern is followed.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase scope & state
- `.planning/ROADMAP.md` — Phase 9 goal (4 roadmap items; this CONTEXT adds items 5–7),
  build-10 / 06-06 / 06-07 sequencing
- `.planning/STATE.md` — Roadmap Evolution entry for Phase 9; 06-06 Task 3 gate re-targets build 10

### Design language (binding)
- `DESIGN-SYSTEM.md` — void/volt palette, one-volt-per-screen rule, bone segmented
  controls, mono caption voice (explainer cards + chip rows are new brand surfaces)

### Units split surfaces (item 3)
- `packages/db/src/schema.ts` — `user_profile.units` enum ('metric'|'imperial') to split
- `packages/shared/src/units.ts` — existing pure conversion helpers (LB_PER_KG, KM_PER_MI,
  round-trip-exact display conversions) — extend, don't duplicate
- `apps/mobile/lib/settingsStore.ts` — zustand mirror of the units pref (becomes three)
- `apps/mobile/app/onboarding/units.tsx` — single-choice step gaining the Mixed path
- `apps/mobile/app/(tabs)/settings/index.tsx` — single Units toggle row → three rows
- Consumers to re-key by bucket: `apps/mobile/app/(tabs)/index.tsx`,
  `app/(tabs)/log/run.tsx`, `app/session/finish.tsx`, `app/session/detail.tsx`,
  `app/session/share.tsx`, `app/onboarding/bodyweight.tsx`,
  `app/onboarding/threshold-pace.tsx`, `app/nutrition-setup/index.tsx`,
  `components/onboarding/ProfileReview.tsx`, `components/session/ExerciseCard.tsx`

### Food quantity units (items 1–2)
- `apps/mobile/components/FoodConfirmSheet.tsx` — the confirm sheet (keyboard fix + chips)
- `apps/mobile/lib/logFood.ts` — `buildFoodLogRow` (qtyGrams stays the stored quantity)
- `apps/mobile/app/(tabs)/nutrition/log.tsx` — quick-add + custom food quantity fields
- `apps/mobile/app/(tabs)/nutrition/recipes.tsx` — recipe ingredient quantity fields

### Lifting logger (items 5–7)
- `apps/mobile/stores/sessionStore.ts` — `removeSet` (pattern for `removeExercise`),
  `startRestTimer` line ~304 (the orphaned-notification bug), `skipRest`/`addThirtySeconds`
  (correct cancel pattern)
- `apps/mobile/components/session/ExerciseCard.tsx` — card header (overflow affordance)
- `apps/mobile/app/(tabs)/log/session.tsx` — plain ScrollView needing keyboard safety
- `apps/mobile/lib/notifications.ts` — schedule/cancel rest-notification helpers
- Phase 03 P10 lesson (STATE.md decisions): OS-notification lifecycle is a paired
  invariant (cancel-on-foreground + reschedule-on-background) — D-21 must not break it

### Onboarding explainer (item 4)
- `apps/mobile/app/onboarding/_layout.tsx` + wizard steps — insertion point (explainer first)
- `apps/mobile/components/home/HssRing.tsx`, `ReadinessLight`, `TrendChart` — real
  components the cards render with sample data (D-18)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `packages/shared/src/units.ts` — exact-round-trip conversion discipline (D-12 Phase 03);
  oz/tsp/tbsp conversions extend this file with the same golden round-trip treatment.
- FoodConfirmSheet's meal-selector chip pattern — visual template for the unit chip row.
- `ExercisePickerSheet`/`FoodConfirmSheet` single-owner bottom-sheet pattern — keep when
  reworking keyboard behavior (a second open/close owner caused oscillation before).
- `skipRest`/`addThirtySeconds` in sessionStore — the correct cancel-then-reschedule
  notification pattern D-21 mirrors.
- Phase 07 migration round-trip proof harness (in-memory better-sqlite3 applying committed
  `.sql` files in journal order) — the units migration reuses it.

### Established Patterns
- Storage is ALWAYS metric (kg, km, grams); conversions are display-only and round-trip
  exact — the three-pref split and food units change display resolution only, never storage.
- Migrations are BLOCKING plans, generated via drizzle-kit, committed as `.sql`, proven by
  round-trip test (Phase 07 precedent).
- One-volt-per-screen; segmented/chip controls use bone active-fill.
- Committed sets lock fields and are persisted mid-session — exercise deletion must clean
  up DB rows, not just draft state.
- No new native modules expected in this phase — build 10 still requires a fresh EAS
  production build + TestFlight beta pass (06-06 Task 3 re-run) regardless.

### Integration Points
- `user_profile` schema + a new drizzle migration (0005?) — the only schema change.
- `settingsStore` (zustand units mirror) fans out to ~12 consumer call sites.
- Onboarding wizard step order changes: explainer becomes step 1 ahead of sex.
- Settings gains: three unit rows + a "How Apsis works" row.

</code_context>

<specifics>
## Specific Ideas

- The beta case to satisfy end-to-end: **imperial lifts + km runs** — after the split, a
  user can log 225 lb squats and see 5 km runs with /km pace on the same day.
- Explainer voice: same athlete-direct register as the store listing ("You lift. You run.
  One number tells you what it cost.") — conceptual card front, "the math" expandable back.
- Rest-timer bug repro (from the owner): start a new set before rest ends without hitting
  Skip → 3–4 notifications fire back-to-back for finished exercises.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope (the three owner-added items were folded into
the phase by the owner, who is the scope authority for beta feedback).

</deferred>

---

*Phase: 09-beta-feedback-round-1*
*Context gathered: 2026-08-04*
