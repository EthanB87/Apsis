/**
 * apps/mobile/lib/devSeed.ts
 *
 * `__DEV__`-only ~90-day demo-data seeder + clearer for the Settings "Developer" section (quick
 * task 260907-la6 Task 3). Metro replaces `__DEV__` with the literal `false` in a production
 * bundle, so both exported bodies below dead-code-eliminate entirely -- there is no fabricated-
 * data code path in a shipped binary, and D-22 ("never a fake line in production") continues to
 * hold. Each exported function's FIRST body statement is `if (!__DEV__) return;` -- positional,
 * not merely present somewhere in the body, so no partial write can ever execute ahead of it.
 *
 * `seedDevTrendData` reuses the existing pure IF/HSS derivation (`resolveRunSegment`,
 * `sessionHSSDetailed`) exactly like `runEntry.ts`'s real save path -- this module contains zero
 * stress/EWMA arithmetic of its own. It writes `workout` + `endurance_segment` rows only and
 * then calls the existing `recomputeLoadDaily` exactly once; `load_daily` is never written
 * directly here (`recomputeLoadDaily` deletes and rebuilds it from `workout` on every call, so a
 * direct write would just be silently wiped on the next real save or the next seed/clear).
 *
 * Every seeded row's id is prefixed `devseed-` (T-la6-04) so it's recognizable, removable in one
 * tap, and so `clearDevSeedData` can find it with a parameterized `like` match -- never a raw
 * interpolated `sql` template (T-1-01) and never a bare `delete(workout)` that could take real
 * sessions with it (T-la6-02).
 *
 * This module NEVER imports `./healthkitWriteback` or `./healthkitSyncState` (T-la6-03) --
 * seeding 90 fabricated workouts into the developer's real Apple Health data would be a
 * destructive, hard-to-undo side effect on data this app does not own.
 */

import { like } from 'drizzle-orm';
import { enduranceSegment, userProfile, workout, type DB } from '@apsis/db';
import { sessionHSSDetailed } from '@apsis/engine';
import { buildDevSeedSessions } from './devSeedPlan';
import { todayLocalDate } from './localDate';
import { recomputeLoadDaily } from './recomputeLoadDaily';
import { resolveRunSegment } from './runEntryLogic';

const DEVSEED_ID_PREFIX = 'devseed-';
const DEVSEED_ID_LIKE_PATTERN = `${DEVSEED_ID_PREFIX}%`;

/** Parses a `YYYY-MM-DD` local-date string into a local `Date` anchored at noon -- mirrors
 * `runEntry.ts`'s WR-08 back-dated-entry anchor so a seeded session's `createdAt`/`finishedAt`
 * lands on the correct calendar day regardless of the device's UTC offset. */
function localDateToNoon(localDate: string): Date {
  const [year, month, day] = localDate.split('-').map((part) => Number.parseInt(part, 10));
  return new Date(year ?? 1970, (month ?? 1) - 1, day ?? 1, 12, 0, 0);
}

/**
 * Seeds ~90 days of synthetic build->taper->peak endurance sessions (Settings "Seed 90 days of
 * demo data") so the Today screen's trend chart, stat tiles, and readiness band have real data
 * to render for 06-07's App Store screenshots. `__DEV__`-guarded (T-la6-01) -- this function's
 * entire body is absent from a release bundle.
 */
export async function seedDevTrendData(database: DB): Promise<void> {
  if (!__DEV__) return;
  try {
    const profileRows = await database
      .select({
        thresholdHr: userProfile.thresholdHr,
        thresholdPaceSecPerKm: userProfile.thresholdPaceSecPerKm,
      })
      .from(userProfile)
      .limit(1);
    const profile = profileRows[0];
    const thresholdHr = profile?.thresholdHr ?? null;
    const thresholdPaceSecPerKm = profile?.thresholdPaceSecPerKm ?? null;

    const sessions = buildDevSeedSessions(todayLocalDate());

    for (let i = 0; i < sessions.length; i++) {
      const session = sessions[i]!;

      // Reused, never re-derived: the same pure IF/HSS derivation runEntry.ts's real save
      // path calls, so a seeded session's HSS is exactly what the engine would have produced.
      const { intensityFactor, es } = resolveRunSegment({
        activityType: session.activityType,
        durationS: session.durationS,
        distanceM: session.distanceM,
        avgHr: session.avgHr,
        thresholdHr,
        thresholdPaceSecPerKm,
      });
      const { hss } = sessionHSSDetailed({
        enduranceSegments: [{ durationS: session.durationS, intensityFactor }],
      });

      const workoutId = `${DEVSEED_ID_PREFIX}${session.localDate}-${i}`;
      const sessionMoment = localDateToNoon(session.localDate);

      await database.insert(workout).values({
        id: workoutId,
        localDate: session.localDate,
        type: 'endurance',
        source: 'manual',
        hss,
        createdAt: sessionMoment,
        finishedAt: sessionMoment,
      });

      await database.insert(enduranceSegment).values({
        id: `${DEVSEED_ID_PREFIX}seg-${session.localDate}-${i}`,
        workoutId,
        activityType: session.activityType,
        distanceM: session.distanceM ?? null,
        durationS: session.durationS,
        avgHr: session.avgHr,
        intensityFactor,
        stressScore: es,
      });
    }

    // Single source of truth for load_daily (D-29/RESEARCH Pattern 1) -- called exactly once,
    // after every workout/endurance_segment row above is already persisted.
    await recomputeLoadDaily(database);
  } catch (err: unknown) {
    console.error('[Apsis] seedDevTrendData failed:', err);
    throw err;
  }
}

/**
 * Removes every previously-seeded row (Settings "Clear demo data") by its `devseed-` id prefix,
 * then recomputes `load_daily` so it reflects only real sessions again. `__DEV__`-guarded
 * (T-la6-01) -- this function's entire body is absent from a release bundle.
 */
export async function clearDevSeedData(database: DB): Promise<void> {
  if (!__DEV__) return;
  try {
    // Parameterized `like` match (T-1-01) -- never a raw interpolated `sql` template, and never
    // a bare `delete(workout)` that could take real sessions with it (T-la6-02). Real workout
    // ids are `randomUUID()` values and can never match this prefix.
    await database.delete(enduranceSegment).where(like(enduranceSegment.workoutId, DEVSEED_ID_LIKE_PATTERN));
    await database.delete(workout).where(like(workout.id, DEVSEED_ID_LIKE_PATTERN));
    await recomputeLoadDaily(database);
  } catch (err: unknown) {
    console.error('[Apsis] clearDevSeedData failed:', err);
    throw err;
  }
}
