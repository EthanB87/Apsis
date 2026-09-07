---
phase: 04-run-logger-home-dashboard
plan: 05
subsystem: mobile-ui
tags: [expo-router, drizzle, sqlite, vitest, endurance, datetimepicker, hss-engine]

# Dependency graph
requires:
  - phase: 04-run-logger-home-dashboard
    provides: "04-01's parseDurationDigits (packages/shared), workout.note migration; 04-03's recomputeLoadDaily/localDate.ts pipeline"
provides:
  - "apps/mobile/lib/runEntry.ts — saveRun(database, input) persist-then-recompute pipeline for endurance sessions"
  - "apps/mobile/lib/runEntryLogic.ts — pure, unit-tested run-segment IF-resolution/stress logic (Pitfall 6 gating)"
  - "apps/mobile/app/(tabs)/log/run.tsx — the single-screen run/erg/conditioning ledger form"
  - "Log tab 'Log Run' secondary CTA"
  - "apps/mobile vitest infra (lib/** only) — first test harness apps/mobile has ever had"
affects: [04-06 (finish.tsx endurance retrofit consumes the workoutId this plan produces), 04-07, 04-08 (Home/History read endurance sessions this plan writes)]

# Tech tracking
tech-stack:
  added:
    - "vitest 4.1.9 + vite ^6.4.3 devDependencies in apps/mobile (already hoisted in the workspace store; no new install)"
  patterns:
    - "Pure logic extraction for testability: DB-orchestration functions that must import @apsis/db's barrel (which eagerly opens the native op-sqlite JSI connection at module load, see packages/db/src/client.ts) cannot be unit-tested directly under vitest/Node — the actually risky logic (IF resolution gating) is extracted into a sibling file with zero @apsis/db / native-module imports so it CAN be tested; the DB write plumbing itself stays untested, matching the existing apps/mobile precedent (commitSet.ts, recomputeLoadDaily.ts, finishWorkout.ts are also unverified beyond grep/typecheck)"
    - "Smart digit-entry TextInput: a fully-controlled input whose value is the FORMATTED display string (not a separate raw buffer) — parseDurationDigits re-derives the running digit buffer by stripping non-digits from onChangeText's already-formatted-plus-edit text, so no separate state is needed beyond {totalSeconds, display}"

key-files:
  created:
    - apps/mobile/lib/runEntryLogic.ts
    - apps/mobile/lib/__tests__/runEntryLogic.test.ts
    - apps/mobile/lib/runEntry.ts
    - apps/mobile/app/(tabs)/log/run.tsx
    - apps/mobile/vitest.config.mts
  modified:
    - apps/mobile/app/(tabs)/log/index.tsx
    - apps/mobile/lib/localDate.ts
    - apps/mobile/package.json

key-decisions:
  - "saveRun's database param is typed DB (strict, matching commitSet.ts's convention) since it must be structurally compatible with recomputeLoadDaily's own DB-typed parameter — only the extracted pure runEntryLogic.ts functions are unit-tested, never the op-sqlite write path itself"
  - "runEntryLogic.ts imports type DB nowhere and value-imports nothing from @apsis/db at all, keeping it importable under plain Node/vitest with zero mocking"
  - "apps/mobile.expo/types/router.d.ts (gitignored build artifact) regenerated via a short-lived `npx expo start` so the new /(tabs)/log/run typed route resolves — same precedent as commit c723e11"
  - "dateToLocalDateStr(d) extracted from localDate.ts's existing todayLocalDate() so the run form's date-sheet serialization reuses the single local-date formatter (Pitfall 4) instead of a second inline implementation"

patterns-established:
  - "apps/mobile now has a minimal, deliberately-scoped vitest harness (lib/** only) — the STATE.md-documented 'no component test harness' gap remains true for screens/components, but pure lib/ logic can now get genuine RED/GREEN coverage going forward"

requirements-completed: [RUN-01, RUN-02, RUN-03, RUN-04, RUN-05]

coverage:
  - id: D1
    description: "resolveRunSegment/computePaceSecPerKm resolve a run/erg/conditioning segment's intensity factor, gating pace into resolveIF ONLY for activityType 'run' (Pitfall 6/T-04-10) — ERG/CONDITIONING rely on HR alone or a neutral warned 1.0"
    requirement: "RUN-01"
    verification:
      - kind: unit
        ref: "apps/mobile/lib/__tests__/runEntryLogic.test.ts — 9/9 passing (RED confirmed missing-module failure in dc21d35, GREEN in 539a49f)"
        status: pass
    human_judgment: false
  - id: D2
    description: "saveRun persists a finished endurance workout + endurance_segment, writes workout.hss via sessionHSSDetailed, and awaits recomputeLoadDaily so Home reflects the new session"
    requirement: "RUN-01"
    verification:
      - kind: manual_procedural
        ref: "grep verification: saveRun exported async, calls resolveRunSegment (which calls resolveIF)/sessionHSSDetailed/recomputeLoadDaily; apps/mobile typecheck shows no NEW errors beyond the two pre-existing typed-route errors"
        status: pass
    human_judgment: true
    rationale: "The op-sqlite write path requires native JSI and cannot run under vitest/Node (same constraint documented in packages/db/src/client.ts and STATE.md's apps/mobile test-harness gap) — this plan's own <verification> section defers full on-device confirmation (correct HSS, load_daily refresh) to the phase UAT gate, matching 04-03's D3 precedent."
  - id: D3
    description: "run.tsx renders the single-screen ledger: RUN/ERG/CONDITIONING segmented control (bone active fill), DISTANCE (hidden for CONDITIONING, unit-suffixed), the DURATION hero field with smart h:mm:ss entry, optional AVG HR, a live pace readout (/KM, /MI, or /500M, hidden for CONDITIONING), a TODAY date row via the native date sheet capped at today, an optional note field, and a Save Run CTA disabled only when duration is 0"
    requirement: "RUN-03"
    verification:
      - kind: manual_procedural
        ref: "grep verification: parseDurationDigits/saveRun/datetimepicker all present; apps/mobile typecheck clean beyond the two pre-existing errors"
        status: pass
    human_judgment: true
    rationale: "React Native screen rendering, keyboard behavior, and the native date-picker sheet are only observable on a device/simulator — apps/mobile has no component test harness (documented STATE.md gap). Deferred to the phase's on-device UAT gate per this plan's own <verification> section."
  - id: D4
    description: "Log tab gains a secondary ghost 'Log Run' CTA beneath the unchanged volt 'Start Workout' primary, routing to /(tabs)/log/run"
    requirement: "RUN-01"
    verification:
      - kind: manual_procedural
        ref: "grep verification: log/index.tsx contains 'log/run' and 'Log Run'; typecheck clean"
        status: pass
    human_judgment: true
    rationale: "Visual placement/styling only confirmable on-device; deferred to phase UAT gate."

duration: 22min
completed: 2026-07-10
status: complete
---

# Phase 04 Plan 05: Run Logger Summary

**Single-screen run/erg/conditioning ledger (RUN/ERG/CONDITIONING segmented control, smart h:mm:ss duration entry, live pace readout, native date sheet, optional note) backed by a saveRun pipeline that gates pace into IF resolution ONLY for activityType 'run' (Pitfall 6), writes session HSS, and recomputes load_daily — plus a new "Log Run" secondary CTA on the Log tab.**

## Performance

- **Duration:** 22 min
- **Completed:** 2026-07-10
- **Tasks:** 3
- **Files modified:** 8 (5 new, 3 modified)

## Accomplishments
- `apps/mobile/lib/runEntryLogic.ts` — pure, unit-tested IF-resolution/stress logic for run/erg/conditioning segments, gating pace to `activityType === 'run'` only (T-04-10 mitigation); 9/9 vitest tests passing
- `apps/mobile/lib/runEntry.ts` — `saveRun(database, input)` persists a finished endurance session (workout + endurance_segment), writes `workout.hss`, and awaits `recomputeLoadDaily`
- `apps/mobile/app/(tabs)/log/run.tsx` — the full single-screen ledger form per 04-UI-SPEC.md section 7: segmented activity control, DISTANCE (hidden for CONDITIONING), DURATION hero field with smart right-to-left digit entry, optional AVG HR, a live pace readout, a TODAY date row with the native date sheet capped at today, an optional note field, and a pinned Save Run CTA
- `apps/mobile/app/(tabs)/log/index.tsx` — new secondary ghost "Log Run" CTA beneath the existing volt "Start Workout" primary
- Added a minimal, deliberately-scoped vitest harness to apps/mobile (`lib/**` only) so the Pitfall-6 gating logic could get a genuine RED→GREEN cycle — apps/mobile previously had zero test coverage of any kind

## Task Commits

Each task was committed atomically (Task 1 followed the TDD RED→GREEN cycle):

1. **Task 1a (RED): failing tests for run-segment IF resolution** - `dc21d35` (test)
2. **Task 1b (GREEN): saveRun - insert + IF resolution + HSS + recompute** - `539a49f` (feat)
3. **Task 2: run.tsx - the single-screen ledger form** - `a4b652b` (feat)
4. **Task 3: Log tab Log Run secondary CTA** - `76e9127` (feat)

## Files Created/Modified
- `apps/mobile/lib/runEntryLogic.ts` - pure `resolveRunSegment`/`computePaceSecPerKm`, zero @apsis/db or native-module imports
- `apps/mobile/lib/__tests__/runEntryLogic.test.ts` - 9 tests covering RUN/ERG/CONDITIONING × HR-present/absent × pace-gating
- `apps/mobile/lib/runEntry.ts` - `saveRun`/`RunEntryInput`, the DB-write orchestration
- `apps/mobile/app/(tabs)/log/run.tsx` - the run entry screen
- `apps/mobile/app/(tabs)/log/index.tsx` - added the "Log Run" secondary CTA
- `apps/mobile/lib/localDate.ts` - extracted `dateToLocalDateStr(d)` from `todayLocalDate()`
- `apps/mobile/vitest.config.mts` - new, scoped to `lib/**/__tests__/*.test.ts`
- `apps/mobile/package.json` - added `vitest`/`vite` devDependencies + `test` script

## Decisions Made
- `runEntryLogic.ts` is a new file (beyond the plan's declared `files_modified`) extracted specifically so Task 1's `tdd="true"` requirement could be honored with a genuine RED/GREEN cycle — `@apsis/db`'s barrel import eagerly opens the native op-sqlite JSI connection at module load (`packages/db/src/client.ts`), so anything importing it (or `expo-crypto`) cannot run under vitest/Node. The extracted file has zero such imports and is fully unit-testable; `saveRun`'s own DB-write orchestration remains unverified beyond grep/typecheck, matching the existing precedent for `commitSet.ts`/`recomputeLoadDaily.ts`/`finishWorkout.ts`.
- Added a minimal `vitest.config.mts` + devDependencies to apps/mobile (both `vitest`/`vite` were already hoisted to the workspace root at the exact versions used elsewhere in the monorepo — no new package installs) scoped strictly to `lib/**` to avoid ever importing native-module-dependent screens/components.
- `saveRun`'s `database` parameter is typed `DB` (the strict op-sqlite alias), not the looser `QueryableDB` used by packages/db's pure query builders, since it must pass directly into `recomputeLoadDaily(database: DB)` without a generic-assignability question.
- `dateToLocalDateStr(d: Date): string` extracted from `localDate.ts`'s existing `todayLocalDate()` so the run form's date-sheet serialization has exactly one local-date formatter (Pitfall 4), rather than a second inline implementation in `run.tsx`.
- Regenerated the gitignored `apps/mobile/.expo/types/router.d.ts` via a short-lived `npx expo start` so `/(tabs)/log/run` typechecks as a valid route — same precedent as commit `c723e11`.
- The pace-implausibility warning (D-15, <2:30/km) is gated to `activityType === 'run'` only — ERG's /500m pace domain is different and the threshold doesn't apply there; HR>220 applies to all activity types.
- ERG distance quick-preset chips (500/1000/2000m) were cut — explicitly marked optional/"cut freely under time pressure" in the plan.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2/3 - Missing test infra + blocking] Extracted runEntryLogic.ts and added apps/mobile vitest harness**
- **Found during:** Task 1 (saveRun implementation, `tdd="true"`)
- **Issue:** The plan marks Task 1 `tdd="true"`, but apps/mobile had zero test infrastructure (documented STATE.md blocker) and `runEntry.ts`'s natural implementation imports `@apsis/db`'s barrel — which eagerly opens a native op-sqlite JSI connection at module load — making the file itself impossible to import under vitest without crashing.
- **Fix:** Extracted the one genuinely risky, pure piece of logic (Pitfall 6's pace-gating + stress computation) into `apps/mobile/lib/runEntryLogic.ts` with zero `@apsis/db`/native imports, added a minimal `vitest.config.mts` scoped to `lib/**` only, and wrote a real RED→GREEN cycle for it (9 tests). The DB write path in `runEntry.ts` itself remains unverified beyond grep/typecheck, consistent with every other apps/mobile lib file in this exact phase (`recomputeLoadDaily.ts`, `finishWorkout.ts`).
- **Files modified:** apps/mobile/lib/runEntryLogic.ts (new), apps/mobile/lib/__tests__/runEntryLogic.test.ts (new), apps/mobile/vitest.config.mts (new), apps/mobile/package.json
- **Verification:** `npx vitest run` inside apps/mobile — 9/9 passing; RED confirmed first (missing-module failure) before GREEN
- **Committed in:** dc21d35 (RED), 539a49f (GREEN)

**2. [Rule 3 - Blocking] Regenerated apps/mobile/.expo/types/router.d.ts**
- **Found during:** Task 3 (Log tab CTA, but surfaced by Task 2's new route)
- **Issue:** `router.push('/(tabs)/log/run')` failed `tsc --build` because the pre-generated, gitignored typed-routes file didn't yet know about the new `run.tsx` route file.
- **Fix:** Ran a short-lived `npx expo start` (killed after Metro finished its startup bundling) to regenerate `.expo/types/router.d.ts` locally — the same one-time regeneration step used in commit `c723e11`. This file is gitignored and not committed; any future `expo start`/`export` on a fresh checkout regenerates it automatically.
- **Files modified:** none tracked (gitignored build artifact only)
- **Verification:** `pnpm run typecheck` clean beyond the two pre-existing documented errors
- **Committed in:** n/a (no tracked file changed)

**3. [Rule 2] dateToLocalDateStr extracted from localDate.ts**
- **Found during:** Task 2 (run.tsx's date row)
- **Issue:** The run form needs to serialize an arbitrary picked `Date` (not just "today") to `YYYY-MM-DD`; duplicating the formatting logic inline in `run.tsx` would violate the project's own documented Pitfall 4 (single source of truth for local-date derivation).
- **Fix:** Extracted the body of `todayLocalDate()` into a new exported `dateToLocalDateStr(d: Date)`, with `todayLocalDate()` now calling it with `new Date()`. Zero behavior change to the existing function.
- **Files modified:** apps/mobile/lib/localDate.ts (outside this plan's declared `files_modified`, but a same-file, backward-compatible extension of an existing shared helper)
- **Verification:** `pnpm run typecheck` clean; existing callers (`recomputeLoadDaily.ts`, `log/index.tsx`) unaffected
- **Committed in:** a4b652b (Task 2 commit)

---

**Total deviations:** 3 auto-fixed (2 missing-infra/extraction, 1 blocking build-artifact regeneration)
**Impact on plan:** All three were necessary to honor the plan's own `tdd="true"` requirement and to make the declared files typecheck/build cleanly. No product-behavior scope creep — `localDate.ts`'s change is additive and backward-compatible; the vitest harness only tests new code, it does not retrofit coverage onto pre-existing untested files.

## Issues Encountered
- `npx expo start --ios` failed non-interactively (tries to launch the iOS Simulator, which requires Xcode — not available on this Windows dev host). Switched to plain `npx expo start` (no platform target) which still runs the Metro bundler and regenerates typed routes without needing a connected device/simulator.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- `saveRun` returns a `workoutId` and navigates to `/session/finish`, but `finish.tsx` currently only queries `strength_set` — an endurance session will show `hss: —`/empty on that screen until Plan 04-06's declared retrofit (branching on `workout.type`, per its own PLAN.md) lands. This is expected, not a bug: 04-06 depends on 04-03/04-04, is in the same wave as this plan, and explicitly owns the finish-screen endurance branch.
- `apps/mobile` now has a working (if narrowly-scoped) vitest harness under `lib/**` — future plans adding pure lib logic can follow the same RED/GREEN pattern established here without repeating the infra setup.
- On-device UAT (phase gate, per this plan's own `<verification>` section) still needs to confirm: logging a run completes in under a minute, the live pace readout updates correctly per keystroke, the date sheet blocks future dates, and (once 04-06 lands) the finish screen shows the correct session HSS. Flagged as `human_judgment: true` in D2/D3/D4 above.
- `apps/mobile typecheck` confirmed no NEW errors introduced by this plan's five files — only the two pre-existing documented typed-route errors (`app/onboarding/review.tsx`, `components/ExternalLink.tsx`) remain, consistent with Phase 03's deferred-items.md.

---
*Phase: 04-run-logger-home-dashboard*
*Completed: 2026-07-10*

## Self-Check: PASSED

All created/modified files verified present on disk; all four task commit hashes (dc21d35, 539a49f, a4b652b, 76e9127) verified in git log.
