---
phase: 03-onboarding-lifting-logger
plan: 11
subsystem: ui
tags: [design-system, theme-tokens, typography, react-native, expo-router]

# Dependency graph
requires:
  - phase: 03-onboarding-lifting-logger (plans 01-09)
    provides: theme.ts token layer, tab bar, onboarding wizard, settings screen, session logger
provides:
  - Contract-conformant Spacing scale (xs4/sm8/md12/lg16/xl24/xxl32/xxxl48/xxxxl64) with all
    20 consumers remapped 1:1 (zero rendered-value drift)
  - Contract-conformant Typography (heading 22, title 30, widened mono/kicker tracking,
    fontWeight cleanup on single-face Archivo roles)
  - Tab bar, text-field focus, and segmented-control conformance to DESIGN-SYSTEM.md on
    existing Phase-3 surfaces
affects: [03-10 (set-row/exercise-card geometry, consumes new Spacing.md=12), phase-04-planning]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Largest-first ordered token rename sweep with a pre/post count-invariant guard for
      safe mechanical renames across many consumer files"
    - "One-volt-per-screen enforcement: segmented-control active fill switches from volt to
      bone whenever the same screen/modal already has a volt-filled primary CTA"

key-files:
  created: []
  modified:
    - apps/mobile/constants/theme.ts
    - apps/mobile/app/(tabs)/_layout.tsx
    - apps/mobile/app/(tabs)/index.tsx
    - apps/mobile/app/(tabs)/log/index.tsx
    - apps/mobile/app/(tabs)/log/session.tsx
    - apps/mobile/app/(tabs)/settings/index.tsx
    - apps/mobile/app/onboarding/bodyweight.tsx
    - apps/mobile/app/onboarding/review.tsx
    - apps/mobile/app/onboarding/sex.tsx
    - apps/mobile/app/onboarding/threshold-hr.tsx
    - apps/mobile/app/onboarding/threshold-pace.tsx
    - apps/mobile/app/onboarding/units.tsx
    - apps/mobile/app/session/finish.tsx
    - apps/mobile/components/BootStates.tsx
    - apps/mobile/components/onboarding/ProfileReview.tsx
    - apps/mobile/components/onboarding/WizardStep.tsx
    - apps/mobile/components/session/ExerciseCard.tsx
    - apps/mobile/components/session/ExercisePickerSheet.tsx
    - apps/mobile/components/session/HSSBreakdownSheet.tsx
    - apps/mobile/components/session/LiveHssHeader.tsx
    - apps/mobile/components/session/RestTimerBanner.tsx
    - apps/mobile/components/session/SetRow.tsx

key-decisions:
  - "Ordered largest-first token rename (xxxl->xxxxl, xxl->xxxl, xl->xxl, lg->xl, md->lg)
    applied via perl -i across all 20 consumer files, verified with a pre/post
    count-invariant (157 total Spacing.* usages unchanged, each token's count shifted
    exactly one name up)"
  - "Radius.pill changed 100->9999 with no consumer relying on the exact prior value
    (confirmed zero direct Radius.pill usages outside theme.ts at plan time)"
  - "Tab bar background switched from Colors.dark.surface (carbon) to Colors.dark.background
    (void) to match the contract's bottom-nav spec; added elevation:0/shadowOpacity:0 for
    the 'hairline instead of shadow' hard rule"
  - "Segmented-control tracks (onboarding sex/units, threshold-hr/pace mode toggles, Settings
    units/rest-timer/sex-modal) moved from carbon to steel fill, and their active/selected
    fill switched from volt to bone wherever the same screen or modal already has a
    volt-filled primary CTA (WizardStep Continue, ProfileReview Save changes, modal Set
    button) to respect DESIGN-SYSTEM.md's one-volt-per-screen hard rule"
  - "Logged two pre-existing, plan-unrelated router-typing tsc errors (app/onboarding/review.tsx
    and components/ExternalLink.tsx) to deferred-items.md rather than fixing them -- out of
    scope per SCOPE BOUNDARY (confirmed via git diff that neither error's line was touched by
    this plan's changes)"

patterns-established:
  - "Ordered-sweep + count-invariant guard for any future mechanical multi-file token rename"
  - "One-volt-per-screen check as a standing review question whenever adding a new
    segmented/toggle control to a screen that already has a primary CTA"

requirements-completed: [ONB-01, ONB-02, LIFT-02]

coverage:
  - id: D1
    description: "theme.ts adopts the DESIGN-SYSTEM.md base-4 spacing scale (md=12 inserted,
      xxxxl=64 added) with every pre-existing usage remapped 1:1 and zero rendered-value drift"
    requirement: "LIFT-02"
    verification:
      - kind: other
        ref: "grep count-invariant: pre-sweep per-token counts (md52/lg26/xl12/xxl7/xxxl3,
          total157) shift exactly one name up post-sweep (lg52/xl26/xxl12/xxxl7/xxxxl3,
          md0, total157)"
        status: pass
    human_judgment: true
    rationale: "Rendered-value equivalence is asserted by the count-invariant + diff
      spot-check here, but final on-screen visual confirmation of zero drift rides Plan
      03-10's blocking on-device checkpoint per this plan's own verification section."
  - id: D2
    description: "Typography conforms to contract sizes (heading 22, title 30), widened
      mono/kicker tracking (>=0.2em), and fontWeight removed from single-face heading/
      display/title roles"
    requirement: "ONB-01"
    verification:
      - kind: other
        ref: "region-scoped grep over heading/display/title blocks in theme.ts: 0 fontWeight
          lines; grep fontSize: 22 / fontSize: 30 present"
        status: pass
    human_judgment: false
  - id: D3
    description: "Tab bar, text-field focus states, and segmented controls on existing
      Phase-3 surfaces conform to the contract (mono/volt/ash/void tab bar, volt focus
      border on every Phase-3 form TextInput except SetRow, steel-track segments with
      one-volt-per-screen bone fallback)"
    requirement: "ONB-02"
    verification:
      - kind: other
        ref: "grep: (tabs)/_layout.tsx has borderTopWidth; grep -rq onFocus app components
          finds matches; git status shows only existing-file edits, no new routes"
        status: pass
    human_judgment: true
    rationale: "Visual/interaction confirmation (focus border color, tab bar look, segment
      states) requires an on-device or simulator pass -- explicitly deferred to Plan 03-10's
      blocking checkpoint per this plan's <verification> section."

duration: ~20min
completed: 2026-07-10
status: complete
---

# Phase 03 Plan 11: Design-System Token Conformance Sweep Summary

**Ordered largest-first Spacing token rename (157 usages across 20 files, zero rendered-value drift) plus contract typography and existing-surface (tab bar/inputs/segments) conformance to DESIGN-SYSTEM.md, unblocking Plan 03-10's Spacing.md=12 dependency.**

## Performance

- **Duration:** ~20 min
- **Completed:** 2026-07-10
- **Tasks:** 3
- **Files modified:** 22

## Accomplishments

- Rewrote `theme.ts`'s `Spacing` scale to the DESIGN-SYSTEM.md contract (xs4/sm8/md12/lg16/
  xl24/xxl32/xxxl48/xxxxl64) and remapped all 157 pre-existing `Spacing.*` usages across 20
  consumer files via an ordered largest-first sweep, verified by an exact pre/post
  count-invariant (every renamed token's usage count shifted exactly one name up; total
  usage count unchanged)
- Set `HAIRLINE_WIDTH` 2->1 and `Radius.pill` 100->9999 to match the contract
- Conformed `Typography` to the contract ladder: heading (H3) 20->22, title (H2) 29->30,
  tight line-heights, contract-band letter-spacing; widened `Mono`/`Kicker` tracking toward
  0.2em; removed the redundant `fontWeight` from the single-face heading/display/title roles
- Brought the tab bar to contract spec (void background, volt/ash tints, no shadow) and
  added focus-driven volt borders to every Phase-3 form `TextInput` (onboarding steps,
  Settings modal editors, exercise-picker search) except `SetRow.tsx` (owned by Plan 03-10)
- Converted segmented-control tracks to steel fill and switched their active-fill from volt
  to bone on every screen/modal that already has its own volt-filled primary CTA, enforcing
  the contract's one-volt-per-screen hard rule

## Task Commits

Each task was committed atomically:

1. **Task 1: Contract spacing scale + ordered token remap sweep** - `8ffcbcb` (feat)
2. **Task 2: Typography conformance** - `e2d765f` (feat)
3. **Task 3: Existing-surface conformance (tab bar, text-field focus, segments)** - `8582b17` (feat)

**Plan metadata:** committed via `gsd-tools query commit` (see final commit below)

## Files Created/Modified

- `apps/mobile/constants/theme.ts` - Spacing/Typography/Radius/HAIRLINE_WIDTH/Mono/Kicker contract conformance
- `apps/mobile/app/(tabs)/_layout.tsx` - void background, no shadow, tabIconSelected token, wider mono tracking
- `apps/mobile/app/(tabs)/settings/index.tsx` - Spacing rename, focus-driven modal input borders, steel/bone segments
- `apps/mobile/app/onboarding/{bodyweight,sex,threshold-hr,threshold-pace,units}.tsx` - Spacing rename, focus borders, steel/bone segments
- `apps/mobile/app/onboarding/review.tsx`, `app/session/finish.tsx`, `app/(tabs)/index.tsx`, `app/(tabs)/log/{index,session}.tsx` - Spacing rename only
- `apps/mobile/components/BootStates.tsx`, `components/onboarding/{ProfileReview,WizardStep}.tsx`, `components/session/{ExerciseCard,HSSBreakdownSheet,LiveHssHeader,RestTimerBanner,SetRow}.tsx` - Spacing rename only (SetRow/ExerciseCard geometry otherwise untouched, per plan)
- `apps/mobile/components/session/ExercisePickerSheet.tsx` - Spacing rename plus focus-driven volt border on the search field

## Decisions Made

- Largest-first ordered rename sweep (xxxl->xxxxl, xxl->xxxl, xl->xxl, lg->xl, md->lg) run
  file-by-file with `perl -i`, verified by an exact count-invariant before committing
- `Radius.pill` changed to 9999 after confirming zero direct consumers of the literal value
  100 outside `theme.ts`
- Tab bar background moved to `Colors.dark.background` (void) per the contract's bottom-nav
  spec, with `elevation`/`shadowOpacity` zeroed for the hairline-not-shadow hard rule
- Segmented-control tracks moved to `Colors.dark.steel`; active fill switched from volt to
  bone wherever the screen/modal already has a volt CTA (WizardStep's Continue button,
  ProfileReview's Save changes button, the Settings sex-modal's Set button) — this is the
  one-volt-per-screen rule from DESIGN-SYSTEM.md §7, applied consistently across onboarding
  and Settings
- Logged two pre-existing, unrelated `router.push` typed-route tsc errors to
  `deferred-items.md` (confirmed via `git diff`/`git log` that neither file's erroring line
  was touched by this plan) rather than fixing them, per the SCOPE BOUNDARY rule

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Tab bar background was carbon, not void, and had no shadow suppression**
- **Found during:** Task 3
- **Issue:** `(tabs)/_layout.tsx` set `tabBarStyle.backgroundColor` to `Colors[colorScheme].surface`
  (carbon) and had no explicit shadow suppression — DESIGN-SYSTEM.md's bottom-nav spec requires
  a void background and "hairline borders instead of shadows"
- **Fix:** Changed to `Colors[colorScheme].background` (void); added `elevation: 0` and
  `shadowOpacity: 0`
- **Files modified:** `apps/mobile/app/(tabs)/_layout.tsx`
- **Verification:** `grep -q "borderTopWidth"` still passes; visual confirmation deferred to
  03-10's on-device checkpoint
- **Committed in:** `8582b17` (Task 3 commit)

**2. [Rule 2 - Missing Critical] Segmented controls competed with existing volt primary CTAs**
- **Found during:** Task 3
- **Issue:** Every onboarding step's sex/units/mode selectors and the Settings screen's
  units/rest-timer/sex-modal selectors used `Colors.dark.accent` (volt) for their active
  fill, while the same screen (WizardStep's Continue button, ProfileReview's Save changes
  button, or the modal's Set button) already had its own volt-filled primary CTA —
  violating DESIGN-SYSTEM.md §7's one-volt-per-screen hard rule
- **Fix:** Switched active-segment fill to `Colors.dark.text` (bone) with void text
  (`onAccent`, already void) on every affected control; moved inactive-track background
  from carbon to steel to match the contract's "steel track" spec
- **Files modified:** `apps/mobile/app/onboarding/{sex,units,threshold-hr,threshold-pace}.tsx`,
  `apps/mobile/app/(tabs)/settings/index.tsx`
- **Verification:** `npx tsc --noEmit` clean (aside from the two pre-existing unrelated
  errors); visual confirmation deferred to 03-10's on-device checkpoint
- **Committed in:** `8582b17` (Task 3 commit)

---

**Total deviations:** 2 auto-fixed (both Rule 2 - missing critical contract conformance)
**Impact on plan:** Both fixes were explicitly anticipated by the plan's Task 3 `read_first`
guidance (verify remaining tab-bar properties; respect the one-volt-per-screen rule) rather
than being out-of-scope discoveries — no scope creep, no architectural change.

## Issues Encountered

- Two pre-existing, plan-unrelated `tsc` errors (`app/onboarding/review.tsx:34`,
  `components/ExternalLink.tsx:11` — both about `router.push` argument typing against
  expo-router's typed routes) surfaced in every `npx tsc --noEmit` run. Confirmed via
  `git diff`/`git log` that these lines/files predate this plan and were untouched by it.
  Logged to `.planning/phases/03-onboarding-lifting-logger/deferred-items.md` rather than
  fixed, per the SCOPE BOUNDARY rule (only auto-fix issues directly caused by this plan's
  changes).

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `Spacing.md` (12) is now live in `theme.ts` with zero consumers, ready for Plan 03-10 to
  consume for its SetRow/ExerciseCard geometry rebuild
- `SetRow.tsx` and `ExerciseCard.tsx` received only the token rename in this plan — their
  geometry is untouched and ready for 03-10's rebuild
- Final on-screen visual confirmation of the token rename (zero drift), typography, tab bar,
  focus states, and segmented controls all ride Plan 03-10's blocking on-device checkpoint,
  which this plan's own `<verification>` section designates as the shared confirmation point
  for both plans
- Two pre-existing unrelated tsc errors remain open in `deferred-items.md` for a future
  plan/quick-task to address (not blocking for this phase)

---
*Phase: 03-onboarding-lifting-logger*
*Completed: 2026-07-10*

## Self-Check: PASSED

All created/modified files and all four commit hashes (8ffcbcb, e2d765f, 8582b17, 0e55ee9)
verified present on disk / in git log.
