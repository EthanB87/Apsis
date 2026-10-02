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
 * Task 2 adds the stats block and readiness-band strip. Task 3 (quick task 260907-qe6) adds
 * the 28D/90D/1Y range switcher -- a single `recentTrend(db, 365)` read stays the one source of
 * truth, and every range is served by slicing that already-loaded array client-side via
 * `sliceRange` (History's read-everything-fold-in-memory precedent) -- switching ranges never
 * refetches. Every guard below follows the same "never pad, never fabricate" rule (D-22): a
 * shorter-than-requested window renders only the days that exist and says so honestly via the
 * "SHOWING N OF REQUESTED DAYS" caption, never a padded/extended domain.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ComponentProps } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ScrollView } from 'react-native';
import { Stack, useFocusEffect } from 'expo-router';
import Animated, {
  clamp,
  useAnimatedProps,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { CartesianChart, Line, Scatter, useChartPressState } from 'victory-native';
import type { ChartBounds } from 'victory-native';
import { DashPathEffect, Line as SkiaLine, matchFont, vec } from '@shopify/react-native-skia';
import { db, recentTrend } from '@apsis/db';

import { bandColor } from '../constants/readinessBand';
import Colors from '../constants/Colors';
import { HIT_TARGET_MIN, Kicker, Mono, Radius, Spacing, Typography, tabularNums } from '../constants/theme';
import {
  computeTrendStats,
  formatScrubTooltip,
  formatSignedDelta,
  formatTrendDateLabel,
  sliceRange,
  TREND_RANGES,
  type TrendStatRow,
} from '../lib/trendStats';

// D-19/D-20 scrub tooltip: an AnimatedTextInput whose `text` prop is driven imperatively off
// the UI thread, exactly like TrendChart.tsx's home-chart tooltip -- the native `text` prop
// must be whitelisted once at module scope for Reanimated to write to it directly.
Animated.addWhitelistedNativeProps({ text: true });
const AnimatedTextInput = Animated.createAnimatedComponent(TextInput);

const CHART_HEIGHT = 260;
const AXIS_FONT_SIZE = 9;
const CURVE_TYPE = 'monotoneX' as const;
const SCATTER_DOT_RADIUS = 3;

// D-19 scrub hairline/tooltip constants. CURSOR_FADE_MS matches TrendChart.tsx's own constant
// value exactly so the two screens' fade timing can never drift apart.
const CURSOR_FADE_MS = 150;
const TOOLTIP_TOP_OFFSET = 8;
const TOOLTIP_EDGE_INSET = 4;

type TrendRangeKey = (typeof TREND_RANGES)[number]['key'];

// One named x-axis tick-thinning constant per range (D-01: "one named constant per range, not
// a magic number inline") so labels never overlap as the window widens from 28 to 365 points.
const TICK_INTERVAL_DAYS_28D = 7;
const TICK_INTERVAL_DAYS_90D = 14;
const TICK_INTERVAL_DAYS_1Y = 60;
const TICK_INTERVAL_BY_RANGE: Record<TrendRangeKey, number> = {
  '28D': TICK_INTERVAL_DAYS_28D,
  '90D': TICK_INTERVAL_DAYS_90D,
  '1Y': TICK_INTERVAL_DAYS_1Y,
};

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
  const [rangeKey, setRangeKey] = useState<TrendRangeKey>('28D');
  const selectedRange = TREND_RANGES.find((r) => r.key === rangeKey)!;

  // D-19/D-20 scrub hairline + tooltip -- ported from TrendChart.tsx's proven mechanism (read-
  // only reference, not edited). All three y keys are mandatory: chartPressState is typed
  // Record<YK, number> over this chart's yKeys union (atl/ctl/tsb), so a two-key init is a
  // compile error.
  const { state, isActive } = useChartPressState({ x: 0, y: { atl: 0, ctl: 0, tsb: 0 } });
  const chartBoundsSV = useSharedValue<ChartBounds>({ left: 0, right: 0, top: 0, bottom: 0 });
  const cursorOpacity = useSharedValue(0);
  const tooltipWidthSV = useSharedValue(0);
  const cardWidthSV = useSharedValue(0);

  const cursorP1 = useDerivedValue(() => vec(state.x.position.value, chartBoundsSV.value.top));
  const cursorP2 = useDerivedValue(() => vec(state.x.position.value, chartBoundsSV.value.bottom));

  // Only opacity eases (D-19's 150ms ceiling); the hairline/tooltip x-position is read straight
  // from state.x.position.value every frame with no timing or spring, so the cursor tracks the
  // finger with zero lag.
  useEffect(() => {
    cursorOpacity.value = withTiming(isActive ? 1 : 0, { duration: CURSOR_FADE_MS });
  }, [isActive, cursorOpacity]);

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

  // Range switcher (D-01/Task 3): one 365-row read, sliced client-side per range -- switching
  // never refetches. Chart, readiness strip and stats block all derive from this SAME sliced
  // array (never three independent slices that could disagree).
  const windowRows = useMemo(() => sliceRange(allRows, selectedRange.days), [allRows, selectedRange]);

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

  // Axis label density scales with range: MON D for 28D/90D, MON-only for 1Y (D-01) -- thinned
  // by TICK_INTERVAL_BY_RANGE so labels never overlap as the window widens.
  const withDayLabels = rangeKey !== '1Y';
  const dayToLabel = useMemo(
    () => new Map(windowRows.map((row, index) => [index, formatTrendDateLabel(row.localDate, { withDay: withDayLabels })])),
    [windowRows, withDayLabels]
  );
  const tickInterval = TICK_INTERVAL_BY_RANGE[rangeKey];
  const xTickValues = useMemo(
    () => chartData.filter((p) => p.day % tickInterval === 0).map((p) => p.day),
    [chartData, tickInterval]
  );

  // Point dots only at 28D -- at 90/365 points they become noise, so wider ranges let the
  // lines carry alone (D-01).
  const showDots = rangeKey === '28D';

  // Honest sparse history (D-01/D-22): never pad/extend the domain -- when fewer rows exist
  // than requested, caption exactly how many real days are shown and since when.
  const isSparse = !loading && windowRows.length > 0 && windowRows.length < selectedRange.days;

  // Stats block + readiness strip are both derived from the same windowRows the chart above
  // draws -- one derived value feeds all three, never independent slices that could disagree.
  const stats = useMemo(() => computeTrendStats(windowRows), [windowRows]);

  // D-20 tooltip copy: precomputed per day on the JS thread via the single tested
  // formatScrubTooltip (never re-implemented here), then read into a derived value by
  // matchedIndex so the worklet never calls a plain JS formatter itself. windowRows (not
  // chartData) is the source because it carries dayHss/localDate, and its indices are 1:1 with
  // chartData's `day` values by construction. The `?? ''` is load-bearing -- matchedIndex is -1
  // before the first press and can point past the end for one frame after a range switch
  // shortens windowRows.
  const tooltipLines = useMemo(() => windowRows.map((row) => formatScrubTooltip(row)), [windowRows]);
  const tooltipText = useDerivedValue(() => tooltipLines[state.matchedIndex.value] ?? '', [tooltipLines]);
  const tooltipAnimatedProps = useAnimatedProps(() => ({ text: tooltipText.value }));

  // Clamped placement -- the one intentional divergence from the home chart. The card sets
  // overflow:'hidden' and this tooltip line is wide, so centring on the finger then clamping
  // inside the card's measured width keeps it fully visible at both edges. The Math.max guard
  // is required: before first layout both widths are 0 and an inverted min/max would make
  // clamp meaningless. Still untweened -- only opacity eases, so D-19's zero-lag rule holds.
  const tooltipAnimatedStyle = useAnimatedStyle(() => ({
    opacity: cursorOpacity.value,
    transform: [
      {
        translateX: clamp(
          state.x.position.value - tooltipWidthSV.value / 2,
          TOOLTIP_EDGE_INSET,
          Math.max(cardWidthSV.value - tooltipWidthSV.value - TOOLTIP_EDGE_INSET, TOOLTIP_EDGE_INSET)
        ),
      },
    ],
  }));

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

        <View style={styles.rangeSwitcher}>
          {TREND_RANGES.map((range) => {
            const selected = range.key === rangeKey;
            return (
              <Pressable
                key={range.key}
                onPress={() => setRangeKey(range.key)}
                accessibilityRole="button"
                accessibilityLabel={`Show ${range.key} range`}
                accessibilityState={{ selected }}
                style={[styles.rangeSegment, selected && styles.rangeSegmentSelected]}>
                <Text style={[styles.rangeSegmentLabel, selected && styles.rangeSegmentLabelSelected]}>
                  {range.key}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {loading ? null : allRows.length === 0 ? (
          <Text style={styles.emptyCaption}>NO TREND DATA YET</Text>
        ) : windowRows.length < 2 ? (
          <Text style={styles.emptyCaption}>NOT ENOUGH HISTORY TO CHART YET</Text>
        ) : (
          <>
            {isSparse ? (
              <Text style={styles.sparseCaption}>
                {`SHOWING ${windowRows.length} OF ${selectedRange.days} DAYS · SINCE ${formatTrendDateLabel(
                  windowRows[0]!.localDate,
                  { withDay: true }
                )}`}
              </Text>
            ) : null}

            {/* No chartPressConfig here -- matches app/(tabs)/index.tsx's home chart exactly,
                which already runs this identical default press-pan inside a ScrollView and the
                user has confirmed on device that it feels right. chartPressConfig.pan
                .activeOffsetX / failOffsetY (ChartPressPanConfig, victory-native 41.26.0) is
                the documented escape hatch if on-device testing ever shows the page's vertical
                scroll fighting this horizontal scrub -- so the next person doesn't have to
                rediscover it. The card is never wrapped in a touchable: that would contend with
                this scrub pan gesture. */}
            <View
              style={styles.card}
              onLayout={(e) => {
                cardWidthSV.value = e.nativeEvent.layout.width;
              }}>
              <CartesianChart
                data={chartData}
                xKey="day"
                yKeys={['atl', 'ctl', 'tsb']}
                chartPressState={state}
                onChartBoundsChange={(bounds) => {
                  chartBoundsSV.value = bounds;
                }}
                xAxis={{
                  lineColor: Colors.dark.steel,
                  lineWidth: 1,
                  font: axisFont,
                  labelColor: Colors.dark.mutedText,
                  tickValues: xTickValues,
                  tickCount: Math.max(xTickValues.length, 1),
                  formatXLabel: (day: number) => dayToLabel.get(day) ?? '',
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
                    {showDots ? (
                      <>
                        <Scatter points={points.atl} color={Colors.dark.text} radius={SCATTER_DOT_RADIUS} />
                        <Scatter points={points.ctl} color={Colors.dark.mutedText} radius={SCATTER_DOT_RADIUS} />
                        <Scatter points={points.tsb} color={Colors.dark.accent} radius={SCATTER_DOT_RADIUS} />
                      </>
                    ) : null}
                    <SkiaLine
                      p1={cursorP1}
                      p2={cursorP2}
                      color={Colors.dark.mutedText}
                      strokeWidth={1}
                      opacity={cursorOpacity}
                    />
                  </>
                )}
              </CartesianChart>

              <Animated.View
                style={[styles.tooltip, tooltipAnimatedStyle]}
                pointerEvents="none"
                onLayout={(e) => {
                  tooltipWidthSV.value = e.nativeEvent.layout.width;
                }}>
                <AnimatedTextInput
                  editable={false}
                  pointerEvents="none"
                  caretHidden
                  underlineColorAndroid="transparent"
                  defaultValue=""
                  multiline={false}
                  animatedProps={tooltipAnimatedProps as Partial<ComponentProps<typeof TextInput>>}
                  style={styles.tooltipText}
                />
              </Animated.View>
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
  // Segmented range control (28D/90D/1Y): bone active fill, matching the run form's segmented-
  // control convention -- this screen's accent budget is already spent on the TSB line and the
  // readiness-band strip, so the switcher itself stays bone, not volt.
  rangeSwitcher: {
    flexDirection: 'row',
    backgroundColor: Colors.dark.steel,
    borderRadius: Radius.sm,
    padding: 2,
    marginBottom: Spacing.lg,
  },
  rangeSegment: {
    flex: 1,
    minHeight: HIT_TARGET_MIN,
    borderRadius: Radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  rangeSegmentSelected: {
    backgroundColor: Colors.dark.text,
  },
  rangeSegmentLabel: {
    ...Mono,
    color: Colors.dark.mutedText,
  },
  rangeSegmentLabelSelected: {
    color: Colors.dark.onAccent,
  },
  sparseCaption: {
    ...Mono,
    color: Colors.dark.mutedText,
    textAlign: 'center',
    marginBottom: Spacing.sm,
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
  tooltip: {
    position: 'absolute',
    top: TOOLTIP_TOP_OFFSET,
    left: 0,
    backgroundColor: Colors.dark.surface,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
  },
  tooltipText: {
    ...Mono,
    fontSize: 11,
    color: Colors.dark.text,
    padding: 0,
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
