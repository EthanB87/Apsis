---
phase: 03-onboarding-lifting-logger
verified: 2026-07-09T22:15:00Z
status: passed
score: 10/11 must-haves verified
behavior_unverified: 1
overrides_applied: 0
behavior_unverified_items:

  - truth: "Completing a set starts a configurable auto-rest timer in a persistent banner that survives backgrounding via an OS local notification, with +30s/Skip and haptic+sound at zero (LIFT-05)"
    test: "On a physical iOS device: log a set and watch the banner countdown; tap +30s/Skip; background the app before expiry and confirm a local notification fires; return early and confirm it's cancelled; confirm haptic+sound at zero; confirm notification permission is requested on first timer use, not during onboarding"
    expected: "All six behaviors hold on a real device"
    why_human: "Haptics do not fire on the iOS simulator and background-notification delivery requires a physical device (per 03-07-PLAN.md's own on-device checkpoint, deferred to phase UAT with explicit user approval — 'Defer to phase UAT' response recorded in 03-07-SUMMARY.md and STATE.md)"
human_verification:

  - test: "Perform the six on-device rest-timer/notification/haptics checks from 03-07-PLAN.md Task 3 on a physical iOS device"
    expected: "Banner counts down, +30s/Skip work, background notification fires and is cancelled on early return, haptic+sound fire at zero, permission requested on first timer use not onboarding"
    why_human: "Device-only (haptics/background notifications don't work in simulator); pre-approved deferral to phase UAT, not a gap"

  - test: "Confirm finding an exercise takes under 2 taps and logging a pre-filled set takes at most 3 taps (LIFT-01/LIFT-02)"
    expected: "Add-exercise -> tap result (2 taps) selects an exercise; a pre-filled set commits in 1 tap (checkmark), a from-scratch set in at most 3 (load, RPE already pre-selected, checkmark)"
    why_human: "Tap-count and perceived entry speed vs. Strong/Hevy is a UX judgment call, not a static-analysis check"

  - test: "Confirm the rest-timer banner renders as a persistent band pinned above the tab bar / below the sticky header (not a modal) and the live-HSS count-up animation is smooth"
    expected: "Banner and HSS animation match the UI-SPEC visually"
    why_human: "Visual layout and animation smoothness require on-device rendering"

  - test: "Type a decimal load value (e.g. '62.5') into the SetRow load field on a device keyboard (CR-02 fix)"
    expected: "The field accepts '62.5' and commits 62.5 kg, not 625"
    why_human: "Code-level fix confirmed (raw text held in local state until blur); real keyboard input behavior needs on-device confirmation per 03-REVIEW-FIX.md's own note"

  - test: "Kill the app mid-workout, relaunch, and tap Resume / Finish Now on the ResumePrompt (CR-03 fix)"
    expected: "Both buttons navigate to the session/finish screen instead of landing on the default tab with the workout un-resumed"
    why_human: "Navigation timing fix (deferred router.push via useEffect) needs on-device confirmation per 03-REVIEW-FIX.md's own note"

  - test: "Back-swipe out of an active session and tap Start Workout again (WR-03 fix)"
    expected: "Returns to the same open session instead of creating a second orphaned workout row"
    why_human: "Device-only navigation/back-swipe behavior per 03-REVIEW-FIX.md's own note"

  - test: "Walk through the full onboarding wizard (sex -> bodyweight -> units -> threshold-hr -> threshold-pace -> review) including both direct-entry and estimate-for-me paths, then Save"
    expected: "Progress dots advance, soft-validation warnings show but never block Continue, Save inserts the profile and the app transitions from onboarding to the tab shell without a relaunch"
    why_human: "Full-flow visual/interaction verification requires a running device or simulator (every Plan 04/05 SUMMARY explicitly deferred this to phase UAT)"

  - test: "Edit bodyweight in Settings, then log a new set — confirm only future effective-load uses the new value while past committed sets are unchanged; toggle units and confirm display flips without changing stored metric"
    expected: "Edits apply forward-only (D-05); units toggle is display-only"
    why_human: "Requires a running app + real DB state across two screens to observe (Plan 09's own deferred verification)"
---

# Phase 03: Onboarding & Lifting Logger Verification Report

**Phase Goal:** A user completes onboarding once, then logs a full lifting session at Strong/Hevy entry speed with live HSS feedback — fully offline.
**Verified:** 2026-07-09T22:15:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Context

A code review (`03-REVIEW.md`) ran after the 9 plans executed, finding 3 Critical and 8 Warning
defects. All 11 were fixed and verified in `03-REVIEW-FIX.md` (commits `3359055`..`f2f7ceb`,
docs commit `cb582ad`). This verification checks the CURRENT post-fix code state, not the
SUMMARY.md narratives — every claim below was re-derived from the files on disk, a clean
typecheck, and passing test suites, all run fresh during this verification pass.

```
pnpm --filter @apsis/engine test  → 81/81 passing
pnpm --filter @apsis/db test      → 17/17 passing
pnpm --filter @apsis/shared test  → 7/7 passing
cd apps/mobile && npx tsc --noEmit → exit 0
pnpm -w run typecheck (tsc --build, cross-package) → exit 0
```

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Onboarding captures sex, bodyweight, threshold HR, threshold pace one-per-screen with soft validation before any profile exists; Save inserts `user_profile` and flips the `Stack.Protected` gate to the tabs (ONB-01) | ✓ VERIFIED | `apps/mobile/app/onboarding/{sex,bodyweight,units,threshold-hr,threshold-pace,review}.tsx`, `hooks/useSaveProfile.ts`, `lib/profileVersion.ts` (bump→re-query mechanism), `app/_layout.tsx` `Stack.Protected guard={!hasProfile}` |
| 2 | Onboarding is mandatory-before-app: no profile ⇒ tabs are structurally blocked; once a profile exists, onboarding is unreachable; Home tab shows no readiness/trend/session UI (ONB-03) | ✓ VERIFIED | `app/_layout.tsx` Stack.Protected gate; `app/(tabs)/index.tsx` grep for readiness/trend/chart returns nothing — confirmed live |
| 3 | User can later view and edit profile inputs from Settings, reusing the onboarding review pattern; edits are forward-only and never rewrite stored HSS scores (ONB-02) | ✓ VERIFIED | `app/(tabs)/settings/index.tsx` reuses `ProfileReview`; `hooks/useProfile.ts#update()` writes only `user_profile`; grep confirms no write to `workout`/`load_daily` |
| 4 | User can toggle km↔mi / kg↔lb display units from onboarding and Settings; all data stays stored in metric (ONB-04) | ✓ VERIFIED | `packages/shared/src/units.ts` exact round-trip (7/7 tests pass); `onboarding/units.tsx`, `settings/index.tsx` Units section |
| 5 | User finds any seeded exercise via a search-first bottom sheet (auto-focused search, Recents + A-Z by body part, exact "No matches" empty state) (LIFT-01) | ✓ VERIFIED (mechanism) | `components/session/ExercisePickerSheet.tsx` — in-memory filter, `recentExerciseIds` query runs once on open not per keystroke; exact tap-count is a UX judgment (see human verification) |
| 6 | User logs a set (load/reps/RPE/warmup) via 44×44 steppers + tap-to-keypad + an inline never-modal RPE 6–10 quick-row pre-selected to last-used, committed via a checkmark (LIFT-02/LIFT-04) | ✓ VERIFIED | `components/session/SetRow.tsx` — RPE pills rendered inline (not modal), steppers, checkmark → `commitSet`/`uncommitSet` |
| 7 | Each new set for an exercise pre-populates from that exercise's previous-session weight+reps; genuinely blank for a first-ever exercise (LIFT-03) | ✓ VERIFIED | `stores/sessionStore.ts#addExercise` calls `previousSessionSet(db, exercise.id)`; `packages/db` `previousSessionSet` query (17/17 db tests pass) |
| 8 | User can add and remove sets inline (LIFT-06) | ✓ VERIFIED | `components/session/ExerciseCard.tsx` — "+ Add set" clones previous; `ReanimatedSwipeable` swipe-left → Delete → `uncommitSet` + `removeSet` |
| 9 | Checking a set persists then recomputes `sessionHSSDetailed` over ALL committed sets (bodyweight effective-load + timed carries included), updates `workout.hss`, and the live HSS header ticks up (LIFT-08) | ✓ VERIFIED | `lib/commitSet.ts` insert-before-recompute ordering; `components/session/LiveHssHeader.tsx` Reanimated `withTiming` count-up on `store.liveHss` change |
| 10 | Completing a set starts a configurable, persistent-banner auto-rest timer that survives backgrounding via an OS local notification, with +30s/Skip and haptic+sound at zero (LIFT-05) | ⚠️ PRESENT_BEHAVIOR_UNVERIFIED | Code complete and typecheck-clean (`lib/restTimer.ts`, `lib/notifications.ts`, `components/session/RestTimerBanner.tsx`, `sessionStore.ts` timer actions) — but the 6 on-device behaviors were explicitly deferred to phase UAT with user approval at the 03-07-PLAN.md blocking checkpoint (`03-07-SUMMARY.md`: "Defer to phase UAT... NOT marked passed"); `REQUIREMENTS.md` itself lists LIFT-05 as "Pending", consistent with this |
| 11 | User can save or discard a session; discard is menu-gated (never adjacent to Finish) + confirmed + soft-deletes; session HSS shown on finish (LIFT-07) | ✓ VERIFIED | `app/session/finish.tsx` — "•••" menu, exact UI-SPEC confirm copy, `discardWorkout`/`finishWorkout` (soft-delete via `deletedAt`, never a hard delete — grep confirms no `.delete(` on workout) |

**Score:** 10/11 truths verified (1 present + wired, behavior not exercised — pre-approved UAT deferral, not a gap)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `packages/engine/src/bodyweight.ts` | D-18 rep-max e1RM | ✓ VERIFIED | `estimateE1RMFromRepMaxTable(Detailed)`, 30-rep floor clamp; tests pass |
| `packages/engine/src/carry.ts` | D-20 carry/sled stress | ✓ VERIFIED | `carryStressDetailed` now excludes `isWarmup` sets (CR-01 fix confirmed in current code, `cs: 0` early-return) |
| `packages/shared/src/units.ts` | exact km/mi, kg/lb round-trip | ✓ VERIFIED | 7/7 tests pass |
| `packages/db/src/queries.ts` | pre-fill + soft-delete + resume builders | ✓ VERIFIED | `previousSessionSet`, `activeWorkoutFilter`, `openWorkout` (with `orderBy(desc(createdAt))` — WR-03 fix), `softDeleteWorkout`, `recentExerciseIds` all present and parameterized |
| `packages/db/drizzle/0001_long_firebrand.sql` | committed migration, 8 ADD COLUMN | ✓ VERIFIED | Read directly — 8 `ALTER TABLE ... ADD` statements, no table recreation; `0000_mushy_satana.sql` unchanged |
| `apps/mobile/app/_layout.tsx` | onboarding gate + resume prompt | ✓ VERIFIED | `Stack.Protected` gate; CR-03 fix (`pendingRoute` + effect-deferred `router.push`) confirmed present |
| `apps/mobile/stores/sessionStore.ts` | active-session store, no persist | ✓ VERIFIED | No `AsyncStorage` import; WR-04/WR-05/WR-06 fixes all present (`cancelRestNotification` in `reset()`, units-aware `formatLastSessionSummary`, `Math.max`-based `setNumber`) |
| `apps/mobile/lib/commitSet.ts` | persist-then-recompute | ✓ VERIFIED | Insert before `sessionHSSDetailed` recompute over full committed set list |
| `apps/mobile/components/session/SetRow.tsx` | steppers/keypad/RPE/checkmark/warning badge | ✓ VERIFIED | CR-02 fix (`loadText` local state) present; real per-set warning badges (not a stub field) |
| `apps/mobile/app/session/finish.tsx` | finish summary + discard | ✓ VERIFIED | Big HSS, per-exercise volume, warnings list, menu-gated confirmed discard |
| `apps/mobile/components/session/RestTimerBanner.tsx` | persistent countdown banner | ✓ VERIFIED (code) | Timestamp-based, AppState foreground recompute, haptic at zero; behavior itself is the one PRESENT_BEHAVIOR_UNVERIFIED item above |
| `apps/mobile/app/(tabs)/settings/index.tsx` | profile editor + units + rest default | ✓ VERIFIED | Reuses `ProfileReview`; WR-02/WR-07 fixes present (unedited-field short-circuit, load-error retry state) |

### Key Link Verification

| From | To | Via | Status |
|------|-----|-----|--------|
| checkmark commit | `sessionHSSDetailed` recompute → `workout.hss` → live HSS header | `commitSet.ts` → `setLiveHss` → `LiveHssHeader` `withTiming` | ✓ WIRED |
| SetRow first set | `previousSessionSet` query | `sessionStore.ts#addExercise` | ✓ WIRED |
| `bwFactor != null` | `estimateE1RMFromRepMaxTable`; `entryMode: timed` | `commitSet.ts` effective-load branch | ✓ WIRED |
| `_layout.tsx` Stack.Protected guard | `useProfileExists` | drizzle count query, re-queried via `profileVersion` bump | ✓ WIRED |
| `_layout.tsx` boot | `openWorkout` → resume prompt | deferred-navigation effect (CR-03 fix) | ✓ WIRED |
| wizard steps | `onboardingDraft` store → review screen | zustand draft, no persist | ✓ WIRED |
| review Save | `useSaveProfile` → insert `user_profile` → gate flips to tabs | `profileVersion.ts` bump/subscribe | ✓ WIRED |
| set commit | `sessionStore.restTimerEndsAt` → `RestTimerBanner` + `scheduleRestNotification` | `SetRow.tsx` calls `startRestTimer` on commit | ✓ WIRED (behavior on-device unverified) |
| Finish / Discard | `finishWorkout` / `discardWorkout` → summary / soft-delete | `app/session/finish.tsx` | ✓ WIRED |
| Settings profile editor | `ProfileReview` → `useProfile#update` (forward-only) | grep confirms no write to `workout.hss`/`load_daily` | ✓ WIRED |
| units toggle | `user_profile.units` → app-wide display conversion | `packages/shared/src/units.ts` helpers used across SetRow/ProfileReview/Settings | ✓ WIRED |
| rest default | `user_profile.restTimerDefaultSec` → rest timer | `sessionStore.ts#startRestTimer` queries it (fallback 120s) | ✓ WIRED |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|---|---|---|---|---|
| ONB-01 | 03-04, 03-05 | Onboarding captures sex/bodyweight/threshold HR/pace | ✓ SATISFIED | Wizard steps + review + save, gate flip confirmed |
| ONB-02 | 03-05, 03-09 | View/edit profile from settings | ✓ SATISFIED | Settings reuses `ProfileReview`, forward-only update |
| ONB-03 | 03-03, 03-04 | Readiness gated behind onboarding | ✓ SATISFIED | Stack.Protected gate + no-readiness Home placeholder |
| ONB-04 | 03-01, 03-09 | Unit toggle, metric storage | ✓ SATISFIED | units.ts round-trip tests + toggle UI in onboarding/Settings |
| LIFT-01 | 03-06 | Search exercise <2 taps | ✓ SATISFIED (mechanism); tap-count human-judgment | ExercisePickerSheet |
| LIFT-02 | 03-01, 03-06 | Log a set ≤3 taps | ✓ SATISFIED (mechanism); tap-count human-judgment | SetRow |
| LIFT-03 | 03-02, 03-06 | Previous-session pre-fill | ✓ SATISFIED | previousSessionSet + addExercise |
| LIFT-04 | 03-06 | RPE persistent quick-row | ✓ SATISFIED | SetRow inline RPE, never modal |
| LIFT-05 | 03-07 | Auto-rest timer | ⚠️ CODE COMPLETE, UAT PENDING | Deferred per user-approved checkpoint; `REQUIREMENTS.md` lists "Pending" consistent with this |
| LIFT-06 | 03-06 | Add/remove sets inline | ✓ SATISFIED | ExerciseCard add/swipe-delete |
| LIFT-07 | 03-02, 03-08 | Save/discard with confirm, HSS on finish | ✓ SATISFIED | finish.tsx menu-gated discard + soft delete |
| LIFT-08 | 03-01, 03-06 | Live HSS updates | ✓ SATISFIED | commitSet → setLiveHss → count-up header |

No orphaned requirements — the union of every plan's `requirements:` frontmatter exactly matches the 12 IDs assigned to Phase 03 in `REQUIREMENTS.md`'s traceability table.

### Anti-Patterns Found

No blocking anti-patterns (no `TBD`/`FIXME`/`XXX` markers found anywhere under `apps/mobile`, `packages/engine/src`, `packages/db/src`, `packages/shared/src`). The Home tab's "Coming soon" text is an intentional D-31/ONB-03 placeholder, not a stub — it is required to render nothing else this phase.

The 9 Info-severity findings from `03-REVIEW.md` (IN-01 through IN-09 — e.g. no deterministic pre-fill tie-break, `updatedAt` not bumped on profile edit, a fresh `Date` created each render in one place, duplicate-exercise-selection no-op, a rare double-insert race in `useProfileExists`, "60" seconds display edge case, three units-preference copies that can diverge mid-session, a fabricated `0` HSS shown only if the finish summary query itself fails, and a hardcoded `isLowerBody: false` in one warning recompute) were deliberately left unfixed (`fix_scope = critical_warning` in `03-REVIEW-FIX.md`). None of these block any of the 11 observable truths above — they are minor, mostly edge-case behaviors documented for future cleanup, not phase-goal blockers.

### Human Verification Required

See `human_verification` in the frontmatter above (7 items): the pre-approved LIFT-05 on-device checklist, tap-count/UX judgment for LIFT-01/LIFT-02, rest-banner placement + live-HSS animation visual checks, and on-device confirmation of the three review-fix behaviors that only a running device can exercise (CR-02 decimal entry, CR-03 resume navigation, WR-03 duplicate-workout prevention), plus a full onboarding walkthrough and the Settings edit-forward/units-toggle behavioral checks.

### Gaps Summary

No gaps. All 11 observable truths either fully VERIFIED against the current (post-code-review-fix)
codebase, or — for LIFT-05 only — code-complete and wired but explicitly deferred to phase UAT
with prior user approval (not a gap; consistent with `REQUIREMENTS.md`'s own "Pending" status for
LIFT-05 and `STATE.md`'s recorded blocker note). All three test suites (engine/db/shared) pass in
full, and both `apps/mobile`'s own and the cross-package root typecheck are clean. All 11 findings
from the post-execution code review (3 Critical, 8 Warning) were re-verified present and correct
in the current code, not just claimed in `03-REVIEW-FIX.md`.

---

_Verified: 2026-07-09T22:15:00Z_
_Verifier: Claude (gsd-verifier)_
