/**
 * apps/mobile/components/home/TrendChart.tsx
 *
 * The 28-day ATL/CTL trend chart with a D-19/D-20 scrub tooltip (04-UI-SPEC.md section 5,
 * as amended 2026-09-07 by quick task 260907-la6 -- that revision is the governing contract
 * for this file): `victory-native`'s `CartesianChart` + `useChartPressState` render two
 * softened-curve lines -- ATL (bone) and CTL (ash) -- over already-persisted `load_daily`
 * points passed in via `data`. This component NEVER re-derives EWMA math (Don't Hand-Roll,
 * 04-RESEARCH.md) -- every point's atl/ctl/tsb/hss is exactly what
 * `computeLoadTrendSeries`/`dailyHSS` already computed.
 *
 * D-18 amendment: a vertical bone gradient area fill sits under the ATL series only (CTL
 * stays a bare line), and both series draw on once per mount. No volt anywhere on the chart
 * -- the fill is achromatic and the Today screen's one volt element remains HssRing.
 *
 * TSB is not drawn as a line (D-18) -- it only appears inside the scrub tooltip and the
 * TSB stat tile. Calibrating (D-22): `calibratingDayN` renders whatever real days of data
 * exist (never a fake line) plus a "BUILDING TREND · DAY N/14" caption -- the exact same
 * string HssRing's calibrating variant uses, via the shared `calibratingCaption` helper so
 * the two copies can never drift apart.
 */

import { useEffect, useMemo, useRef } from 'react';
import type { ComponentProps } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import Animated, {
  useAnimatedProps,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { Area, CartesianChart, Line, useChartPressState } from 'victory-native';
import type { ChartBounds, CurveType } from 'victory-native';
import { Group, Line as SkiaLine, LinearGradient, matchFont, vec } from '@shopify/react-native-skia';

import Colors from '../../constants/Colors';
import { HIT_TARGET_MIN, Mono, Radius, Spacing } from '../../constants/theme';

Animated.addWhitelistedNativeProps({ text: true });
const AnimatedTextInput = Animated.createAnimatedComponent(TextInput);

const CHART_HEIGHT = 190;
const AXIS_FONT_SIZE = 9;
const TOOLTIP_TOP_OFFSET = 8;

// Softened, non-overshooting curve (04-UI-SPEC.md section 5 amendment) -- monotoneX cannot
// dip a near-zero ATL below the axis during the calibrating window. Same value for both
// series so ATL/CTL never use different interpolations.
const CURVE_TYPE: CurveType = 'monotoneX';

// Single tuning knob (per 04-UI-SPEC.md section 5 amendment) -- lower this if the bone
// gradient wash under ATL competes with the HssRing for attention on-device.
const AREA_FILL_TOP_ALPHA = 0.18;

// Mount draw-on duration -- under DESIGN-SYSTEM.md line 103's ~800ms animation ceiling.
const DRAW_ON_DURATION_MS = 600;

// Scrub hairline/tooltip opacity fade -- under the D-19 amendment's 150ms ceiling. Only
// opacity eases; x-position always tracks the finger directly with zero lag.
const CURSOR_FADE_MS = 150;

/** Bone at a given alpha, expressed as an rgba() string Skia's Color type accepts --
 * avoids hand-rolling a second color constant next to Colors.dark.text. */
function hexToRgba(hex: string, alpha: number): string {
  const clean = hex.replace('#', '');
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/** Shared "BUILDING TREND · DAY N/14" caption -- the exact same string HssRing's calibrating
 * variant renders (D-22: one shared constant, not two copies that could drift). */
export function calibratingCaption(dayN: number): string {
  return `BUILDING TREND · DAY ${dayN}/14`;
}

export interface TrendChartPoint {
  /** Sequential 0-indexed day number matching this point's chronological array index --
   * the chart's numeric x-axis key. Never a raw Date/timestamp (avoids d3-scale continuous
   * time-axis complexity for a fixed 28-slot window). */
  day: number;
  hss: number;
  atl: number;
  ctl: number;
  tsb: number;
  /** Pre-formatted "MON DD" label (e.g. "JUL 8") -- never re-derived from a Date in here. */
  dateLabel: string;
  // Index signature so this satisfies victory-native's `CartesianChart`'s
  // `RawData extends Record<string, unknown>` generic constraint -- without it, TS can't
  // infer the xKey/yKeys generics and every derived prop (chartPressState, points.atl/ctl)
  // silently collapses to `never`/`{}`.
  [key: string]: number | string;
}

export interface TrendChartProps {
  /** Chronological (oldest-first) points -- up to the last 28 `load_daily` rows. */
  data: TrendChartPoint[];
  /** Day N of the 14-day calibration window; set only when fewer than 14 real days exist. */
  calibratingDayN?: number;
  /**
   * D-02/D-04: when supplied, renders a "VIEW FULL TREND" affordance row beneath the chart
   * card and calls this on tap. This component never navigates itself -- it imports nothing
   * from expo-router and stays purely presentational; the caller (app/(tabs)/index.tsx) owns
   * the actual `router.push('/trends')` call, the ONLY entry point to that route.
   */
  onPressDetail?: () => void;
}

function formatSignedTsb(tsb: number): string {
  'worklet';
  const rounded = Math.round(tsb);
  return rounded > 0 ? `+${rounded}` : rounded < 0 ? `−${Math.abs(rounded)}` : '+0';
}

export default function TrendChart({ data, calibratingDayN, onPressDetail }: TrendChartProps): React.JSX.Element {
  const { state, isActive } = useChartPressState({ x: 0, y: { atl: 0, ctl: 0 } });

  const chartBoundsSV = useSharedValue<ChartBounds>({ left: 0, right: 0, top: 0, bottom: 0 });

  // matchFont resolves the already-loaded expo-google-fonts JetBrains Mono family through
  // Skia's system font manager -- same family name RN <Text> already uses everywhere else.
  // Guarded: if the family can't be resolved, axis labels simply don't render (gridlines and
  // the two lines still do) rather than throwing.
  const axisFont = useMemo(() => {
    try {
      return matchFont({ fontFamily: 'JetBrainsMono_500Medium', fontSize: AXIS_FONT_SIZE });
    } catch {
      return undefined;
    }
  }, []);

  const dayToLabel = useMemo(() => new Map(data.map((p) => [p.day, p.dateLabel])), [data]);
  // Sparse x-axis labels: every ~7th day (executor discretion per 04-UI-SPEC.md section 5).
  const xTickValues = useMemo(() => data.filter((p) => p.day % 7 === 0).map((p) => p.day), [data]);

  const cursorP1 = useDerivedValue(() => vec(state.x.position.value, chartBoundsSV.value.top));
  const cursorP2 = useDerivedValue(() => vec(state.x.position.value, chartBoundsSV.value.bottom));

  const tooltipText = useDerivedValue(() => {
    'worklet';
    const point = data[state.matchedIndex.value];
    if (!point) return '';
    const atl = Math.round(state.y.atl.value.value);
    const ctl = Math.round(state.y.ctl.value.value);
    return `${point.dateLabel} · HSS ${Math.round(point.hss)} · ATL ${atl} · CTL ${ctl} · TSB ${formatSignedTsb(point.tsb)}`;
  }, [data]);

  const tooltipAnimatedProps = useAnimatedProps(() => ({ text: tooltipText.value }));

  // Mount draw-on (D-18 amendment): fires once, the first time real data appears, and never
  // replays while this component stays mounted -- matching HssRing's animate-once discipline
  // on the same screen. Drives a Skia stroke trim (`end`) on both lines and, via the wrapping
  // Group below, an opacity ramp on the ATL area fill.
  const drawProgress = useSharedValue(0);
  const hasDrawnOnceRef = useRef(false);
  useEffect(() => {
    if (data.length > 0 && !hasDrawnOnceRef.current) {
      hasDrawnOnceRef.current = true;
      drawProgress.value = withTiming(1, { duration: DRAW_ON_DURATION_MS });
    }
  }, [data.length, drawProgress]);

  // Eased scrub hairline/tooltip (D-19 amendment): opacity fades in/out over CURSOR_FADE_MS;
  // x-position is read directly from state.x.position.value every frame with no timing/spring,
  // so the cursor tracks the finger with zero lag.
  const cursorOpacity = useSharedValue(0);
  useEffect(() => {
    cursorOpacity.value = withTiming(isActive ? 1 : 0, { duration: CURSOR_FADE_MS });
  }, [isActive, cursorOpacity]);

  const tooltipStyle = useAnimatedStyle(() => ({
    opacity: cursorOpacity.value,
    transform: [{ translateX: state.x.position.value }],
  }));

  return (
    <View style={styles.wrapper}>
      {calibratingDayN != null ? (
        <Text style={styles.calibratingCaption}>{calibratingCaption(calibratingDayN)}</Text>
      ) : null}

      <View style={styles.card}>
        {data.length === 0 ? null : (
          <CartesianChart
            data={data}
            xKey="day"
            yKeys={['atl', 'ctl']}
            chartPressState={state}
            onChartBoundsChange={(bounds) => {
              chartBoundsSV.value = bounds;
            }}
            xAxis={{
              lineWidth: 0,
              font: axisFont,
              labelColor: Colors.dark.mutedText,
              tickValues: xTickValues,
              tickCount: Math.max(xTickValues.length, 1),
              formatXLabel: (day: number) => dayToLabel.get(day) ?? '',
            }}
            yAxis={[{ lineColor: Colors.dark.steel, lineWidth: 1 }]}>
            {({ points, chartBounds }) => (
              <>
                {/* Horizontal steel gridlines only -- no vertical gridlines (D-18). Area
                    fill sits under both stroked lines in paint order (D-18 amendment). */}
                <Group opacity={drawProgress}>
                  <Area points={points.atl} y0={chartBounds.bottom} curveType={CURVE_TYPE}>
                    <LinearGradient
                      start={vec(0, chartBounds.top)}
                      end={vec(0, chartBounds.bottom)}
                      colors={[hexToRgba(Colors.dark.text, AREA_FILL_TOP_ALPHA), hexToRgba(Colors.dark.text, 0)]}
                    />
                  </Area>
                </Group>
                <Line
                  points={points.atl}
                  color={Colors.dark.text}
                  strokeWidth={2}
                  curveType={CURVE_TYPE}
                  end={drawProgress}
                />
                <Line
                  points={points.ctl}
                  color={Colors.dark.mutedText}
                  strokeWidth={2}
                  curveType={CURVE_TYPE}
                  end={drawProgress}
                />
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
        )}

        <Animated.View style={[styles.tooltip, tooltipStyle]} pointerEvents="none">
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

      {onPressDetail ? (
        // D-02: a separate sibling row, deliberately NOT a wrapper around the card above --
        // the card already owns a pan gesture via useChartPressState (the D-19 scrub), and
        // wrapping it in a Pressable would put a tap recognizer in contention with that
        // gesture. This row is a ghost control with no fill, just a hairline + label.
        <Pressable
          onPress={onPressDetail}
          accessibilityRole="button"
          accessibilityLabel="View full trend"
          style={({ pressed }) => [styles.detailRow, pressed && styles.detailRowPressed]}>
          <Text style={styles.detailRowLabel}>VIEW FULL TREND ▸</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    gap: Spacing.sm,
  },
  calibratingCaption: {
    ...Mono,
    color: Colors.dark.mutedText,
    textAlign: 'center',
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
  detailRow: {
    minHeight: HIT_TARGET_MIN,
    borderTopWidth: 1,
    borderTopColor: Colors.dark.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  detailRowPressed: {
    opacity: 0.7,
  },
  detailRowLabel: {
    ...Mono,
    color: Colors.dark.mutedText,
  },
});
