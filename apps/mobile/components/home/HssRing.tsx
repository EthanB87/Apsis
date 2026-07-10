/**
 * apps/mobile/components/home/HssRing.tsx
 *
 * The signature hero (04-UI-SPEC.md §1): a react-native-svg stroke ring shared by the home
 * 200px hero and the 84px finish mini-ring (D-04). Ring fill is capped at
 * RING_FILL_REFERENCE_HSS=200 (`fillFraction = min(hss/200, 1)`) so a double-session day
 * never over-wraps the circle, but the displayed number is always the exact rounded HSS —
 * the ring never lies about the number, only about how "full" a circle can look.
 *
 * Calibrating variant (D-02/D-08): the entire ring renders steel (no volt arc at all),
 * PlateOrbit's animated mark sits centered inside, and a "BUILDING TREND · DAY N/14" caption
 * replaces "HYBRID STRESS" — there's no meaningful readiness number to show yet.
 *
 * Count-up mechanism (D-05) reuses LiveHssHeader.tsx's exact Reanimated withTiming +
 * AnimatedTextInput pattern. The `animate` prop (default true) lets the parent gate the
 * "once per day" policy — pass `animate={false}` to render the final value instantly on
 * repeat same-day visits.
 */

import { useEffect } from 'react';
import type { ComponentProps } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedProps,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';
import type { ReadinessBand } from '@apsis/shared';

import Colors from '../../constants/Colors';
import { Mono, Typography, tabularNums } from '../../constants/theme';
import PlateOrbit from './PlateOrbit';

Animated.addWhitelistedNativeProps({ text: true });
const AnimatedTextInput = Animated.createAnimatedComponent(TextInput);
const AnimatedCircle = Animated.createAnimatedComponent(Circle);

/**
 * Single reference constant both the home ring (today's day HSS) and the finish mini-ring
 * (single session HSS) use to compute the capped visual fill fraction. Do not duplicate this
 * value elsewhere — 04-UI-SPEC.md §1 is explicit that there must be exactly one to reason
 * about.
 */
export const RING_FILL_REFERENCE_HSS = 200;

const COUNT_UP_DURATION_MS = 500;
const ARC_ANIMATION_DELAY_MS = 200;
const ARC_ANIMATION_DURATION_MS = 700;

const HOME_SIZE = 200;
const STROKE_WIDTH_HOME = 14;
const STROKE_WIDTH_MINI = 8;

export interface HssRingProps {
  /** Ring diameter — 200px (home) or 84px (finish mini, D-04). */
  size: number;
  hss: number;
  band: ReadinessBand;
  /** Day N of the 14-day calibration window; only meaningful when band === 'calibrating'. */
  calibratingDayN?: number;
  /** D-05: once-per-day count-up gate — false renders the final value instantly, no animation. */
  animate?: boolean;
  onPress?: () => void;
}

export default function HssRing({
  size,
  hss,
  band,
  calibratingDayN,
  animate = true,
  onPress,
}: HssRingProps): React.JSX.Element {
  const isCalibrating = band === 'calibrating';
  const isHome = size >= HOME_SIZE;
  const strokeWidth = isHome ? STROKE_WIDTH_HOME : STROKE_WIDTH_MINI;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const center = size / 2;

  // The DISPLAYED number is always the exact, uncapped rounded HSS (04-UI-SPEC.md §1) —
  // only the arc's fill fraction is capped at the 200-HSS reference.
  const fillFraction = isCalibrating ? 0 : Math.min(hss / RING_FILL_REFERENCE_HSS, 1);

  const fillProgress = useSharedValue(animate ? 0 : fillFraction);
  useEffect(() => {
    if (isCalibrating) return;
    fillProgress.value = animate
      ? withDelay(
          ARC_ANIMATION_DELAY_MS,
          withTiming(fillFraction, { duration: ARC_ANIMATION_DURATION_MS, easing: Easing.out(Easing.cubic) })
        )
      : fillFraction;
  }, [fillFraction, animate, isCalibrating, fillProgress]);

  const animatedCircleProps = useAnimatedProps(() => ({
    strokeDashoffset: circumference * (1 - fillProgress.value),
  }));

  const hssValue = useSharedValue(animate ? 0 : hss);
  useEffect(() => {
    if (isCalibrating) return;
    hssValue.value = animate
      ? withTiming(hss, { duration: COUNT_UP_DURATION_MS, easing: Easing.out(Easing.cubic) })
      : hss;
  }, [hss, animate, isCalibrating, hssValue]);

  const animatedTextProps = useAnimatedProps(() => ({
    text: `${Math.round(hssValue.value)}`,
  }));

  const numberStyle = isHome ? Typography.displayXl : Typography.heading;

  return (
    <View style={styles.wrapper}>
      <Pressable
        onPress={onPress}
        disabled={!onPress}
        accessibilityRole={onPress ? 'button' : undefined}
        accessibilityLabel={
          isCalibrating ? 'Calibrating readiness' : `Hybrid stress score ${Math.round(hss)}`
        }
        style={{ width: size, height: size }}>
        <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          {/* Track: full steel circle, drawn first — always visible, including calibrating. */}
          <Circle cx={center} cy={center} r={radius} stroke={Colors.dark.steel} strokeWidth={strokeWidth} fill="none" />
          {!isCalibrating ? (
            <AnimatedCircle
              cx={center}
              cy={center}
              r={radius}
              stroke={Colors.dark.accent}
              strokeWidth={strokeWidth}
              strokeLinecap="round"
              strokeDasharray={`${circumference} ${circumference}`}
              animatedProps={animatedCircleProps}
              fill="none"
              rotation={-90}
              origin={`${center}, ${center}`}
            />
          ) : null}
        </Svg>

        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          <View style={styles.centerContent}>
            {isCalibrating ? (
              <>
                <PlateOrbit size={isHome ? size * 0.42 : size * 0.5} />
                {isHome ? (
                  <View style={styles.captionBlock}>
                    <Text style={styles.caption}>BUILDING TREND</Text>
                    <Text style={styles.caption}>{`DAY ${calibratingDayN ?? 1}/14`}</Text>
                  </View>
                ) : null}
              </>
            ) : (
              <>
                <AnimatedTextInput
                  editable={false}
                  pointerEvents="none"
                  caretHidden
                  underlineColorAndroid="transparent"
                  defaultValue={`${Math.round(hss)}`}
                  // `text` is a native-only TextInput prop used by reanimated's documented
                  // "animated counter" pattern (RN's official TS types don't model it) — the
                  // AnimatedTextInput cast below is that pattern's standard escape hatch,
                  // scoped to this one prop only (matches LiveHssHeader.tsx's convention).
                  animatedProps={animatedTextProps as Partial<ComponentProps<typeof TextInput>>}
                  style={[numberStyle, tabularNums, styles.number]}
                />
                {isHome ? <Text style={styles.subLabel}>HYBRID STRESS</Text> : null}
              </>
            )}
          </View>
        </View>
      </Pressable>
      {!isHome && !isCalibrating ? <Text style={styles.subLabelBelow}>HYBRID STRESS</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    alignItems: 'center',
  },
  centerContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  number: {
    color: Colors.dark.accent,
    textAlign: 'center',
    padding: 0,
  },
  subLabel: {
    ...Mono,
    color: Colors.dark.mutedText,
    textAlign: 'center',
  },
  subLabelBelow: {
    ...Mono,
    color: Colors.dark.mutedText,
    textAlign: 'center',
    marginTop: 4,
  },
  captionBlock: {
    alignItems: 'center',
    gap: 2,
  },
  caption: {
    ...Mono,
    color: Colors.dark.mutedText,
    textAlign: 'center',
  },
});
