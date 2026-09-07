/**
 * apps/mobile/app/trends.tsx — full trends detail screen (D-01/D-04)
 *
 * A pushed route (sibling of `modal.tsx`, outside `(tabs)/`) reached ONLY from the home
 * chart's "VIEW FULL TREND" tap affordance (app/(tabs)/index.tsx) -- this file never appears
 * as a tab (D-04, 04-UI-SPEC.md section 5's unbuilt 5-tab layout is deliberately not
 * resurrected). Native header re-enabled via the same nested `<Stack.Screen options={…}>`
 * override `session/detail.tsx` uses, since the root layout defaults `headerShown` to false.
 *
 * Reads `recentTrend(db, 365)` exactly once per focus (`useFocusEffect`, never a bare
 * `useEffect` -- Pitfall 5) and reverses to chronological order, coalescing nulls the same
 * way `app/(tabs)/index.tsx` already does. This screen never re-derives EWMA/HSS math --
 * every value is exactly what `load_daily` already persisted (Don't Hand-Roll).
 *
 * D-18 is deliberately overridden HERE ONLY: TSB is drawn as a real line (volt), because this
 * screen has no HssRing and TSB is the readiness quantity the screen exists to show. The home
 * chart (TrendChart.tsx) keeps TSB out of its lines per D-18's original rule -- that contract
 * is untouched by this file.
 *
 * This is Task 1's tracer slice: a fixed last-90-rows chart only. Task 2 adds the stats block
 * and readiness-band strip; Task 3 adds the 28D/90D/1Y range switcher and honest sparse-history
 * captioning. Every guard below already follows the same "never pad, never fabricate" rule
 * (D-22) those later tasks generalize.
 */

import { useCallback, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ScrollView } from 'react-native';
import { Stack, useFocusEffect } from 'expo-router';
import { CartesianChart, Line } from 'victory-native';
import { DashPathEffect, Line as SkiaLine, matchFont, vec } from '@shopify/react-native-skia';
import { db, recentTrend } from '@apsis/db';

import { bandColor } from '../constants/readinessBand';
import Colors from '../constants/Colors';
import { Kicker, Mono, Radius, Spacing, Typography, tabularNums } from '../constants/theme';
import { computeTrendStats, formatSignedDelta, formatTrendDateLabel, type TrendStatRow } from '../lib/trendStats';

const CHART_HEIGHT = 260;
const AXIS_FONT_SIZE = 9;
const TRACER_WINDOW_DAYS = 90;
const CURVE_TYPE = 'monotoneX' as const;

const BAND_LEGEND: ReadonlyArray<{ band: 'green' | 'amber' | 'red' | 'calibrating'; label: string }> = [
  { band: 'green', label: 'READY' },
  { band: 'amber', label: 'CAUTION' },
  { band: 'red', label: 'OVERREACHING' },
  { band: 'calibrating', label: 'CALIBRATING' },
];

type TrendRow = TrendStatRow;

interface TrendChartDatum {
  day: number;
  atl: number;
  ctl: number;
  tsb: number;
  // Index signature so this satisfies victory-native's CartesianChart RawData generic
  // constraint -- same reason TrendChart.tsx's TrendChartPoint carries one.
  [key: string]: number;
}

export default function TrendsScreen(): React.JSX.Element {
  const [loading, setLoading] = useState(true);
  const [allRows, setAllRows] = useState<TrendRow[]>([]);

  const loadTrend = useCallback(async () => {
    try {
      const rowsDesc = await recentTrend(db, 365);
      const rows: TrendRow[] = [...rowsDesc].reverse().map((row) => ({
        localDate: row.localDate,
        dayHss: row.dayHss ?? 0,
        atl: row.atl ?? 0,
        ctl: row.ctl ?? 0,
        tsb: row.tsb ?? 0,
        readinessBand: row.readinessBand ?? 'calibrating',
      }));
      setAllRows(rows);
    } catch (err: unknown) {
      // T-qe6-02: fixed prefix + the caught error only -- never row payloads or health values.
      console.error('[Apsis] TRENDS load failed:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadTrend();
    }, [loadTrend])
  );

  // Task 1 tracer: a fixed last-90-rows slice. Task 3 replaces this with a range switcher
  // driven by TREND_RANGES + sliceRange, sourced from this same single 365-row read.
  const windowRows = useMemo(() => allRows.slice(-TRACER_WINDOW_DAYS), [allRows]);

  const chartData: TrendChartDatum[] = useMemo(
    () =>
      windowRows.map((row, index) => ({
        day: index,
        atl: row.atl,
        ctl: row.ctl,
        tsb: row.tsb,
      })),
    [windowRows]
  );

  const axisFont = useMemo(() => {
    try {
      return matchFont({ fontFamily: 'JetBrainsMono_500Medium', fontSize: AXIS_FONT_SIZE });
    } catch {
      return undefined;
    }
  }, []);

  // Stats block + readiness strip are both derived from the same windowRows the chart above
  // draws -- one derived value feeds all three, never independent slices that could disagree.
  const stats = useMemo(() => computeTrendStats(windowRows), [windowRows]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <Stack.Screen
        options={{
          headerShown: true,
          title: '',
          headerBackTitle: '',
          headerStyle: { backgroundColor: Colors.dark.background },
          headerShadowVisible: false,
          headerTintColor: Colors.dark.text,
        }}
      />

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={styles.title}>TRENDS</Text>

        {loading ? null : allRows.length === 0 ? (
          <Text style={styles.emptyCaption}>NO TREND DATA YET</Text>
        ) : windowRows.length < 2 ? (
          <Text style={styles.emptyCaption}>NOT ENOUGH HISTORY TO CHART YET</Text>
        ) : (
          <>
            <View style={styles.card}>
              <CartesianChart
                data={chartData}
                xKey="day"
                yKeys={['atl', 'ctl', 'tsb']}
                xAxis={{
                  lineColor: Colors.dark.steel,
                  lineWidth: 1,
                  font: axisFont,
                  labelColor: Colors.dark.mutedText,
                }}
                yAxis={[{ lineColor: Colors.dark.steel, lineWidth: 1, font: axisFont, labelColor: Colors.dark.mutedText }]}>
                {({ points, chartBounds, yScale }) => (
                  <>
                    <SkiaLine
                      p1={vec(chartBounds.left, yScale(0))}
                      p2={vec(chartBounds.right, yScale(0))}
                      color={Colors.dark.steel}
                      strokeWidth={1}>
                      <DashPathEffect intervals={[4, 4]} />
                    </SkiaLine>
                    <Line points={points.atl} color={Colors.dark.text} strokeWidth={2} curveType={CURVE_TYPE} />
                    <Line points={points.ctl} color={Colors.dark.mutedText} strokeWidth={2} curveType={CURVE_TYPE} />
                    <Line points={points.tsb} color={Colors.dark.accent} strokeWidth={2} curveType={CURVE_TYPE} />
                  </>
                )}
              </CartesianChart>
            </View>

            <View style={styles.legendRow}>
              <LegendSwatch color={Colors.dark.text} label="ATL" />
              <LegendSwatch color={Colors.dark.mutedText} label="CTL" />
              <LegendSwatch color={Colors.dark.accent} label="TSB" />
            </View>

            {/* Readiness-band history strip (D-01): one segment per row, left-to-right
                oldest-to-newest -- reads in the same direction as the chart above it. Volt
                appears here only for green segments, the same semantic exception
                04-UI-SPEC.md's One-Volt Discipline already grants ReadinessLight. */}
            <Text style={styles.sectionLabel}>READINESS HISTORY</Text>
            <View style={styles.bandStrip}>
              {windowRows.map((row) => (
                <View key={row.localDate} style={[styles.bandSegment, { backgroundColor: bandColor(row.readinessBand) }]} />
              ))}
            </View>
            <View style={styles.bandLegendRow}>
              {BAND_LEGEND.map((entry) => (
                <LegendSwatch key={entry.band} color={bandColor(entry.band)} label={entry.label} />
              ))}
            </View>

            {/* Stats block (D-01): six cells, bone numbers -- the screen's accent budget is
                already spent on the TSB line and the band strip above. */}
            {stats == null ? (
              <Text style={styles.emptyCaption}>NO TREND DATA YET</Text>
            ) : (
              <View style={styles.statsGrid}>
                <StatCell label="ATL" value={Math.round(stats.atl).toString()} delta={formatSignedDelta(stats.atlDelta7)} />
                <StatCell label="CTL" value={Math.round(stats.ctl).toString()} delta={formatSignedDelta(stats.ctlDelta7)} />
                <StatCell label="TSB" value={formatSignedDelta(stats.tsb)} delta={formatSignedDelta(stats.tsbDelta7)} />
                <StatCell
                  label="PEAK LOAD"
                  value={Math.round(stats.peakHss).toString()}
                  sub={formatTrendDateLabel(stats.peakDate, { withDay: true })}
                />
                <StatCell label="REST DAYS" value={`${stats.restDays} / ${stats.days}`} />
                <StatCell label="AVG HSS" value={Math.round(stats.avgHss).toString()} />
              </View>
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function StatCell({
  label,
  value,
  delta,
  sub,
}: {
  label: string;
  value: string;
  delta?: string;
  sub?: string;
}): React.JSX.Element {
  return (
    <View style={styles.statCell}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={[styles.statValue, tabularNums]}>{value}</Text>
      {delta != null ? <Text style={styles.statDelta}>{delta}</Text> : null}
      {sub != null ? <Text style={styles.statSub}>{sub}</Text> : null}
    </View>
  );
}

function LegendSwatch({ color, label }: { color: string; label: string }): React.JSX.Element {
  return (
    <View style={styles.legendItem}>
      <View style={[styles.legendDot, { backgroundColor: color }]} />
      <Text style={styles.legendLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.dark.background,
  },
  scrollContent: {
    paddingHorizontal: Spacing.xl,
    paddingBottom: Spacing.xxxl,
  },
  title: {
    fontFamily: 'Archivo_900Black',
    fontSize: 30,
    lineHeight: 28,
    textTransform: 'uppercase',
    letterSpacing: -0.45,
    color: Colors.dark.text,
    marginTop: Spacing.lg,
    marginBottom: Spacing.xl,
  },
  emptyCaption: {
    ...Mono,
    color: Colors.dark.mutedText,
    textAlign: 'center',
    marginTop: Spacing.xxl,
  },
  card: {
    height: CHART_HEIGHT,
    backgroundColor: Colors.dark.surface,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    borderRadius: Radius.md,
    padding: Spacing.sm,
    overflow: 'hidden',
  },
  legendRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: Spacing.lg,
    marginTop: Spacing.md,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendLabel: {
    ...Mono,
    color: Colors.dark.mutedText,
  },
  sectionLabel: {
    ...Kicker,
    color: Colors.dark.mutedText,
    marginTop: Spacing.xxl,
    marginBottom: Spacing.sm,
  },
  bandStrip: {
    flexDirection: 'row',
    gap: 2,
  },
  bandSegment: {
    flex: 1,
    height: 6,
    borderRadius: Radius.pill,
  },
  bandLegendRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: Spacing.md,
    marginTop: Spacing.sm,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: Spacing.md,
    gap: Spacing.sm,
  },
  statCell: {
    flexBasis: '48%',
    flexGrow: 1,
    backgroundColor: Colors.dark.surface,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    borderRadius: Radius.md,
    padding: Spacing.md,
    gap: 2,
  },
  statLabel: {
    ...Kicker,
    color: Colors.dark.mutedText,
  },
  statValue: {
    ...Typography.heading,
    color: Colors.dark.text,
  },
  statDelta: {
    ...Mono,
    color: Colors.dark.mutedText,
  },
  statSub: {
    ...Mono,
    color: Colors.dark.mutedText,
  },
});
