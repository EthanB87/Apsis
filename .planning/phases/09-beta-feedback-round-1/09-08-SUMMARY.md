---
phase: 09-beta-feedback-round-1
plan: 08
subsystem: onboarding-explainer
tags: [expo-router, onboarding, explainer, settings, hss, readiness, trend]

# Dependency graph
requires:
  - "09-05: Settings index.tsx three unit rows (this plan adds its Guide row on top of that merged state without disturbing them)"
provides:
  - "components/onboarding/ExplainerCards.tsx — shared three-card swipeable HSS/readiness/trend explainer (sample data only, page dots, Skip/Close, per-card 'the math' expansion)"
  - "app/onboarding/explainer.tsx — wizard step 1 wrapper (Skip / Get started -> sex)"
  - "app/explainer.tsx — top-level standalone route reachable after onboarding (Settings revisit)"
  - "onboarding/_layout.tsx unstable_settings.initialRouteName='explainer' (explainer runs before any input, D-15)"
  - "Settings 'How Apsis works' Guide row -> router.push('/explainer') (D-19)"
affects: []

actuals:
  tokens: 5170
  tasks: 3
  commits: 2

tech-stack:
  added: []
  patterns:
    - "Guarded-group escape hatch: content shared by an onboarding step AND a post-onboarding surface lives in a components/ module with two thin route wrappers — one inside the Stack.Protected onboarding group, one top-level — because routes under a Protected group are excluded from the navigator once its guard flips"
    - "Horizontal pagingEnabled ScrollView + onMomentumScrollEnd index tracking for swipeable cards (first paginated/swipe-dot surface in the repo)"

key-files:
  created:
    - apps/mobile/components/onboarding/ExplainerCards.tsx
    - apps/mobile/app/onboarding/explainer.tsx
    - apps/mobile/app/explainer.tsx
  modified:
    - apps/mobile/app/onboarding/_layout.tsx
    - "apps/mobile/app/(tabs)/settings/index.tsx"

key-decisions:
  - "Standalone revisit route is TOP-LEVEL app/explainer.tsx, not a route param on app/onboarding/explainer.tsx — the whole onboarding segment sits behind Stack.Protected guard={!hasProfile} in app/_layout.tsx, so once a profile exists (every existing build-9 tester, D-19's exact audience) any route under onboarding/ is excluded from the navigator and router.push to it silently fails"
  - "Card 2's ReadinessLight sample band is 'amber', not 'green' — ReadinessLight renders green in volt, which would create a second volt element in the explainer alongside card 1's ring (DESIGN-SYSTEM.md §7 one-volt-per-screen)"
  - "Explainer's Continue/Skip/Get started/Close buttons are ghost-styled (bone text, line border) — the card-1 HSS ring is the explainer's single volt element"
  - "Explainer does NOT register in WIZARD_STEP_ORDER / WizardStep chrome — it has its own full-bleed card layout with its own page dots; the six input steps' progress dots stay untouched"
  - "unstable_settings.initialRouteName='explainer' in onboarding/_layout.tsx pins step order (the plan's 'step order array' didn't exist — the layout is a plain auto-registering Stack, so initialRouteName is the mechanism)"

patterns-established:
  - "ExplainerCards mode prop ('wizard' | 'standalone') switches only copy (Skip/Get started vs Close/Done) and the onDone target; card content is identical in both entries"

requirements-completed: [D-15, D-16, D-17, D-18, D-19]  # phase-local CONTEXT.md decision codes, not REQUIREMENTS.md REQ-IDs — requirements.mark-complete no-ops on these (Phase 08 P02 precedent)

coverage:
  - id: T1
    description: "Three-card swipeable explainer (HSS ring / readiness light / trend chart) rendering the real home components with hardcoded sample data, page dots, Skip, and per-card expandable 'the math' ATL/CTL/TSB detail; dual-mode via shared component + two route wrappers"
    requirement: "D-16, D-17, D-18"
    verification:
      - kind: other
        ref: "pnpm typecheck (root tsc --build, cross-package)"
        status: pass
      - kind: unit
        ref: "grep: ExplainerCards imports/renders HssRing (animate={false}), ReadinessLight, TrendChart with literal TrendChartPoint[] sample; Skip affordance, pagingEnabled pager, page dots, 'THE MATH' expand toggle all present; no @apsis/db import anywhere in the three new files (T-09-13)"
        status: pass
    human_judgment: true
    rationale: "Swipe behavior, sample-data rendering, and card copy voice cannot be exercised by static checks — deferred to phase UAT per the standing on-device checkpoint approval."
  - id: T2
    description: "Explainer inserted as wizard step 1 (initialRouteName ahead of sex) + Settings 'How Apsis works' Guide row pushing the standalone /explainer route; 09-05's three unit rows untouched"
    requirement: "D-15, D-19"
    verification:
      - kind: other
        ref: "pnpm typecheck (root tsc --build, cross-package)"
        status: pass
      - kind: unit
        ref: "grep: initialRouteName 'explainer' in onboarding/_layout.tsx; 'How Apsis works' row + router.push('/explainer') in settings/index.tsx; 4 UnitsRow references (component + 3 usages) still present"
        status: pass
    human_judgment: true
    rationale: "First-step placement and the Settings->explainer->Close round trip are navigation behaviors only provable on device — deferred to phase UAT."
  - id: T3
    description: "On-device verify checkpoint (explainer cards + Settings revisit)"
    requirement: "D-15..D-19"
    verification:
      - kind: other
        ref: "Standing user approval: on-device iOS verification checkpoints in phase 9 resolve as approved with steps deferred to /gsd-verify-work 9 (see 'Deferred to Phase UAT' section)"
        status: pass
    human_judgment: true
    rationale: "Checkpoint auto-resolved per the orchestrator-relayed standing approval; the exact UAT steps are recorded below."

status: complete
---

# Phase 9 Plan 8: Onboarding Explainer Summary

**Three-card swipeable HSS/readiness/trend explainer built from the real home components (HssRing/ReadinessLight/TrendChart) with hardcoded sample data and a per-card "the math" ATL/CTL/TSB layer — inserted as wizard step 1 ahead of any input (D-15) and revisitable by existing testers via a Settings "How Apsis works" row pushing a top-level standalone route (D-19).**

## Performance

- **Duration:** ~25 min (split across an API spend-limit interruption and resume)
- **Tasks:** 3 (2 auto + 1 checkpoint auto-resolved per standing approval)
- **Files:** 3 created, 2 modified
- **Tests:** `pnpm typecheck` (root `tsc --build`, cross-package) clean after each task

## Accomplishments

- Built `ExplainerCards.tsx`: a horizontal `pagingEnabled` ScrollView of three full-bleed cards — (1) HSS: the real 200px `HssRing` at sample HSS 132, `animate={false}`; (2) readiness: `ReadinessLight` at sample band `amber`; (3) trend: `TrendChart` over a hardcoded 14-point `TrendChartPoint[]` sample — with page dots, a Skip/Close affordance, and a per-card expandable "THE MATH" layer distributing the full ATL/CTL/TSB + 14-day-calibration explanation across the three cards (D-16/D-17/D-18)
- Card copy drafted in the athlete-direct mono-voice register ("You lift. You run. One number tells you what it cost.") — owner reviews at phase UAT
- Zero DB reads in the explainer path (T-09-13 mitigation): all three cards render literal sample constants; no `@apsis/db` import in any of the three new files
- `app/onboarding/explainer.tsx` (wizard mode): Skip and the final card's "Get started" both advance to `/onboarding/sex`, the first input step
- `app/explainer.tsx` (standalone mode): Close/Done returns to Settings via `router.back()` — a top-level route so it stays reachable after `hasProfile` flips true
- `onboarding/_layout.tsx`: `unstable_settings.initialRouteName = 'explainer'` makes the explainer the wizard's first screen, before `sex` (D-15)
- `settings/index.tsx`: new "Guide" section with a "How Apsis works" nav row pushing `/explainer` (D-19); the three 09-05 unit rows (Lifts/Bodyweight/Runs) verified untouched

## Task Commits

Each task was committed atomically:

1. **Task 1: Explainer screen — three swipeable cards with sample data + two-layer math** - `765832f` (feat)
2. **Task 2: Insert explainer as wizard step 1 + Settings 'How Apsis works' row** - `5ce7860` (feat)
3. **Task 3: On-device verify checkpoint** - no commit (auto-resolved: approved — on-device steps deferred to phase UAT, see below)

_Note: no plan-metadata commit for STATE.md/ROADMAP.md in worktree mode — the orchestrator commits those centrally after the wave merges._

## Files Created/Modified

- `apps/mobile/components/onboarding/ExplainerCards.tsx` - Shared three-card explainer component (mode: 'wizard' | 'standalone'); sample constants, pager, dots, math expansion
- `apps/mobile/app/onboarding/explainer.tsx` - Wizard step 1 wrapper (inside the Protected onboarding group)
- `apps/mobile/app/explainer.tsx` - Standalone top-level wrapper for the Settings revisit
- `apps/mobile/app/onboarding/_layout.tsx` - `unstable_settings.initialRouteName: 'explainer'`
- `apps/mobile/app/(tabs)/settings/index.tsx` - "Guide" section + "How Apsis works" row (`router.push('/explainer')`), `useRouter` import, `guideRow*` styles

## Decisions Made

- **Top-level standalone route instead of a route-param toggle on one file** (Rule 2 deviation, see below) — the plan assumed a single `explainer.tsx` under `onboarding/` could serve both entries via a route param, but the entire onboarding segment is excluded from the navigator by `Stack.Protected guard={!hasProfile}` once a profile exists, which is precisely the state every existing build-9 tester is in. A Settings row pushing `/onboarding/explainer` would silently no-op for D-19's entire target audience.
- **Readiness card uses `amber`, not `green`** — `ReadinessLight`'s green state renders in volt, which would put a second volt element in the explainer alongside card 1's volt ring (DESIGN-SYSTEM.md §7 one-volt-per-screen). Amber also happens to demo the "verdict" idea more honestly than a permanent green.
- **All explainer buttons are ghost-styled** (bone text, `line` border) — the card-1 HSS ring is the explainer's single volt element.
- **Explainer is NOT added to `WIZARD_STEP_ORDER`** — it renders its own full-bleed layout with its own page dots (card position), not the `WizardStep` chrome; the six input steps' progress dots are unchanged.
- **`initialRouteName` is the insertion mechanism** — the plan's "existing step order array" in `_layout.tsx` doesn't exist (the layout is a plain auto-registering `<Stack>`); `unstable_settings.initialRouteName` is expo-router's supported way to pin a directory stack's first route.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing critical functionality] Standalone explainer route split out of the guarded onboarding group**
- **Found during:** Task 1 (while wiring the dual-mode entry)
- **Issue:** The plan's declared artifact list assumed `app/onboarding/explainer.tsx` alone could serve the Settings revisit via a mode flag/route param. `app/_layout.tsx` wraps the whole `onboarding` screen in `Stack.Protected guard={!hasProfile}` — once a profile exists, every route under it is removed from the navigator, so the Settings push would silently fail for exactly the existing-tester audience D-19 targets.
- **Fix:** Card content extracted to `components/onboarding/ExplainerCards.tsx` (shared, undeclared file); `app/explainer.tsx` added as a top-level route (undeclared file) following the same reachable-anywhere shape as `app/session/*` and `app/modal.tsx`. `app/onboarding/explainer.tsx` remains a thin wizard-mode wrapper exactly as declared.
- **Files modified:** `apps/mobile/components/onboarding/ExplainerCards.tsx` (new), `apps/mobile/app/explainer.tsx` (new)
- **Commit:** `765832f`

No other deviations — Task 2 executed exactly as written.

## Deferred to Phase UAT (/gsd-verify-work 9)

Task 3's on-device checkpoint was auto-resolved per the standing user approval for phase-9 on-device verification checkpoints ("approved — on-device steps deferred to phase UAT"). The following steps MUST run during the phase-9 build-10 UAT:

1. **Fresh onboarding entry (D-15):** on a dev build with no profile, launch the app — the explainer must appear FIRST, before the sex step.
2. **Card mechanics (D-16):** three cards swipe horizontally with page dots tracking position; each card shows its real component rendering sample data — volt HSS ring (132, no count-up animation), amber readiness light, mini ATL/CTL trend chart.
3. **Math layer (D-17):** each card's "THE MATH ▸" toggle expands to its ATL/CTL/TSB / 14-day-calibration detail and collapses again.
4. **Skip (D-16):** Skip from any card jumps directly to the sex step (first input). The final card's "Get started" does the same.
5. **Settings revisit (D-19):** with a profile present, Settings → Guide → "How Apsis works" opens the same three cards; Close (and the final card's Done) returns to Settings.
6. **Copy review:** owner reviews the drafted card copy for voice/accuracy (the checkpoint's copy-edit loop moves to UAT).
7. **Regression check:** the three Settings unit rows (Lifts/Bodyweight/Runs) still render and toggle correctly below the Profile section.

## Known Stubs

None. The hardcoded sample data in `ExplainerCards.tsx` is plan-specified behavior (D-18: "no DB read"), not a stub — the explainer must render identical sample visuals for every user, including pre-profile ones.

## Threat Flags

None — no new network endpoints, auth paths, file access, or schema changes. T-09-13's mitigation (no profile/HSS read before onboarding completes) is implemented as specified: all card data is literal constants.

## Issues Encountered

- The worktree had no `node_modules` (fresh checkout, same finding as 09-01/09-05) — ran `pnpm install --frozen-lockfile` before typecheck; resolved entirely from the shared pnpm store, no lockfile changes.
- Session was interrupted mid-Task-1 by an API spend limit; resumed with the three Task-1 files already on disk, verified them, and continued.

## User Setup Required

None.

## Next Phase Readiness

- The full D-15..D-19 explainer surface is in place for build 10; on-device proof rides the phase-9 UAT gate (steps above).
- Merge note for the orchestrator: this plan's `settings/index.tsx` edit adds a self-contained Guide section + styles on top of 09-05's merged state; no lines from the 09-05 unit rows were touched, so wave-3 sibling merges touching other regions of the file should be clean.

---
*Phase: 09-beta-feedback-round-1*
*Completed: 2026-08-04*

## Self-Check: PASSED

All 5 declared/created source files verified present on disk; both task commits (`765832f`, `5ce7860`) verified in git history; no `@apsis/db` import in any explainer file (T-09-13).
