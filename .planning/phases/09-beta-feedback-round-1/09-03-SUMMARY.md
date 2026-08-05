---
phase: 09-beta-feedback-round-1
plan: 03
subsystem: lifting-logger
tags: [zustand, sessionStore, expo-notifications, drizzle-orm, vitest]

requires:
  - phase: 03-lifting-logger
    provides: sessionStore.ts active-session state, ExerciseCard.tsx SetRow ledger, commitSet.ts persist-then-recompute pipeline, lib/notifications.ts rest-timer notification wrapper
provides:
  - "startRestTimer cancel-before-reschedule fix (D-21): only the newest rest timer/notification is ever live"
  - "sessionStore.removeExercise(exerciseId) (D-20): DB-first bulk delete of committed strength_set rows + single HSS recompute before in-memory removal"
  - "ExerciseCard header overflow affordance + Keep/Remove confirmation modal"
  - "First sessionStore unit tests (apps/mobile/lib/__tests__/sessionStore.test.ts) with @apsis/db + lib/notifications mocking pattern for future store tests"
affects: [09-beta-feedback-round-1 remaining plans touching sessionStore/ExerciseCard, any future apps/mobile store test that needs to import @apsis/db]

actuals:
  tokens: 9800
  tasks: 2
  commits: 2

tech-stack:
  added: []
  patterns:
    - "vi.mock('@apsis/db', ...) importing the real (pure) schema.ts by relative path while replacing only the native-opening `db` singleton with a thenable chain-builder double — first precedent for testing an apps/mobile store/lib module that imports @apsis/db under vitest"
    - "recomputeSessionHss exported from commitSet.ts so multiple call sites (commitSet/uncommitSet/removeExercise) share one recompute-and-write-back pipeline instead of duplicating it"

key-files:
  created:
    - apps/mobile/lib/__tests__/sessionStore.test.ts
  modified:
    - apps/mobile/stores/sessionStore.ts
    - apps/mobile/lib/commitSet.ts
    - apps/mobile/components/session/ExerciseCard.tsx

key-decisions:
  - "Exported commitSet.ts's internal recomputeSessionHss (Rule 2 deviation, outside this plan's declared files) rather than duplicating the recompute-and-write-back logic inside sessionStore.ts — keeps the engine recompute pipeline single-sourced per D-13"
  - "removeExercise's confirmation modal is unconditional (shown for every remove, not gated on committed-set presence) — matches must_haves truth #3 literally and mirrors History's swipe-delete confirmation pattern exactly"
  - "sessionStore.test.ts mocks 'expo-crypto' (transitively imports expo-modules-core -> react-native, unparseable under vitest/node) in addition to the plan's specified lib/notifications.ts and @apsis/db mocks"

patterns-established:
  - "Store/lib tests that must import @apsis/db: mock the package wholesale, but re-import the real schema.ts by relative path (packages/db/src/schema.ts is pure, zero native deps) so eq()/and() operate on real drizzle column objects instead of throwing on plain mock objects"

requirements-completed: [D-20, D-21]

duration: 13min
completed: 2026-08-04
status: checkpoint
---

# Phase 09 Plan 03: Rest-timer notification leak + delete-exercise flow Summary

**Fixed the rest-timer notification leak (cancel-before-reschedule) and added a DB-first removeExercise store action with a header overflow confirmation affordance; paused at the on-device verification checkpoint (Task 3), which requires a physical iOS device.**

## Performance

- **Duration:** ~13 min (Tasks 1-2)
- **Started:** 2026-08-04T21:10:13-04:00 (branch base commit)
- **Completed (Tasks 1-2):** 2026-08-04T21:22:49-04:00
- **Tasks:** 2/3 completed (Task 3 is a blocking on-device checkpoint, not executable in this environment)
- **Files modified:** 3 (+1 new test file)

## Accomplishments

- `startRestTimer` now captures and cancels the outgoing `restNotificationId` before scheduling a new one (D-21) — committing a new set before rest ends no longer leaves the prior OS notification scheduled; only the newest timer/notification is ever live.
- Added `sessionStore.removeExercise(exerciseId)` (D-20): for an exercise with committed sets, does a single bulk `strength_set` delete scoped by `workoutId` + `exerciseId`, then recomputes session HSS exactly once (never per-set) and writes it back to `workout.hss` — DB-first, before the exercise leaves the in-memory `exercises` list. On DB failure, the exercise stays in-memory and the failure is logged (no silent SQLite drift).
- `ExerciseCard` header now has a discoverable "···" overflow affordance (`accessibilityLabel="Remove exercise"`) opening a Keep/Remove confirmation modal (mirrors History's swipe-delete confirmation shape) before calling `removeExercise`.
- First-ever `sessionStore` unit tests (5 tests, `apps/mobile/lib/__tests__/sessionStore.test.ts`), establishing the mocking pattern needed to test any apps/mobile module that imports `@apsis/db` under vitest.

## Task Commits

Each task was committed atomically:

1. **Task 1: startRestTimer cancel-before-reschedule fix + removeExercise store action** - `9e69df3` (feat, TDD)
2. **Task 2: ExerciseCard header overflow affordance + Remove-exercise confirmation** - `f71e0a8` (feat)
3. **Task 3: On-device verify — rest-timer fix + delete-exercise flow** - PAUSED at checkpoint (see below), no commit yet

## Files Created/Modified

- `apps/mobile/stores/sessionStore.ts` - `startRestTimer` cancel-before-reschedule fix; new `removeExercise(exerciseId)` action
- `apps/mobile/lib/commitSet.ts` - exported `recomputeSessionHss` (was module-private) so `removeExercise` reuses the single recompute pipeline
- `apps/mobile/components/session/ExerciseCard.tsx` - header row restructured to `flexDirection: 'row'` with a new "···" overflow `Pressable` + Keep/Remove confirmation `Modal`
- `apps/mobile/lib/__tests__/sessionStore.test.ts` (new) - 5 tests covering `startRestTimer`'s cancel-before-reschedule fix and `removeExercise`'s bulk-delete/recompute/failure/no-op paths

## Decisions Made

- Exported `commitSet.ts`'s `recomputeSessionHss` instead of duplicating the recompute-and-write-back logic inside `sessionStore.ts` — keeps the engine recompute pipeline single-sourced (D-13's "engine is the single source of truth" discipline), even though `commitSet.ts` wasn't in this plan's declared `files_modified`.
- Made the remove-exercise confirmation modal unconditional (always shown on tap, not gated on whether the exercise has committed sets) — the plan's must_haves truth #3 and acceptance criteria describe the affordance/confirmation pair without a committed-only carve-out, and an unconditional confirm is simpler and safer (no accidental removal of uncommitted work either).
- `sessionStore.test.ts` additionally mocks `expo-crypto` (not called out in the plan's read_first) because it transitively imports `expo-modules-core` -> `react-native`, which vitest/Node cannot parse; without this mock the module-level `import { randomUUID } from 'expo-crypto'` in `sessionStore.ts` breaks the whole test file at import time.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Exported `recomputeSessionHss` from `commitSet.ts`**
- **Found during:** Task 1 (`removeExercise` implementation)
- **Issue:** The plan's action text requires `removeExercise` to do "a single bulk delete + ONE recomputeSessionHss call, not N per-set recomputes," but `recomputeSessionHss` was a module-private function inside `commitSet.ts`, which is not in this plan's declared `files_modified`. Re-implementing the recompute-and-write-back logic inline in `sessionStore.ts` would have duplicated `commitSet`/`uncommitSet`'s existing pipeline and risked drift between the two copies.
- **Fix:** Changed `async function recomputeSessionHss` to `export async function recomputeSessionHss` in `commitSet.ts` (one-line change), and imported it in `sessionStore.ts`.
- **Files modified:** `apps/mobile/lib/commitSet.ts`
- **Verification:** `pnpm --filter=./apps/mobile test sessionStore` (5/5 pass) + `pnpm --filter=./apps/mobile test` (85/85 pass, no regressions in `commitSet`-adjacent test coverage)
- **Committed in:** `9e69df3` (Task 1 commit)

**2. [Rule 3 - Blocking] Mocked `expo-crypto` in the new test file**
- **Found during:** Task 1 (writing `sessionStore.test.ts`)
- **Issue:** `sessionStore.ts` imports `{ randomUUID } from 'expo-crypto'` at module scope; `expo-crypto` transitively imports `expo-modules-core`, which imports `react-native` — a Flow-typed file (`react-native/index.js.flow`) that Vite/Rollup's parser cannot handle under plain Node/vitest, breaking the entire test file at import time with a `RollupError: Parse failure`.
- **Fix:** Added `vi.mock('expo-crypto', () => ({ randomUUID: vi.fn(() => 'mock-uuid') }))` to the top of `sessionStore.test.ts`, alongside the plan's specified `lib/notifications.ts` and `@apsis/db` mocks.
- **Files modified:** `apps/mobile/lib/__tests__/sessionStore.test.ts`
- **Verification:** `pnpm --filter=./apps/mobile test sessionStore` passes cleanly
- **Committed in:** `9e69df3` (Task 1 commit)

---

**Total deviations:** 2 auto-fixed (1 missing critical / Rule 2, 1 blocking / Rule 3)
**Impact on plan:** Both necessary for correctness/testability. No scope creep — neither changes any behavior outside sessionStore.ts's D-20/D-21 fix surface.

## Issues Encountered

- The worktree had no `node_modules` installed (fresh worktree checkout); `pnpm install --frozen-lockfile` was required before either `pnpm --filter=./apps/mobile test` or `pnpm typecheck` could run. Not a deviation — standard worktree bootstrap, no lockfile changes resulted.
- The plan's stated verify command `pnpm --filter apps/mobile test sessionStore` did not match pnpm's filter syntax against this package (`@apsis/mobile`, not `apps/mobile`); used `pnpm --filter=./apps/mobile test sessionStore` (path-based filter) instead, which is equivalent and green.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Tasks 1-2 are code-complete, unit-tested (`pnpm --filter=./apps/mobile test`: 85/85 pass, up from 80), and typecheck-clean (`pnpm typecheck`: 0 errors).
- **Task 3 is a blocking `checkpoint:human-verify` (gate="blocking") requiring a physical iOS dev-build device** — cannot be executed in this environment (Windows host, no on-device access). Two behaviors need on-device confirmation per the plan:
  1. Committing sets rapidly before rest elapses produces only ONE final rest notification (no 3-4 stale back-to-back buzzes).
  2. Adding an exercise, committing 2-3 sets, then removing it via the new "···" confirm flow: the exercise disappears, live session HSS drops, and a crash-resume (kill + reopen) does NOT resurrect the removed exercise's sets (committed rows are actually gone from SQLite).
- Resume signal per the plan: "Type 'approved' or describe the stale-notification / orphaned-set behavior observed."

---
*Phase: 09-beta-feedback-round-1*
*Completed: 2026-08-04 (Tasks 1-2; Task 3 pending on-device human verification)*
