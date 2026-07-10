/**
 * apps/mobile/components/home/TrendChart.tsx
 *
 * The 28-day ATL/CTL trend chart with a D-19/D-20 scrub tooltip (04-UI-SPEC.md section 5):
 * `victory-native`'s `CartesianChart` + `useChartPressState` render two lines -- ATL (bone)
 * and CTL (ash) -- over already-persisted `load_daily` points passed in via `data`. This
 * component NEVER re-derives EWMA math (Don't Hand-Roll, 04-RESEARCH.md) -- every point's
 * atl/ctl/tsb/hss is exactly what `computeLoadTrendSeries`/`dailyHSS` already computed.
 *
 * TSB is not drawn as a line (D-18) -- it only appears inside the scrub tooltip and the
 * TSB stat tile. Calibrating (D-22): `calibratingDayN` renders whatever real days of data
 * exist (never a fake line) plus a "BUILDING TREND · DAY N/14" caption -- the exact same
 * string HssRing's calibrating variant uses, via the shared `calibratingCaption` helper so
 * the two copies can never drift apart.
 */

import { useMemo } from 'react';
import type { ComponentProps } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import Animated, {
  useAnimatedProps,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
} from 'react-native-reanimated';
import { CartesianChart, Line, useChartPressState } from 'victory-native';
import type { ChartBounds } from 'victory-native';
import { Line as SkiaLine, matchFont, vec } from '@shopify/react-native-skia';

import Colors from '../../constants/Colors';
import { Mono, Radius, Spacing } from '../../constants/theme';

Animated.addWhitelistedNativeProps({ text: true });
const AnimatedTextInput = Animated.createAnimatedComponent(TextInput);

const CHART_HEIGHT = 190;
const AXIS_FONT_SIZE = 9;
const TOOLTIP_TOP_OFFSET = 8;

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
}

function formatSignedTsb(tsb: number): string {
  'worklet';
  const rounded = Math.round(tsb);
  return rounded > 0 ? `+${rounded}` : rounded < 0 ? `−${Math.abs(rounded)}` : '+0';
}

export default function TrendChart({ data, calibratingDayN }: TrendChartProps): React.JSX.Element {
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

  const tooltipStyle = useAnimatedStyle(() => ({
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
            {({ points }) => (
              <>
                {/* Horizontal steel gridlines only -- no vertical gridlines (D-18). */}
                <Line points={points.atl} color={Colors.dark.text} strokeWidth={2} curveType="linear" />
                <Line points={points.ctl} color={Colors.dark.mutedText} strokeWidth={2} curveType="linear" />
                {isActive ? (
                  <SkiaLine p1={cursorP1} p2={cursorP2} color={Colors.dark.mutedText} strokeWidth={1} />
                ) : null}
              </>
            )}
          </CartesianChart>
        )}

        {isActive ? (
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
        ) : null}
      </View>
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
});
