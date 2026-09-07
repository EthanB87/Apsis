/**
 * apps/mobile/app/(tabs)/index.tsx -- TODAY dashboard (HOME-01..04, D-07 rename from "Home")
 *
 * The payoff screen where the unified HSS number and readiness become visible. Composes
 * (D-17 scroll order): mono timestamp + "LET'S WORK" greeting -> HssRing (200px, today's
 * dayHss, readiness band) -> ReadinessLight -> StatTiles (ATL/CTL/TSB) -> TrendChart (28-day
 * scrub chart) -> today's session rows (or the D-06 empty-state ghost shortcuts).
 *
 * Every `load_daily`/`workout` read here uses `useFocusEffect` (never a bare `useEffect`,
 * Pitfall 5/STATE.md Phase 3 P10 lesson) so a stacked-screen focus regain can't resurrect
 * stale state. This screen never re-derives ATL/CTL/TSB/readiness math itself -- every value
 * comes straight from the persisted `load_daily` row or `computeLoadTrendSeries`'s own output
 * (Don't Hand-Roll, 04-RESEARCH.md).
 */

import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { eq, inArray } from 'drizzle-orm';
import {
  db,
  dayGroupedSessions,
  enduranceSegment,
  exercise,
  last28DaysTrend,
  loadDaily,
  strengthSet,
  type DB,
} from '@apsis/db';
import { formatPaceMinSec, kmToDisplayMi, paceSecPerKmToSecPerMi, type ReadinessBand, type Units } from '@apsis/shared';

import HssRing from '../../components/home/HssRing';
import ReadinessLight from '../../components/home/ReadinessLight';
import StatTiles from '../../components/home/StatTiles';
import TrendChart, { type TrendChartPoint } from '../../components/home/TrendChart';
import { TodayBreakdownSheet, type TodaySessionSummary } from '../../components/home/TodayBreakdownSheet';
import Colors from '../../constants/Colors';
import { Mono, Radius, Spacing, Typography, tabularNums } from '../../constants/theme';
import { useHealthKitImportSignal } from '../../hooks/useForegroundHealthKitSync';
import { fetchProfileSummary } from '../../lib/commitSet';
import { todayLocalDate } from '../../lib/localDate';

const CALIBRATING_WINDOW_DAYS = 14;
const MONTH_ABBR = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
const WEEKDAY_NAME = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];

// D-05's "animate once per day" gate: module-scoped (not persisted across app restarts, but
// stable across screen focus/blur within the same launch) -- a lighter-weight equivalent of
// the plan's suggested Zustand-slice/AsyncStorage pair, without adding a new store file or a
// new native dependency outside this plan's declared file scope.
let lastAnimatedHssDate: string | null = null;
let lastAnimatedHssValue: number | null = null;

function shouldAnimateRing(today: string, hss: number): boolean {
  const roundedHss = Math.round(hss);
  const changed = lastAnimatedHssDate !== today || lastAnimatedHssValue !== roundedHss;
  if (changed) {
    lastAnimatedHssDate = today;
    lastAnimatedHssValue = roundedHss;
  }
  return changed;
}

// D-10's "show once per batch" gate: module-scoped (mirrors lastAnimatedHssDate/
// lastAnimatedHssValue above), keyed on the import signal's syncedAt timestamp -- each
// completed foreground sync batch gets a distinct syncedAt, so this is a stable batch id
// without needing a dedicated field on useHealthKitImportSignal. Not persisted: a stale
// notice from a prior app session should never resurface after a relaunch (mirrors the
// import signal store's own non-persisted design, 05-05).
let lastShownImportBatchAt: number | null = null;

function importNoticeForBatch(importedCount: number | null, syncedAt: Date | null): string | null {
  if (importedCount == null || importedCount <= 0 || syncedAt == null) return null;
  const batchKey = syncedAt.getTime();
  if (lastShownImportBatchAt === batchKey) return null; // already shown for this batch
  lastShownImportBatchAt = batchKey;
  return `IMPORTED ${importedCount} SESSION${importedCount === 1 ? '' : 'S'} FROM APPLE HEALTH`;
}

function formatShortDate(localDate: string): string {
  const [, month, day] = localDate.split('-').map((part) => Number.parseInt(part, 10));
  return `${MONTH_ABBR[(month ?? 1) - 1]} ${day}`;
}

function formatGreetingTimestamp(d: Date): string {
  return `${WEEKDAY_NAME[d.getDay()]} · ${MONTH_ABBR[d.getMonth()]} ${d.getDate()}`;
}

function capitalize(s: string): string {
  return s.length === 0 ? s : s.charAt(0).toUpperCase() + s.slice(1);
}

// Compact h:mm:ss / m:ss duration (no " total" suffix) -- matches finish.tsx's
// formatSessionDuration convention for a "distance · pace · duration" compound line.
function formatCompactDuration(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = Math.floor(totalSeconds % 60);
  return hours > 0
    ? `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
    : `${minutes}:${String(seconds).padStart(2, '0')}`;
}

type ActivityType = 'run' | 'erg' | 'conditioning' | 'sled' | 'other';

// Per-type endurance metadata line (04-UI-SPEC.md section 6): run/erg show distance + pace +
// duration; conditioning shows duration + AVG HR only (D-16, no distance/pace concept). Mirrors
// app/session/finish.tsx's formatEnduranceSummary (not exported there, so duplicated here as a
// small, presentation-only helper -- finish.tsx is outside this plan's declared file scope).
function formatEnduranceMeta(
  activityType: ActivityType,
  distanceM: number | null,
  durationS: number,
  avgHr: number | null,
  units: Units
): string {
  const durationLabel = formatCompactDuration(durationS);

  if (activityType === 'conditioning') {
    return avgHr != null ? `${durationLabel} · ${avgHr} BPM` : durationLabel;
  }

  if (activityType === 'erg') {
    const pace = distanceM != null && distanceM > 0 ? durationS / (distanceM / 500) : null;
    const distanceLabel = distanceM != null ? `${Math.round(distanceM)} M` : null;
    const paceLabel = pace != null ? `${formatPaceMinSec(pace)} /500M` : null;
    return [distanceLabel, paceLabel, durationLabel].filter(Boolean).join(' · ');
  }

  const paceSecPerKm = distanceM != null && distanceM > 0 ? durationS / (distanceM / 1000) : null;
  const distanceLabel =
    distanceM != null
      ? units === 'imperial'
        ? `${kmToDisplayMi(distanceM / 1000).toFixed(1)} MI`
        : `${(distanceM / 1000).toFixed(1)} KM`
      : null;
  const paceLabel =
    paceSecPerKm != null
      ? `${formatPaceMinSec(units === 'imperial' ? paceSecPerKmToSecPerMi(paceSecPerKm) : paceSecPerKm)} /${units === 'imperial' ? 'MI' : 'KM'}`
      : null;
  return [distanceLabel, paceLabel, durationLabel].filter(Boolean).join(' · ');
}

interface LiftMeta {
  bodyPart: string;
  liftCount: number;
  avgRpe: number | null;
}

/** Groups today's strength/hybrid workouts' committed sets by workoutId: the dominant
 * (most-frequent) body part, distinct-exercise count ("N LIFTS"), and average RPE. */
async function fetchLiftMetaByWorkout(database: DB, workoutIds: string[]): Promise<Map<string, LiftMeta>> {
  if (workoutIds.length === 0) return new Map();

  const rows = await database
    .select({
      workoutId: strengthSet.workoutId,
      exerciseId: strengthSet.exerciseId,
      bodyPart: exercise.bodyPart,
      rpe: strengthSet.rpe,
    })
    .from(strengthSet)
    .innerJoin(exercise, eq(strengthSet.exerciseId, exercise.id))
    .where(inArray(strengthSet.workoutId, workoutIds));

  const byWorkout = new Map<
    string,
    { exerciseIds: Set<string>; bodyPartCounts: Map<string, number>; rpeSum: number; rpeCount: number }
  >();
  for (const row of rows) {
    let acc = byWorkout.get(row.workoutId);
    if (!acc) {
      acc = { exerciseIds: new Set(), bodyPartCounts: new Map(), rpeSum: 0, rpeCount: 0 };
      byWorkout.set(row.workoutId, acc);
    }
    acc.exerciseIds.add(row.exerciseId);
    const bodyPart = row.bodyPart ?? 'full';
    acc.bodyPartCounts.set(bodyPart, (acc.bodyPartCounts.get(bodyPart) ?? 0) + 1);
    if (row.rpe != null) {
      acc.rpeSum += row.rpe;
      acc.rpeCount += 1;
    }
  }

  const result = new Map<string, LiftMeta>();
  for (const [workoutId, acc] of byWorkout) {
    let dominantBodyPart = 'full';
    let maxCount = -1;
    for (const [bodyPart, count] of acc.bodyPartCounts) {
      if (count > maxCount) {
        dominantBodyPart = bodyPart;
        maxCount = count;
      }
    }
    result.set(workoutId, {
      bodyPart: dominantBodyPart,
      liftCount: acc.exerciseIds.size,
      avgRpe: acc.rpeCount > 0 ? acc.rpeSum / acc.rpeCount : null,
    });
  }
  return result;
}

interface EnduranceRow {
  activityType: ActivityType;
  distanceM: number | null;
  durationS: number;
  avgHr: number | null;
}

async function fetchEnduranceByWorkout(database: DB, workoutIds: string[]): Promise<Map<string, EnduranceRow>> {
  if (workoutIds.length === 0) return new Map();

  const rows = await database
    .select({
      workoutId: enduranceSegment.workoutId,
      activityType: enduranceSegment.activityType,
      distanceM: enduranceSegment.distanceM,
      durationS: enduranceSegment.durationS,
      avgHr: enduranceSegment.avgHr,
    })
    .from(enduranceSegment)
    .where(inArray(enduranceSegment.workoutId, workoutIds));

  const map = new Map<string, EnduranceRow>();
  for (const row of rows) {
    // RUN-01..06 saves exactly one endurance_segment per workout -- first row wins.
    if (!map.has(row.workoutId)) map.set(row.workoutId, row);
  }
  return map;
}

function buildLiftMetaLine(meta: LiftMeta): string {
  const parts = [meta.bodyPart.toUpperCase(), `${meta.liftCount} LIFT${meta.liftCount === 1 ? '' : 'S'}`];
  if (meta.avgRpe != null) parts.push(`RPE ${Math.round(meta.avgRpe)}`);
  return parts.join(' · ');
}

interface HomeState {
  loading: boolean;
  dayHss: number;
  band: ReadinessBand;
  atl: number;
  ctl: number;
  tsb: number;
  /** Count of contiguous `load_daily` rows through today -- the athlete's history length. */
  historyDays: number;
  trendData: TrendChartPoint[];
  todaySessions: TodaySessionSummary[];
  animateRing: boolean;
}

const INITIAL_STATE: HomeState = {
  loading: true,
  dayHss: 0,
  band: 'calibrating',
  atl: 0,
  ctl: 0,
  tsb: 0,
  historyDays: 0,
  trendData: [],
  todaySessions: [],
  animateRing: false,
};

export default function TodayScreen(): React.JSX.Element {
  const router = useRouter();
  const [state, setState] = useState<HomeState>(INITIAL_STATE);
  const [breakdownOpen, setBreakdownOpen] = useState(false);
  const [importNotice, setImportNotice] = useState<string | null>(null);

  const loadHome = useCallback(async () => {
    try {
      const today = todayLocalDate();

      const [todayRows, trendRowsDesc, allSessions, profile] = await Promise.all([
        db.select().from(loadDaily).where(eq(loadDaily.localDate, today)),
        last28DaysTrend(db),
        dayGroupedSessions(db),
        fetchProfileSummary(db),
      ]);

      const trendRows = [...trendRowsDesc].reverse();
      const mostRecentRow = trendRows[trendRows.length - 1];
      const todayRow = todayRows[0];

      const band: ReadinessBand = todayRow?.readinessBand ?? mostRecentRow?.readinessBand ?? 'calibrating';
      const atl = todayRow?.atl ?? mostRecentRow?.atl ?? 0;
      const ctl = todayRow?.ctl ?? mostRecentRow?.ctl ?? 0;
      const tsb = todayRow?.tsb ?? mostRecentRow?.tsb ?? 0;
      // No load_daily row for today means no session has been logged (and recomputed) yet
      // today -- the ring correctly shows 0 regardless of yesterday's dayHss (D-06).
      const dayHss = todayRow?.dayHss ?? 0;
      const historyDays = trendRows.length;

      const trendData: TrendChartPoint[] = trendRows.map((row, index) => ({
        day: index,
        hss: row.dayHss ?? 0,
        atl: row.atl ?? 0,
        ctl: row.ctl ?? 0,
        tsb: row.tsb ?? 0,
        dateLabel: formatShortDate(row.localDate),
      }));

      const todaysWorkouts = allSessions.filter((s) => s.localDate === today);
      const liftWorkoutIds = todaysWorkouts.filter((s) => s.type !== 'endurance').map((s) => s.id);
      const enduranceWorkoutIds = todaysWorkouts.filter((s) => s.type === 'endurance').map((s) => s.id);

      const [liftMetaByWorkout, enduranceByWorkout] = await Promise.all([
        fetchLiftMetaByWorkout(db, liftWorkoutIds),
        fetchEnduranceByWorkout(db, enduranceWorkoutIds),
      ]);

      const todaySessions: TodaySessionSummary[] = todaysWorkouts.map((s) => {
        if (s.type === 'endurance') {
          const seg = enduranceByWorkout.get(s.id);
          return {
            id: s.id,
            title: seg ? capitalize(seg.activityType) : 'Run',
            metaLine: seg
              ? formatEnduranceMeta(seg.activityType, seg.distanceM, seg.durationS, seg.avgHr, profile.units)
              : '',
            hss: s.hss ?? 0,
          };
        }
        const meta = liftMetaByWorkout.get(s.id);
        return {
          id: s.id,
          title: capitalize(s.type),
          metaLine: meta ? buildLiftMetaLine(meta) : '0 LIFTS',
          hss: s.hss ?? 0,
        };
      });

      const animateRing = shouldAnimateRing(today, dayHss);

      setState({
        loading: false,
        dayHss,
        band,
        atl,
        ctl,
        tsb,
        historyDays,
        trendData,
        todaySessions,
        animateRing,
      });
    } catch (err: unknown) {
      console.error('[Apsis] TODAY dashboard load failed:', err);
      setState((prev) => ({ ...prev, loading: false }));
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadHome();
    }, [loadHome])
  );

  // D-10: read the last-import signal (05-05) via the reactive zustand selectors -- WR-10:
  // a getState() snapshot inside the focus effect misses the common path where the sync
  // completes seconds AFTER the TODAY tab is already focused (no new focus event fires on
  // AppState changes), so the notice would only ever appear after leaving and re-entering
  // the tab. With reactive selectors the focus effect re-runs when the store updates while
  // focused; `importNoticeForBatch`'s once-per-batch gate (keyed on syncedAt) still ensures
  // each completed batch shows exactly once, and a later refocus with no new batch clears it.
  const lastImportedCount = useHealthKitImportSignal((s) => s.lastImportedCount);
  const lastSyncedAt = useHealthKitImportSignal((s) => s.lastSyncedAt);
  useFocusEffect(
    useCallback(() => {
      setImportNotice(importNoticeForBatch(lastImportedCount, lastSyncedAt));
    }, [lastImportedCount, lastSyncedAt])
  );

  // Readiness-algorithm calibrating (ring): tied to the persisted band. Data-availability
  // calibrating (chart, D-22): tied to how many real days exist, independent of the band --
  // these can differ in a rare low-CTL-floor edge case, so they're computed separately.
  const ringCalibratingDayN =
    state.band === 'calibrating' ? Math.max(1, Math.min(state.historyDays, CALIBRATING_WINDOW_DAYS)) : undefined;
  const chartCalibratingDayN =
    state.historyDays < CALIBRATING_WINDOW_DAYS ? Math.max(1, state.historyDays) : undefined;

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={styles.timestamp}>{formatGreetingTimestamp(new Date())}</Text>
        <Text style={styles.greeting}>LET&apos;S WORK</Text>
        {importNotice ? <Text style={styles.importNotice}>{importNotice}</Text> : null}

        <View style={styles.ringBlock}>
          <HssRing
            size={200}
            hss={state.dayHss}
            band={state.band}
            calibratingDayN={ringCalibratingDayN}
            animate={state.animateRing}
            onPress={() => setBreakdownOpen(true)}
          />
        </View>

        <ReadinessLight band={state.band} />

        <View style={styles.tilesBlock}>
          <StatTiles atl={state.atl} ctl={state.ctl} tsb={state.tsb} />
        </View>

        <View style={styles.chartBlock}>
          <TrendChart data={state.trendData} calibratingDayN={chartCalibratingDayN} />
        </View>

        {state.todaySessions.length === 0 ? (
          <View style={styles.emptyState}>
            <Pressable
              onPress={() => router.push('/(tabs)/log')}
              accessibilityRole="button"
              accessibilityLabel="Start Workout"
              style={styles.ghostButton}>
              <Text style={styles.ghostButtonLabel}>Start Workout</Text>
            </Pressable>
            <Pressable
              onPress={() => router.push('/(tabs)/log/run')}
              accessibilityRole="button"
              accessibilityLabel="Log Run"
              style={styles.ghostButton}>
              <Text style={styles.ghostButtonLabel}>Log Run</Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.sessionsBlock}>
            <Text style={styles.sessionsHeader}>
              {`TODAY · ${state.todaySessions.length} SESSION${state.todaySessions.length === 1 ? '' : 'S'}`}
            </Text>
            {state.todaySessions.map((session) => (
              <Pressable
                key={session.id}
                // 04-08 builds the session-detail screen; the navigation target is wired now
                // per this plan's Task 3 -- typecheck will not recognize the route until then.
                onPress={() => router.push({ pathname: '/session/detail', params: { workoutId: session.id } })}
                accessibilityRole="button"
                accessibilityLabel={`${session.title}, ${Math.round(session.hss)} HSS`}
                style={styles.sessionRow}>
                <View style={styles.sessionRowText}>
                  <Text style={styles.sessionTitle}>{session.title}</Text>
                  <Text style={styles.sessionMeta}>{session.metaLine}</Text>
                </View>
                <Text style={[styles.sessionHss, tabularNums]}>{Math.round(session.hss)}</Text>
              </Pressable>
            ))}
          </View>
        )}
      </ScrollView>

      <TodayBreakdownSheet
        open={breakdownOpen}
        onClose={() => setBreakdownOpen(false)}
        sessions={state.todaySessions}
        dayTotal={state.dayHss}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.dark.background,
  },
  scrollContent: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.xxxxl,
    paddingBottom: Spacing.xxxl,
  },
  timestamp: {
    ...Mono,
    color: Colors.dark.mutedText,
    textAlign: 'center',
  },
  greeting: {
    ...Typography.heading,
    color: Colors.dark.text,
    textAlign: 'center',
    marginTop: Spacing.sm,
    marginBottom: Spacing.xxl,
  },
  importNotice: {
    ...Mono,
    color: Colors.dark.mutedText,
    textAlign: 'center',
    marginTop: Spacing.sm,
  },
  ringBlock: {
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  tilesBlock: {
    marginTop: Spacing.xxl,
    marginBottom: Spacing.xl,
  },
  chartBlock: {
    marginBottom: Spacing.xl,
  },
  emptyState: {
    alignItems: 'center',
    gap: Spacing.sm,
    marginTop: Spacing.xl,
  },
  ghostButton: {
    minHeight: 48,
    minWidth: 200,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.xl,
  },
  ghostButtonLabel: {
    ...Typography.body,
    color: Colors.dark.text,
  },
  sessionsBlock: {
    marginTop: Spacing.xl,
  },
  sessionsHeader: {
    ...Mono,
    color: Colors.dark.mutedText,
    marginBottom: Spacing.sm,
  },
  sessionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    minHeight: 56,
    paddingVertical: Spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.dark.border,
  },
  sessionRowText: {
    flexShrink: 1,
    paddingRight: Spacing.sm,
    gap: 2,
  },
  sessionTitle: {
    fontFamily: 'Archivo_500Medium',
    fontSize: 16,
    color: Colors.dark.text,
  },
  sessionMeta: {
    ...Mono,
    color: Colors.dark.mutedText,
  },
  sessionHss: {
    ...Typography.heading,
    color: Colors.dark.text,
  },
});
