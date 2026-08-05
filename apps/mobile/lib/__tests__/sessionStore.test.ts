/**
 * apps/mobile/lib/__tests__/sessionStore.test.ts
 *
 * First unit tests for sessionStore.ts (D-20 removeExercise, D-21 startRestTimer
 * cancel-before-reschedule fix). Placed under lib/__tests__ (not stores/__tests__) to
 * match vitest.config.mts's `lib/**\/__tests__` include glob — apps/mobile has no broader
 * component/store test harness (see that config's header comment).
 *
 * `@apsis/db`'s barrel eagerly opens a native op-sqlite JSI connection at import time
 * (packages/db/src/client.ts) and must never be imported here, so this file mocks the
 * whole `@apsis/db` module: the real (pure, no native deps) schema tables are used so
 * `eq`/`and` build real drizzle SQL conditions, but `db` is a lightweight thenable
 * chain-builder double the test controls directly. `lib/notifications.ts` is also mocked
 * per the plan's read_first instruction.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

// expo-crypto transitively imports expo-modules-core -> react-native, which cannot be
// parsed/run under plain Node/vitest. sessionStore.ts only uses randomUUID() inside
// addExercise/addSet, neither of which this file's behavior tests exercise, but the
// module-level import must still resolve to something at import time.
vi.mock('expo-crypto', () => ({
  randomUUID: vi.fn(() => 'mock-uuid'),
}));

vi.mock('../notifications', () => ({
  scheduleRestNotification: vi.fn(async () => 'notif-default'),
  cancelRestNotification: vi.fn(async () => undefined),
}));

const mockSelect = vi.fn();
const mockDelete = vi.fn();
const mockUpdate = vi.fn();

vi.mock('@apsis/db', async () => {
  // Real schema module: pure drizzle table definitions, zero native imports (unlike
  // client.ts) — safe to import directly, bypassing the native-opening client/index barrel.
  const schema = (await import('../../../../packages/db/src/schema')) as Record<string, unknown>;
  return {
    ...schema,
    db: {
      select: (...args: unknown[]) => mockSelect(...args),
      delete: (...args: unknown[]) => mockDelete(...args),
      update: (...args: unknown[]) => mockUpdate(...args),
    },
    previousSessionSet: vi.fn(),
  };
});

import { cancelRestNotification, scheduleRestNotification } from '../notifications';
import {
  useSessionStore,
  type ExerciseCardState,
  type SetDraft,
} from '../../stores/sessionStore';

/** A minimal thenable query-builder chain: every chain method returns `this`, and awaiting
 * the chain at any point resolves via `resolver()` — mirrors how drizzle's real query
 * builders are thenable without a fixed terminal call. */
function createChain<T>(resolver: () => T | Promise<T>) {
  const chain: Record<string, unknown> = {
    from: () => chain,
    innerJoin: () => chain,
    where: (...args: unknown[]) => {
      chain.whereArgs = args;
      return chain;
    },
    orderBy: () => chain,
    limit: () => chain,
    set: () => chain,
    then: (onFulfilled: (v: T) => unknown, onRejected: (e: unknown) => unknown) =>
      Promise.resolve().then(resolver).then(onFulfilled, onRejected),
  };
  return chain;
}

const PROFILE_QUERY_KEY = 'restTimerDefaultSec';

function makeSet(overrides: Partial<SetDraft>): SetDraft {
  return {
    id: 'set-1',
    setNumber: 1,
    reps: 5,
    loadFieldKg: 60,
    rpe: 8,
    isWarmup: false,
    durationS: 0,
    committed: false,
    isBlank: false,
    ...overrides,
  };
}

function makeExercise(overrides: Partial<ExerciseCardState>): ExerciseCardState {
  return {
    exerciseId: 'ex-1',
    name: 'Bench Press',
    bodyPart: 'upper',
    bwFactor: null,
    entryMode: 'reps',
    restTimerSec: null,
    lastSessionSummary: null,
    sets: [makeSet({})],
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();

  useSessionStore.setState({
    workoutId: 'workout-1',
    profileBodyweightKg: 80,
    units: 'metric',
    exercises: [],
    liveHss: 0,
    warnings: [],
    restTimerEndsAt: null,
    restNotificationId: null,
    breakdownOpen: false,
  });

  mockSelect.mockImplementation((cols?: Record<string, unknown>) => {
    if (cols && PROFILE_QUERY_KEY in cols) {
      return createChain(() => [{ restTimerDefaultSec: 120 }]);
    }
    // recomputeSessionHss's strengthSet+exercise join select — default: no sets left.
    return createChain(() => []);
  });
  mockDelete.mockImplementation(() => createChain(() => undefined));
  mockUpdate.mockImplementation(() => createChain(() => undefined));
});

describe('startRestTimer', () => {
  it('cancels the prior notification exactly once when a rest timer is already live', async () => {
    useSessionStore.setState({ exercises: [makeExercise({})] });

    vi.mocked(scheduleRestNotification).mockResolvedValueOnce('notif-1');
    await useSessionStore.getState().startRestTimer('ex-1');
    expect(useSessionStore.getState().restNotificationId).toBe('notif-1');
    // First call: no timer was live yet, so the cancel call is a no-op with a null id
    // (mirrors addThirtySeconds' unconditional cancel-then-reschedule shape).
    expect(cancelRestNotification).toHaveBeenCalledTimes(1);
    expect(cancelRestNotification).toHaveBeenCalledWith(null, expect.any(String));

    vi.mocked(scheduleRestNotification).mockResolvedValueOnce('notif-2');
    await useSessionStore.getState().startRestTimer('ex-1');

    expect(cancelRestNotification).toHaveBeenCalledTimes(2);
    expect(cancelRestNotification).toHaveBeenLastCalledWith('notif-1', expect.any(String));
    expect(useSessionStore.getState().restNotificationId).toBe('notif-2');
  });
});

describe('removeExercise', () => {
  it('removes an exercise whose sets are all uncommitted, with no DB call', async () => {
    useSessionStore.setState({
      exercises: [makeExercise({ sets: [makeSet({ id: 's1', committed: false })] })],
    });

    await useSessionStore.getState().removeExercise('ex-1');

    expect(mockDelete).not.toHaveBeenCalled();
    expect(useSessionStore.getState().exercises).toHaveLength(0);
  });

  it('deletes committed sets in one bulk delete and recomputes HSS exactly once', async () => {
    useSessionStore.setState({
      exercises: [
        makeExercise({
          sets: [
            makeSet({ id: 's1', committed: true }),
            makeSet({ id: 's2', setNumber: 2, committed: true }),
          ],
        }),
      ],
      liveHss: 42,
      warnings: ['stale warning'],
    });

    await useSessionStore.getState().removeExercise('ex-1');

    expect(mockDelete).toHaveBeenCalledTimes(1);
    // Exactly ONE recompute select (not N per-set) and ONE workout.hss write.
    expect(mockSelect).toHaveBeenCalledTimes(1);
    expect(mockUpdate).toHaveBeenCalledTimes(1);
    expect(useSessionStore.getState().exercises).toHaveLength(0);
    // No sets remain post-delete (mocked recompute select returns []) -> HSS recomputed to 0.
    expect(useSessionStore.getState().liveHss).toBe(0);
    expect(useSessionStore.getState().warnings).toEqual([]);
  });

  it('keeps the exercise in `exercises` and does not recompute if the DB delete fails', async () => {
    useSessionStore.setState({
      exercises: [makeExercise({ sets: [makeSet({ id: 's1', committed: true })] })],
    });
    mockDelete.mockImplementation(() =>
      createChain(() => {
        throw new Error('simulated DB failure');
      })
    );

    await useSessionStore.getState().removeExercise('ex-1');

    expect(useSessionStore.getState().exercises).toHaveLength(1);
    expect(useSessionStore.getState().exercises[0]?.exerciseId).toBe('ex-1');
    // recomputeSessionHss's select must never run if the delete itself failed.
    expect(mockSelect).not.toHaveBeenCalled();
  });

  it('is a no-op if the exercise does not exist in the session', async () => {
    useSessionStore.setState({ exercises: [makeExercise({})] });

    await useSessionStore.getState().removeExercise('does-not-exist');

    expect(mockDelete).not.toHaveBeenCalled();
    expect(useSessionStore.getState().exercises).toHaveLength(1);
  });
});
