---
phase: quick
plan: 260709-rq4
subsystem: ui
tags: [react-native, expo, design-tokens, typography, theming]

requires:
  - phase: quick-260709-qmv
    provides: void/volt dark palette, Archivo/JetBrains Mono font wiring, app icon
provides:
  - Corrected amber token (#CDBE4A), volt pressed-state token, Radius.pill, DISABLED_OPACITY,
    Typography.title, Kicker mono style
  - Reusable ScreenHeader component (mono kicker + heavy uppercase title)
  - Design-System-v1-aligned button/control states (pressed/disabled), radii, sentence-case CTA
    copy, dashed add-set ghost, logger data typography, mono tab-bar labels
affects: [onboarding, logger, settings, session-finish]

tech-stack:
  added: []
  patterns:
    - "Primary CTA Pressable style-function pattern: pressed -> accentPressed bg, disabled -> steel bg + ash label + 0.7 opacity"
    - "ScreenHeader (mono Kicker + Typography.title) as the standard screen-title component going forward"

key-files:
  created:
    - apps/mobile/components/ScreenHeader.tsx
  modified:
    - apps/mobile/constants/Colors.ts
    - apps/mobile/constants/theme.ts
    - apps/mobile/components/onboarding/WizardStep.tsx
    - apps/mobile/components/onboarding/ProfileReview.tsx
    - apps/mobile/components/session/LiveHssHeader.tsx
    - apps/mobile/components/session/ExerciseCard.tsx
    - apps/mobile/components/session/RestTimerBanner.tsx
    - apps/mobile/components/session/ExercisePickerSheet.tsx
    - apps/mobile/components/session/SetRow.tsx
    - apps/mobile/app/(tabs)/_layout.tsx
    - apps/mobile/app/(tabs)/log/index.tsx
    - apps/mobile/app/(tabs)/log/session.tsx
    - apps/mobile/app/(tabs)/settings/index.tsx
    - apps/mobile/app/session/finish.tsx
    - apps/mobile/app/onboarding/sex.tsx
    - apps/mobile/app/onboarding/units.tsx
    - apps/mobile/app/onboarding/threshold-hr.tsx
    - apps/mobile/app/onboarding/threshold-pace.tsx

key-decisions:
  - "bodyweight.tsx has no choice/mode button control (numeric TextInput only) so it was left unmodified despite being listed in the plan's files_modified frontmatter — nothing in it matched the radius-6 choice/segment/pill instruction."
  - "finish.tsx's Done button had no pressed/disabled style branches at all before this pass; added the standard accentPressed/steel-ash-0.7 treatment (Rule 2) to bring it in line with the other five primary CTAs the plan explicitly grouped it with."
  - "ProfileReview.tsx's new buttonLabelDisabled style is declared but currently unreachable (the submitting branch renders an ActivityIndicator instead of the Text), kept for symmetry with the other primary-CTA components and future-proofing if that branch changes."

patterns-established:
  - "Pattern: primary CTA disabled state = { backgroundColor: Colors.dark.steel, opacity: DISABLED_OPACITY } + label color: Colors.dark.mutedText, replacing all prior ad-hoc opacity-only disabled treatments."

requirements-completed: []

coverage:
  - id: D1
    description: "Amber/caution token corrected to exact #CDBE4A everywhere warning is used; #A8B545 fully removed"
    verification:
      - kind: other
        ref: "grep -rn 'A8B545' apps/mobile (zero matches) + Colors.ts contains #CDBE4A"
        status: pass
    human_judgment: false
  - id: D2
    description: "Primary volt buttons show accentPressed (#A9D32B) pressed state and steel/ash/opacity-0.7 disabled state instead of plain opacity fades"
    verification: []
    human_judgment: true
    rationale: "Pressed/disabled visual states require on-device or simulator interaction to confirm rendering; not verifiable via static grep alone."
  - id: D3
    description: "Primary CTA labels render sentence case (Start workout, Save changes, Keep training, Discard workout); accessibilityLabels unchanged"
    verification:
      - kind: other
        ref: "node verify script: /Start workout/, /Save changes/, /Keep training/, /Discard workout/ all present in source"
        status: pass
    human_judgment: false
  - id: D4
    description: "Buttons/inputs/chips/segments use radius 6-8 scale; Radius.pill (100) token exists"
    verification:
      - kind: other
        ref: "theme.ts contains pill: 100; grep confirms no remaining Radius.lg on choice/segment controls or primary CTA containers touched by this plan"
        status: pass
    human_judgment: false
  - id: D5
    description: "Logger set-row values render heavy Archivo ~19px with tiny mono unit suffixes; RPE 9-10 selection reads molten"
    verification:
      - kind: other
        ref: "SetRow.tsx contains Archivo_800ExtraBold/fontSize 19 valueInput, unitLabel fontSize 9, rpePillHeat destructive fill gated on option >= 9"
        status: pass
    human_judgment: true
    rationale: "Visual molten-red rendering at RPE 9/10 and overall data-typography feel are best confirmed by eyeballing the running app."
  - id: D6
    description: "Tab bar labels render in JetBrains Mono ~9px, uppercase, tracked; tab icon images unchanged"
    verification:
      - kind: other
        ref: "_layout.tsx tabBarLabelStyle present; git status shows no changes under apps/mobile/assets/images"
        status: pass
    human_judgment: false
  - id: D7
    description: "ScreenHeader (mono kicker + heavy uppercase title) component exists and is applied to Settings"
    verification:
      - kind: other
        ref: "components/ScreenHeader.tsx created; settings/index.tsx renders <ScreenHeader kicker=\"CONFIG\" title=\"Settings\" />"
        status: pass
    human_judgment: false

duration: 25min
completed: 2026-07-09
status: complete
---

# Quick Task 260709-rq4: Align UI to Apsis Design System v1 Component Specs Summary

**Closed the component-level deltas between the 260709-qmv void/volt restyle and the finalized
Apsis Design System v1 spec: exact #CDBE4A amber, volt #A9D32B pressed state, steel/ash/0.7
disabled state, a 6/8/10/pill radius scale, sentence-case primary CTA copy, a dashed ghost
add-set affordance, heavy-Archivo logger data typography with molten RPE≥9, mono uppercase
tab-bar labels, and a new reusable ScreenHeader (mono kicker + heavy title) applied to Settings.**

## Performance

- **Duration:** ~25 min
- **Tasks:** 3
- **Files modified:** 17 (+ 1 created)

## Accomplishments
- Token layer refined: `warning` corrected to `#CDBE4A`, new `accentPressed` (`#A9D32B`), `Radius.pill` (100), `DISABLED_OPACITY` (0.7), `Typography.title`, and exported `Kicker` mono style.
- New `ScreenHeader` presentational component (mono kicker + `Typography.title`), applied to the Settings screen (`CONFIG` / `Settings`), replacing the old plain `heading` Text.
- Six primary CTAs (WizardStep continue, ProfileReview save, log/index start, LiveHssHeader finish, settings retry, finish done) now use radius 8, `minHeight: 48`, a volt `accentPressed` pressed-state fill, and a steel-bg/ash-label/opacity-0.7 disabled state — replacing five different ad-hoc opacity-only disabled treatments (0.4/0.5/0.6/plain-none) and plain-opacity pressed feedback.
- Sentence-case visible CTA copy: "Start Workout" → "Start workout", "Save Changes" → "Save changes", "Keep Training" → "Keep training", "Discard Workout" → "Discard workout" (both the finish-screen dropdown item and the confirm-modal destructive button). All `accessibilityLabel` values were left exactly as before.
- Choice/segment controls moved from radius 10 to radius 6: onboarding sex/units/threshold-hr/threshold-pace option buttons, Settings `choiceButton` and `sexOption`.
- `ExerciseCard`'s "+ Add set" row converted from a top-hairline-only row to a full-width dashed volt-bordered ghost affordance (radius 8).
- Ghost/ghost-adjacent controls (session `addExerciseButton`, `RestTimerBanner` ghostButton) and the `ExercisePickerSheet` search input moved from radius 10 to radius 8.
- `SetRow` set values now render in heavy `Archivo_800ExtraBold` ~19px (was Mono 16px); unit suffixes shrunk to mono 9px; steppers restyled to steel bg + 1px line border at radius 6; RPE pills moved to radius 6, and selecting RPE 9 or 10 now fills the pill with the destructive/molten color instead of volt.
- Tab bar (`_layout.tsx`) gained `tabBarLabelStyle`: JetBrains Mono 9px, uppercase, letter-spacing 1 — tab icon images/sources untouched.

## Task Commits

Each task was committed atomically:

1. **Task 1: Refine token layer + add ScreenHeader component** - `75c050e` (feat)
2. **Task 2: Button/control states, radii, sentence-case labels, dashed add-set, ScreenHeader** - `751ad17` (feat)
3. **Task 3: Logger data typography + mono tab-bar labels** - `ce4fef7` (feat)

**Plan metadata:** committed separately by the orchestrator after this summary (per constraint: docs artifacts are not committed by the executor for this quick task).

## Files Created/Modified
- `apps/mobile/components/ScreenHeader.tsx` - new mono-kicker + heavy-title screen header component
- `apps/mobile/constants/Colors.ts` - amber corrected to #CDBE4A, added `accentPressed`
- `apps/mobile/constants/theme.ts` - added `Radius.pill`, `DISABLED_OPACITY`, `Typography.title`, exported `Kicker`
- `apps/mobile/components/onboarding/WizardStep.tsx` - primary CTA pressed/disabled states, radius 8, minHeight 48
- `apps/mobile/components/onboarding/ProfileReview.tsx` - same primary CTA treatment
- `apps/mobile/components/session/LiveHssHeader.tsx` - Finish button converted to style-function with accentPressed pressed state, radius 8
- `apps/mobile/components/session/ExerciseCard.tsx` - add-set row is now a dashed volt ghost affordance
- `apps/mobile/components/session/RestTimerBanner.tsx` - ghost buttons radius 8
- `apps/mobile/components/session/ExercisePickerSheet.tsx` - search input radius 8
- `apps/mobile/components/session/SetRow.tsx` - heavy Archivo set values, tiny mono units, steel/line steppers, radius-6 RPE pills with molten RPE≥9
- `apps/mobile/app/(tabs)/_layout.tsx` - mono uppercase tab bar labels
- `apps/mobile/app/(tabs)/log/index.tsx` - Start workout CTA sentence case + new pressed/disabled treatment
- `apps/mobile/app/(tabs)/log/session.tsx` - add-exercise ghost button radius 8
- `apps/mobile/app/(tabs)/settings/index.tsx` - ScreenHeader applied, Save changes label, retryButton/choiceButton/sexOption radii
- `apps/mobile/app/session/finish.tsx` - Done button gains pressed/disabled states + radius 8; Keep training/Discard workout sentence case
- `apps/mobile/app/onboarding/sex.tsx` - option radius 6
- `apps/mobile/app/onboarding/units.tsx` - option radius 6
- `apps/mobile/app/onboarding/threshold-hr.tsx` - modeButton radius 6
- `apps/mobile/app/onboarding/threshold-pace.tsx` - modeButton radius 6

## Decisions Made
- `bodyweight.tsx` was listed in the plan's `files_modified` frontmatter but contains no choice/mode-button control (only a numeric TextInput) — left unmodified since none of the plan's instructions applied to it.
- `finish.tsx`'s "Done" button had zero pressed/disabled style branches before this pass (Rule 2 — missing state consistent with the other five primary CTAs the plan groups it with); added the standard `accentPressed`/steel-ash-0.7 treatment plus an `accessibilityState={{ disabled: busy }}` that wasn't there before.
- `ProfileReview.tsx`'s `buttonLabelDisabled` style is currently unreachable (the `submitting` branch renders an `ActivityIndicator` instead of the label `Text`) but was added anyway for consistency with every other primary-CTA component's shape, in case that branch is refactored later.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] finish.tsx Done button had no pressed/disabled state at all**
- **Found during:** Task 2
- **Issue:** The plan's primary-CTA instruction set (radius 8, minHeight 48, accentPressed pressed state, steel/ash/0.7 disabled state) assumed every listed CTA already had `buttonPressed`/`buttonDisabled` style branches to swap out. `finish.tsx`'s "Done" `Pressable` had neither — only `disabled={busy}` with a single flat `styles.button`.
- **Fix:** Converted `style={styles.button}` to a style-function `({ pressed }) => [...]`, added `buttonDisabled`/`buttonPressed`/`buttonLabelDisabled` styles matching the pattern used everywhere else, and added `accessibilityState={{ disabled: busy }}` for consistency with the other primary CTAs.
- **Files modified:** `apps/mobile/app/session/finish.tsx`
- **Verification:** Typecheck clean (no new errors); visual pressed/disabled states not verifiable statically — flagged as coverage item D2 (human_judgment: true) alongside the rest of the pressed/disabled-state deliverable.
- **Committed in:** `751ad17` (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 missing critical state)
**Impact on plan:** Necessary to satisfy the plan's own "every primary volt button shows the pressed/disabled state" must-have truth for all six listed CTAs. No scope creep — only the six CTAs explicitly named in the plan were touched.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Known Stubs
None - this is a styling-only pass over already-wired components; no new data-consuming UI was introduced.

## Threat Flags
None - styling-only change per the plan's own threat model (T-RQ4-01, accepted, no new trust boundary).

## Next Phase Readiness
- The design-token layer (`Colors.ts`/`theme.ts`) and `ScreenHeader` component are now the canonical building blocks for any future screens (Phase 4 Home tab components — readiness pill, HSS ring, stat tiles — are explicitly out of scope for this pass and still need to be built against these same tokens).
- No blockers. `pnpm run typecheck` is clean apart from the two pre-existing, unrelated `Href` typed-route errors already logged in `260709-qmv-restyle-app-ui-to-apsis-dark-design-syst/deferred-items.md` (`onboarding/review.tsx`, `components/ExternalLink.tsx`).

## Self-Check: PASSED

- FOUND: apps/mobile/components/ScreenHeader.tsx
- FOUND: apps/mobile/constants/Colors.ts (contains #CDBE4A, accentPressed)
- FOUND: apps/mobile/constants/theme.ts (contains Radius.pill, DISABLED_OPACITY, Typography.title, Kicker)
- FOUND commit 75c050e
- FOUND commit 751ad17
- FOUND commit ce4fef7

---
*Phase: quick*
*Completed: 2026-07-09*
