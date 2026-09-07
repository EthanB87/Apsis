---
status: diagnosed
trigger: "while the color is correct the UI when adding sets and logging a workout is a little broken and spaced weird"
created: 2026-07-10T00:00:00Z
updated: 2026-07-10T00:00:00Z
mode: find_root_cause_only
---

## Current Focus

hypothesis: CONFIRMED — SetRow content is ~2x wider than any iPhone screen; `flexWrap: 'wrap'` silently folds each set row into 2-3 ragged lines instead of the UI-SPEC single ~56-64px row
test: Static width arithmetic from committed styles + git archaeology across c6a938a -> 3922c13 -> ce4fef7
expecting: n/a — diagnosis complete
next_action: hand off to plan-phase --gaps (diagnosis-only session, no fix applied)

## Symptoms

expected: Active-workout session screen and set-logging rows (SetRow, exercise cards, add-set controls) render cleanly with spacing/layout per 03-UI-SPEC.md ("Set row ... single horizontal row ... ~56-64px tall", spec lines 171-176) and Apsis Design System v1
actual: "while the color is correct the UI when adding sets and logging a workout is a little broken and spaced weird" (verbatim user report, Test 9)
errors: None reported
reproduction: Test 9 in 03-UAT.md — physical iOS device, start workout, add exercise, log sets; observe layout/spacing on session screen
started: Reported 2026-07-10 UAT retest, AFTER quick tasks 260709-qmv (dark restyle, commit 3922c13), 260709-r4z, 260709-rq4 (Design System v1, commits 751ad17/ce4fef7). NOTE: root defect predates the restyle (present since c6a938a) — it was masked in the first UAT pass by the dominant "UI is blue/unstyled" complaint, and was made both worse and newly visible by the restyle.

## Eliminated

- hypothesis: Custom fonts (Archivo / JetBrains Mono) not loaded, causing fallback-font layout breakage
  evidence: apps/mobile/app/_layout.tsx:51-58 loads Archivo_400Regular/500Medium/800ExtraBold/900Black + JetBrainsMono_400Regular/500Medium via useFonts; lines 109-115 + 129 gate splash-hide AND first render on fontsLoaded. Fonts are present and awaited.
  timestamp: 2026-07-10

- hypothesis: Restyle commits introduced the wrapping/overflow layout bug
  evidence: git show c6a938a:apps/mobile/components/session/SetRow.tsx — the ORIGINAL Plan 03-06 Task 2 version already has `flexWrap: 'wrap'` on styles.row, `width: HIT_TARGET_MIN` (44) steppers, `minWidth: HIT_TARGET_MIN` RPE pills, and a 44px checkmark. Restyle diffs (3922c13, ce4fef7) only touched colors, radii, and typography — the overflow geometry is original. Restyle is a CONTRIBUTOR (wider text), not the origin.
  timestamp: 2026-07-10

- hypothesis: Color/token mismatch causing visual breakage
  evidence: User explicitly reports "the color is correct"; UAT gap "UI colors match the UI-SPEC design" is marked resolved by qmv/rq4.
  timestamp: 2026-07-10

## Evidence

- timestamp: 2026-07-10
  checked: apps/mobile/components/session/SetRow.tsx styles.row (lines 377-385)
  found: "flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', minHeight: 44, paddingHorizontal: 16, paddingVertical: 8, gap: 8"
  implication: Any content overflow does not clip or scroll — it silently wraps into additional lines, which is exactly "a little broken and spaced weird"

- timestamp: 2026-07-10
  checked: SetRow control visual sizes — stepper (lines 409-418: width/height HIT_TARGET_MIN=44), rpePill (441-448: minWidth/height 44, five pills), checkmark (462-470: 44x44), plus TWO stepper-flanked field groups per row (load always + reps-or-duration always)
  found: Single-line intrinsic width ~ warmupChip 24 + load group ~156 (44+40+unit+44+gaps) + reps group ~170 + rpeRow 236 (5x44 + 4x4 gaps) + checkmark 44 + 4 inter-item gaps x8 + padding 32 = ~690px
  implication: Available width inside an ExerciseCard on iPhone 15 is ~361pt (393 - 2x16 card margin). 690 >> 361 — every set row is FORCED to wrap into 2-3 lines on every iPhone. UI-SPEC (03-UI-SPEC.md lines 171-176) requires a single horizontal row ~56-64px tall.

- timestamp: 2026-07-10
  checked: SetRow.tsx header comment (lines 9-13) vs actual styles
  found: Comment says small controls (RPE pills, steppers) "use hitSlop to reach the 44x44 minimum touch target WITHOUT inflating the row's visual width past what fits a single horizontal row" — but the styles set the 44px HIT_TARGET_MIN as the VISUAL size, and hitSlop (4-6) is layered on top of already-44px controls
  implication: Comment/implementation contradiction present since the row was first built (commit c6a938a, Plan 03-06 Task 2). The intended design (small visuals + hitSlop) was never implemented.

- timestamp: 2026-07-10
  checked: Restyle diffs against SetRow — git show 3922c13 and ce4fef7 -- apps/mobile/components/session/SetRow.tsx
  found: qmv (3922c13): valueInput Typography.body -> Mono; unitLabel/rpePillLabel -> Mono (JetBrains Mono, letterSpacing 1, textTransform uppercase). rq4 (ce4fef7): valueInput -> fontFamily 'Archivo_800ExtraBold', fontSize 19 (was 16), fontWeight '600'; unitLabel fontSize 9
  implication: Restyle widened row content (19px extra-bold digits, wide-tracked uppercase mono labels) — same overflow mechanism, more wrap. Combined with colors now being correct, the layout became the salient defect at retest.

- timestamp: 2026-07-10
  checked: Knowledge base (.planning/debug/knowledge-base.md)
  found: File does not exist — no prior patterns
  implication: Open-ended investigation; matches common-bug-pattern category "worked before / changed recently" via differential debugging over commits

- timestamp: 2026-07-10
  checked: Horizontal alignment SetRow vs ExerciseCard header (ExerciseCard.tsx:106-108 header paddingHorizontal Spacing.lg=24; SetRow.tsx:382 paddingHorizontal Spacing.md=16)
  found: Set-row content starts 8px left of the exercise name / summary above it
  implication: Secondary "spaced weird" contributor — left edges inside the card do not line up; UI-SPEC says exercise-card internal padding is lg=24

- timestamp: 2026-07-10
  checked: ExerciseCard add-set affordance (ExerciseCard.tsx:123-134) vs UI-SPEC
  found: rq4 (751ad17) changed "+ Add set" from a full-width ghost row to an INSET dashed-border box (marginHorizontal 16, marginTop 8, marginBottom 16) while the rq4 commit message calls it "full-width dashed volt ghost affordance"
  implication: Minor intentional-but-inconsistent deviation; contributes to the cluttered feel but is not the core breakage

- timestamp: 2026-07-10
  checked: constants/theme.ts Typography roles + SetRow valueInput
  found: heading/display/title and valueInput pair single-face expo-google-fonts families (Archivo_800ExtraBold / Archivo_900Black) with a mismatched fontWeight '600'
  implication: Lower-confidence contributor — on iOS, a fontWeight that doesn't exist in the loaded single-face family can shift face selection/metrics. Recommend dropping redundant fontWeight in the fix; not the primary cause.

- timestamp: 2026-07-10
  checked: app/(tabs)/log/session.tsx and LiveHssHeader.tsx layout
  found: Session screen scaffold (sticky header, scroll, add-exercise button) is structurally sound; header uses Display 40px (spec said 32, superseded by Design System v1) — no overflow mechanism there
  implication: The breakage is concentrated in SetRow (and its fit inside ExerciseCard), not the screen scaffold

## Resolution

root_cause: >
  SetRow's intrinsic single-line content width (~690px: two 44px-stepper-flanked field
  groups + five 44px RPE pills + 44px checkmark + warmup chip + gaps/padding) is nearly
  double the ~361pt available inside an ExerciseCard on any iPhone, and styles.row uses
  flexWrap:'wrap', so every set row silently folds into 2-3 ragged, center-aligned lines
  instead of the UI-SPEC's single ~56-64px horizontal row. The defect has existed since
  the row was first implemented (commit c6a938a, Plan 03-06 Task 2) — the file's own
  header comment specifies small visual controls with hitSlop supplying the 44pt touch
  target, but the styles use HIT_TARGET_MIN (44) as the VISUAL size. The Design System v1
  restyle (3922c13 qmv, ce4fef7 rq4) did not introduce the bug but widened row content
  (19px Archivo ExtraBold value inputs, wide-tracked uppercase mono unit/RPE labels),
  worsening the wrap, and by fixing the colors it made the layout the newly visible
  defect at UAT retest. Secondary contributors: SetRow horizontal padding (16) misaligned
  with card header padding (24); inset dashed add-set box; redundant fontWeight '600' on
  single-face Archivo families.
fix: (not applied — diagnosis-only session; handled by plan-phase --gaps)
verification: (n/a)
files_changed: []

## Suggested Fix Direction

- Rebuild SetRow as a true single-line row: shrink VISUAL control sizes (steppers ~28-32px,
  RPE pills ~28-30px, checkmark ~28-32px visual) and use hitSlop/padding to reach the 44pt
  touch target, per the UI-SPEC Spacing-Scale exception and the file's own header comment.
- Remove flexWrap:'wrap' from styles.row (keep intentional full-width annotation lines —
  effective-load / error / warning — as separate rows below, not wrap artifacts).
- Reconsider information density per row: Strong/Hevy render load + reps as compact text
  fields without flanking steppers; two stepper-flanked groups + 5 pills + checkmark cannot
  fit 390pt at 44px visual sizes no matter the spacing tokens.
- Align SetRow horizontal padding with the card header (lg=24) or vice versa.
- Drop the redundant fontWeight on single-face Archivo families (valueInput, heading/display/title).
