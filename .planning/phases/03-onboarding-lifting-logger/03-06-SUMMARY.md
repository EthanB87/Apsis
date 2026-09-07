---
phase: 03-onboarding-lifting-logger
plan: 06
subsystem: ui
tags: [zustand, drizzle, gorhom-bottom-sheet, reanimated, gesture-handler, hss-live-update]

# Dependency graph
requires:
  - phase: 03-onboarding-lifting-logger
    provides: "Plan 01's estimateE1RMFromRepMaxTable/carryStress/sessionHSSDetailed(carrySets) and @apsis/shared units.ts; Plan 02's schema columns (exercise.bwFactor/entryMode, workout.finishedAt/deletedAt, strength_set.addedLoadKg/durationS) and query builders (previousSessionSet, openWorkout, softDeleteWorkout); Plan 04/05's Stack.Protected onboarding gate and user_profile row (bodyweightKg/units) this plan reads"
provides:
  - "sessionStore.ts: in-memory zustand active-session store (exercise cards, set drafts, liveHss, restTimerEndsAt/breakdownOpen UI flags) with startSession/rehydrateFromDb — no persist/AsyncStorage, SQLite is the sole durable state"
  - "lib/effectiveLoad.ts#computeEffectiveLoad and lib/commitSet.ts#commitSet/uncommitSet: the D-13 persist-then-recompute pipeline other logging UI (Plans 07/08, Phase 4 endurance) can reuse for any future set/segment commit flow"
  - "log/index.tsx + log/session.tsx: the reachable Log-tab entry point and active-session screen, with RestTimerBanner/HSSBreakdownSheet/session/finish.tsx mounted as stub extension points"
  - "packages/db/src/queries.ts#recentExerciseIds: reusable 'most recently used' query, generically useful for any future recents UI"
  - "apps/mobile app/_layout.tsx now wraps the whole app in GestureHandlerRootView — a prerequisite any future gesture-handler/bottom-sheet consumer (Phase 4+) can rely on without re-wiring"
affects: [03-07, 03-08, 04-run-logger]

# Tech tracking
tech-stack:
  added: ["@apsis/engine as an apps/mobile workspace dependency (previously only a devDependency of other packages)", "react-native-gesture-handler as an explicit apps/mobile dependency (was transitive-only via @gorhom/bottom-sheet)"]
  patterns:
    - "Persist-then-recompute (D-13): every commitSet/uncommitSet call inserts/deletes the strength_set row FIRST, then re-runs sessionHSSDetailed over ALL committed sets for the workout (never an incremental delta), then writes workout.hss — recomputeSessionHss is the single shared implementation both directions call"
    - "loadFieldKg naming convention: SetDraft.loadFieldKg is 'whatever the user types into the load field' (full load for a barbell lift, added weight only for a bodyweight movement per D-17) — computeEffectiveLoad(exercise, loadFieldKg, bodyweightKg) works uniformly for both cases since bwFactor==null just returns loadFieldKg unchanged"
    - "Client-generated set ids (expo-crypto randomUUID) are created once in sessionStore.ts and reused as the persisted strength_set.id — no id remapping between draft and committed states"
    - "Committed-set field locking: once draft.committed is true, SetRow disables all its inputs until unchecked, preventing the in-memory draft from silently drifting away from the persisted SQLite row"
    - "Reanimated count-up number via AnimatedTextInput (Animated.createAnimatedComponent(TextInput) + addWhitelistedNativeProps({text:true}) + useAnimatedProps returning {text: ...}) — the standard escape-hatch pattern for animating a live-updating numeric label with withTiming"
    - "Stub mount-point files (RestTimerBanner.tsx, HSSBreakdownSheet.tsx, session/finish.tsx) are real store-subscribed components, not no-ops, so later plans (07/08) only add rendering logic without re-wiring session.tsx"

key-files:
  created:
    - apps/mobile/stores/sessionStore.ts
    - apps/mobile/lib/effectiveLoad.ts
    - apps/mobile/lib/commitSet.ts
    - apps/mobile/app/(tabs)/log/_layout.tsx
    - apps/mobile/app/(tabs)/log/index.tsx
    - apps/mobile/components/session/ExercisePickerSheet.tsx
    - apps/mobile/components/session/SetRow.tsx
    - apps/mobile/components/session/ExerciseCard.tsx
    - apps/mobile/components/session/LiveHssHeader.tsx
    - apps/mobile/app/(tabs)/log/session.tsx
    - apps/mobile/components/session/RestTimerBanner.tsx
    - apps/mobile/components/session/HSSBreakdownSheet.tsx
    - apps/mobile/app/session/finish.tsx
  modified:
    - apps/mobile/package.json
    - apps/mobile/tsconfig.json
    - pnpm-lock.yaml
    - packages/db/src/queries.ts
    - packages/db/src/index.ts
    - apps/mobile/app/_layout.tsx

key-decisions:
  - "apps/mobile had no dependency/tsconfig wiring for @apsis/engine at all (only @apsis/db and @apsis/shared) — added it (package.json, tsconfig paths+references, pnpm install) since commitSet.ts needs sessionHSSDetailed/estimateE1RM/estimateE1RMFromRepMaxTable directly"
  - "Added recentExerciseIds to packages/db/src/queries.ts (grouped max(workout.createdAt) per exerciseId) — D-10's Recents section had no data source otherwise; runs once when the picker sheet opens, not per keystroke"
  - "Wrapped the whole app in GestureHandlerRootView in app/_layout.tsx — required by @gorhom/bottom-sheet and react-native-gesture-handler's ReanimatedSwipeable, both used for the first time in this plan; without it, gesture handling silently misbehaves"
  - "Carry-set bodyweightKg (the engine's load-ratio-multiplier input, distinct from D-16's bwFactor effective-load snapshot) is NOT persisted per set — the schema has no such column, so recomputeSessionHss always uses the CURRENT profile bodyweight for every historical carry set on every recompute; documented as a deliberate, schema-consistent choice rather than adding new persistence"
  - "Committed sets lock their input fields (steppers/keypad/RPE/W-chip) until unchecked — prevents a silent drift bug where editing a checked set's draft would diverge from the persisted row the live HSS is actually computed from"
  - "SetRow/ExerciseCard control sizing follows the UI-SPEC's literal 44x44 sizes for steppers/RPE-pills/checkmark (not hitSlop-shrunk), with the row container using flexWrap so it degrades gracefully on narrow screens instead of overflowing; only the small W chip uses hitSlop to reach the 44 minimum, matching the UI-SPEC's own worked example for small glyphs"

patterns-established:
  - "Persist-then-recompute pipeline (lib/commitSet.ts) is the reusable template for any future per-item commit that must both durably persist and update a live aggregate — Phase 4's endurance segment logging can follow the same shape"
  - "Stub-but-real mount points: a Plan can hand off a screen to a later Plan by mounting a component that subscribes to the relevant store slice and renders minimally, rather than leaving a TODO comment or omitting the mount entirely"

requirements-completed: [LIFT-01, LIFT-02, LIFT-03, LIFT-04, LIFT-06, LIFT-08]

coverage:
  - id: D1
    description: "Session store, effective-load formula, and the persist-then-recompute commit pipeline (commitSet/uncommitSet) exist, with set/workout ids from expo-crypto randomUUID and no persist/AsyncStorage in the store"
    requirement: "LIFT-08"
    verification:
      - kind: other
        ref: "apps/mobile/stores/sessionStore.ts, apps/mobile/lib/effectiveLoad.ts, apps/mobile/lib/commitSet.ts; apps/mobile npx tsc --noEmit and root pnpm run typecheck both clean; grep confirms no AsyncStorage import, no Math.random for ids, insert-before-recompute ordering in commitSet.ts"
        status: pass
    human_judgment: true
    rationale: "Confirming the live HSS actually ticks up correctly against a running op-sqlite DB requires the device/simulator flow described in this plan's own verification block — deferred to phase UAT."
  - id: D2
    description: "Exercise picker sheet (search-first, Recents + A-Z by body part, exact 'No matches' empty state) and SetRow (steppers, tap-to-keypad, inline RPE 6-10, W chip, checkmark, bodyweight effective-load label, timed-carry variant) are implemented"
    requirement: "LIFT-01"
    verification:
      - kind: other
        ref: "apps/mobile/components/session/ExercisePickerSheet.tsx, apps/mobile/components/session/SetRow.tsx; apps/mobile npx tsc --noEmit clean; grep confirms @gorhom/bottom-sheet + in-memory STARTER_EXERCISES filter (no per-keystroke db query), exact 'No matches'/'Try a different name...' copy, effective-load label format, isTimed duration branch"
        status: pass
    human_judgment: true
    rationale: "Visual verification (touch-target sizing on a real screen, keyboard behavior inside the bottom sheet, RPE segment layout) requires running on a device/simulator per this plan's verification block."
  - id: D3
    description: "Active-session screen composes the live HSS header, exercise cards, and the Add-exercise opener; rehydrates from the DB only when the store isn't already primed for the current workoutId (D-14 resume); mounts the Plan 07/08 stub components without those plans ever needing to edit session.tsx again"
    requirement: "LIFT-06"
    verification:
      - kind: other
        ref: "apps/mobile/app/(tabs)/log/session.tsx, apps/mobile/components/session/{ExerciseCard,LiveHssHeader,RestTimerBanner,HSSBreakdownSheet}.tsx, apps/mobile/app/session/finish.tsx; apps/mobile npx tsc --noEmit and root pnpm run typecheck both clean; grep confirms withTiming usage and all four components/opener present in session.tsx"
        status: pass
    human_judgment: true
    rationale: "The full add-exercise -> log-a-set -> live-HSS-count-up -> add/remove-sets -> pre-fill-from-previous-session loop is this plan's own stated Manual (phase UAT) verification step and needs a running app to observe."

duration: 27min
completed: 2026-07-09
status: complete
---

# Phase 3 Plan 06: Lifting Logger Core Summary

**Working lifting logger — zustand session store, D-13 persist-then-recompute commit pipeline, search-first exercise picker, steppered set rows with inline RPE and a live-HSS sticky header that count-ups via Reanimated on every checked set**

## Performance

- **Duration:** 27 min
- **Started:** 2026-07-09T16:32:16-04:00 (prior plan completion)
- **Completed:** 2026-07-09T16:58:55-04:00
- **Tasks:** 3
- **Files modified:** 19 (13 created, 6 modified)

## Accomplishments
- `sessionStore.ts`: in-memory-only zustand store (no `persist`/AsyncStorage) holding the
  active workout's exercise cards + set drafts, `liveHss`/`warnings[]`, and the
  `restTimerEndsAt`/`breakdownOpen` UI flags Plans 07/08 will drive; `addExercise` pre-fills
  the first set from `previousSessionSet` (LIFT-03) or leaves it genuinely blank for a
  first-ever exercise (D-07); `rehydrateFromDb` rebuilds the exact same shape from SQLite for
  D-14 resume
- `effectiveLoad.ts#computeEffectiveLoad` + `commitSet.ts#commitSet/uncommitSet`: the D-13
  persist-then-recompute pipeline — insert/delete the `strength_set` row, then re-run
  `sessionHSSDetailed` over every committed set for the workout (never a delta), then write
  `workout.hss`; routes bodyweight movements through `estimateE1RMFromRepMaxTable` and
  ordinary lifts through Epley, and timed carries through `reps: 0` + `durationS`
- `log/index.tsx`: "Start Workout" CTA creates a `workout` row and primes the store via
  `startSession` before navigating
- `ExercisePickerSheet.tsx`: `@gorhom/bottom-sheet` search-first picker — auto-focused
  search, a Recents section (new `recentExerciseIds` query) above an A-Z-by-body-part list,
  all filtered in-memory against `STARTER_EXERCISES`, exact "No matches" empty-state copy
- `SetRow.tsx`: 44x44 steppers (weight kg/lb round-trip, reps, timed duration), tap-to-keypad
  numeric TextInputs, an inline never-modal RPE 6-10 segment control, a W warmup chip, and a
  44x44 checkmark wired straight to `commitSet`/`uncommitSet`; renders "≈ {value} kg
  effective" for bodyweight movements and locks all its fields once committed
- `ExerciseCard.tsx`: stacked SetRows with hairline dividers, "+ Add set" (clones previous),
  and `react-native-gesture-handler`'s `ReanimatedSwipeable` for swipe-left -> Delete that
  deletes the persisted row and recomputes HSS before the row leaves the UI
- `LiveHssHeader.tsx`: pinned elapsed-time + live-HSS bar; the HSS number count-ups via
  Reanimated `withTiming` on an `AnimatedTextInput`; tapping it opens the breakdown sheet;
  "Finish" marks `workout.finishedAt` and routes to the finish stub
- `session.tsx`: composes everything above, rehydrates only when the store isn't already
  primed for the current `workoutId`, and mounts `RestTimerBanner`/`HSSBreakdownSheet`/
  `ExercisePickerSheet` as real store-subscribed stub extension points for Plans 07/08

## Task Commits

Each task was committed atomically:

1. **Task 1: Session store + effective-load + commit pipeline + Log entry** - `ac0e59a` (feat)
2. **Task 2: Exercise picker sheet + SetRow** - `c6a938a` (feat)
3. **Task 3: Active session screen + live HSS header + add/remove sets + stub mount points** - `8e771d9` (feat)

**Plan metadata:** _(this commit)_

## Files Created/Modified
- `apps/mobile/stores/sessionStore.ts` - zustand active-session store, in-memory only
- `apps/mobile/lib/effectiveLoad.ts` - computeEffectiveLoad (D-15/D-16/D-17)
- `apps/mobile/lib/commitSet.ts` - commitSet/uncommitSet persist-then-recompute pipeline, fetchProfileSummary
- `apps/mobile/app/(tabs)/log/_layout.tsx` - Log-tab Stack
- `apps/mobile/app/(tabs)/log/index.tsx` - "Start Workout" entry
- `apps/mobile/components/session/ExercisePickerSheet.tsx` - search-first exercise picker
- `apps/mobile/components/session/SetRow.tsx` - set entry row
- `apps/mobile/components/session/ExerciseCard.tsx` - exercise card with add/remove sets
- `apps/mobile/components/session/LiveHssHeader.tsx` - sticky header with count-up HSS
- `apps/mobile/app/(tabs)/log/session.tsx` - active-session screen
- `apps/mobile/components/session/RestTimerBanner.tsx` - Plan 07 stub mount point
- `apps/mobile/components/session/HSSBreakdownSheet.tsx` - Plan 08 stub mount point
- `apps/mobile/app/session/finish.tsx` - Plan 08 stub mount point
- `apps/mobile/package.json` - added @apsis/engine + react-native-gesture-handler deps
- `apps/mobile/tsconfig.json` - added @apsis/engine path + project reference
- `pnpm-lock.yaml` - regenerated after dependency additions
- `packages/db/src/queries.ts` - added recentExerciseIds
- `packages/db/src/index.ts` - exported recentExerciseIds
- `apps/mobile/app/_layout.tsx` - wrapped app in GestureHandlerRootView, dropped stale comments

## Decisions Made
- `loadFieldKg` naming: SetDraft's load field stores "whatever the user types" (full load for
  barbell lifts, added weight only for bodyweight movements) so `computeEffectiveLoad` applies
  uniformly to both cases via the same call shape
- Carry-set `bodyweightKg` (the engine's load-ratio-multiplier input) is not persisted per set
  (no schema column for it) — every recompute uses the current profile bodyweight for all
  historical carry sets, a deliberate schema-consistent choice rather than adding new state
- Committed sets lock their inputs until unchecked, preventing silent draft/DB drift
- Steppers/RPE-pills/checkmark use literal 44x44 visual sizes per the UI-SPEC's explicit
  component notes (not hitSlop-shrunk), with `flexWrap` on the row so it degrades gracefully
  on narrow screens; only the small W chip uses hitSlop, matching the UI-SPEC's own worked
  example for small glyphs

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Wired @apsis/engine into apps/mobile's dependencies/tsconfig**
- **Found during:** Task 1 (`commitSet.ts` importing `sessionHSSDetailed`/`estimateE1RM`/`estimateE1RMFromRepMaxTable`)
- **Issue:** `apps/mobile` had never depended on `@apsis/engine` (only `@apsis/db` and
  `@apsis/shared`) — no `package.json` dependency, no tsconfig `paths`/`references` entry.
  `npx tsc --noEmit` failed with `Cannot find module '@apsis/engine'`.
- **Fix:** Added `"@apsis/engine": "workspace:*"` to `apps/mobile/package.json`, added the
  matching `paths`/`references` entries to `apps/mobile/tsconfig.json`, ran `pnpm install` to
  create the workspace symlink.
- **Files modified:** `apps/mobile/package.json`, `apps/mobile/tsconfig.json`, `pnpm-lock.yaml`
- **Verification:** `apps/mobile`'s own `npx tsc --noEmit` and root `pnpm run typecheck` both clean.
- **Committed in:** `ac0e59a` (Task 1 commit)

**2. [Rule 2 - Missing Critical] Added recentExerciseIds query for the picker's Recents section**
- **Found during:** Task 2 (`ExercisePickerSheet.tsx`)
- **Issue:** D-10 requires a "Recents" section above the A-Z list, but no query existed to
  produce it — without one, Recents would always be empty, silently dropping part of the
  decision this task's own `read_first` pointed to.
- **Fix:** Added `recentExerciseIds(db, limit)` to `packages/db/src/queries.ts` — a grouped
  `max(workout.createdAt)` per `exerciseId` over active (non-deleted) workouts — exported via
  `index.ts`. Runs once when the picker sheet opens, not per keystroke, so it doesn't violate
  this task's own "no db query inside the keystroke handler" acceptance criterion.
- **Files modified:** `packages/db/src/queries.ts`, `packages/db/src/index.ts`
- **Verification:** `apps/mobile npx tsc --noEmit` clean; grep confirms the query is called
  only inside the sheet's `visible`-keyed `useEffect`, not the search `onChangeText` handler.
- **Committed in:** `c6a938a` (Task 2 commit)

**3. [Rule 2 - Missing Critical] Wrapped the app in GestureHandlerRootView**
- **Found during:** Task 2 (`ExercisePickerSheet.tsx` first use of `@gorhom/bottom-sheet`)
- **Issue:** Neither `@gorhom/bottom-sheet` nor `react-native-gesture-handler`'s `Swipeable`
  had been used anywhere in the app before this plan, and the app root was never wrapped in
  `GestureHandlerRootView` — both libraries require it; without it gesture handling silently
  misbehaves (especially on Android, inconsistently on iOS).
- **Fix:** Wrapped every branch of `app/_layout.tsx`'s render (error/loading/resume/success)
  in `GestureHandlerRootView`. Also added `react-native-gesture-handler` as an explicit
  `apps/mobile` dependency (previously only a transitive dep of `@gorhom/bottom-sheet`) since
  Task 3's `ExerciseCard.tsx` imports it directly for `Swipeable`.
- **Files modified:** `apps/mobile/app/_layout.tsx`, `apps/mobile/package.json` (folded into
  the same `pnpm install` pass as deviation #1's `@apsis/engine` addition to avoid a second
  lockfile churn cycle)
- **Verification:** `apps/mobile npx tsc --noEmit` and root `pnpm run typecheck` both clean.
- **Committed in:** `c6a938a` (Task 2 commit); the `package.json`/lockfile portion landed in
  `ac0e59a` (Task 1 commit, bundled with the `@apsis/engine` wiring)

**4. [Rule 1 - Bug] Locked a committed set's fields until unchecked**
- **Found during:** Task 3 (wiring `ExerciseCard`'s swipe-delete against `SetRow`'s commit flow)
- **Issue:** `SetRow`'s steppers/keypad/RPE/W-chip remained editable after a set was
  committed. Editing them would update the in-memory draft without touching the persisted
  `strength_set` row or recomputing `workout.hss`, silently drifting the UI's displayed
  values away from what the live HSS was actually computed from.
- **Fix:** Added a `locked = draft.committed` guard; every interactive control in `SetRow`
  (steppers, load/reps/duration `TextInput`s, RPE pills, W chip) is disabled/non-editable
  while `locked`, forcing the user through uncheck (which deletes + recomputes) before editing.
- **Files modified:** `apps/mobile/components/session/SetRow.tsx`
- **Verification:** `apps/mobile npx tsc --noEmit` clean; inspected that every mutating
  control now reads `disabled={locked}` / `editable={!locked}`.
- **Committed in:** `8e771d9` (Task 3 commit)

---

**Total deviations:** 4 auto-fixed (1 blocking, 2 missing critical, 1 bug)
**Impact on plan:** All four were necessary for the plan's own stated must-haves to hold at
runtime (engine import, Recents data source, working gesture/bottom-sheet UI, and DB/UI
consistency after a commit). No scope creep beyond closing these gaps — no new screens,
features, or requirements were added.

## Issues Encountered
- `apps/mobile`'s own `npx tsc --noEmit` resolved a stale `packages/db/dist/index.d.ts`
  (missing the new `recentExerciseIds` export) until the composite project reference was
  rebuilt via root `pnpm run typecheck` — same cross-package project-reference behavior noted
  in Plans 01/04's summaries; resolved by running the root typecheck once after each new
  `packages/db` export.
- Reanimated's `useAnimatedProps` generic inference produced a structural type mismatch
  against `AnimatedTextInput`'s `animatedProps` prop (`{text: string}` compared against the
  `style` prop's type) — resolved with a scoped `as Partial<ComponentProps<typeof TextInput>>`
  cast on the JSX prop only, the standard escape hatch for this documented reanimated
  "animated counter" pattern.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- LIFT-01/02/03/04/06/08 are functionally wired: search-first picker, pre-filled/steppered
  set entry, inline RPE, checkmark-to-commit with live HSS count-up, add/remove sets, and
  resume-from-DB rehydration.
- `RestTimerBanner.tsx`, `HSSBreakdownSheet.tsx`, and `app/session/finish.tsx` are real,
  store-subscribed stub files ready for Plan 07 (D-25/D-26 rest timer) and Plan 08 (D-24
  breakdown rollup, D-27/D-28 finish summary + discard) to flesh out without ever touching
  `session.tsx` again.
- `lib/commitSet.ts`'s persist-then-recompute pattern and `packages/db/src/queries.ts#recentExerciseIds`
  are both generically reusable — Phase 4's endurance/run logger can follow the same commit
  shape for `endurance_segment` rows.
- Full end-to-end device/simulator verification (search -> add exercise -> log a pre-filled
  set in ~1 tap -> watch the HSS count up -> add/remove sets -> pre-fill from a previous
  session) is deferred to phase UAT per this plan's own verification block, consistent with
  Plans 03-04/03-05's precedent.
- No blockers for Plans 07/08.

---
*Phase: 03-onboarding-lifting-logger*
*Completed: 2026-07-09*

## Self-Check: PASSED

All 13 created files verified present on disk; all 3 task commit hashes
(ac0e59a, c6a938a, 8e771d9) verified present in `git log --oneline --all`.
