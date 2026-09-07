/**
 * apps/mobile/components/home/ReadinessLight.tsx
 *
 * The readiness status light (D-02/D-08): an 8px pulsing dot + mono label directly beneath
 * the home ring, semantic-colored per band. Renders nothing while calibrating — that space
 * is owned by the ring's internal plate-orbit + "BUILDING TREND · DAY N/14" caption
 * (04-UI-SPEC.md §3). The dot pulses at the SAME calm ~1.2s rate for every band, including
 * red — "calm but honest," never alarmist, per brand voice.
 */

import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import type { ReadinessBand } from '@apsis/shared';

import { BAND_COLOR } from '../../constants/readinessBand';
import { Mono, Spacing } from '../../constants/theme';

const PULSE_DURATION_MS = 1200;
const PULSE_MIN_OPACITY = 0.5;
const PULSE_MAX_OPACITY = 1.0;

const BAND_COPY: Record<'green' | 'amber' | 'red', string> = {
  green: 'PRIMED · GREEN LIGHT',
  amber: 'CAUTION · HOLD STEADY',
  red: 'OVERREACHING · RED ZONE',
};

export interface ReadinessLightProps {
  band: ReadinessBand;
}

export default function ReadinessLight({ band }: ReadinessLightProps): React.JSX.Element | null {
  const opacity = useSharedValue(PULSE_MAX_OPACITY);

  useEffect(() => {
    if (band === 'calibrating') return;
    opacity.value = withRepeat(
      withTiming(PULSE_MIN_OPACITY, { duration: PULSE_DURATION_MS, easing: Easing.inOut(Easing.ease) }),
      -1,
      true
    );
  }, [band, opacity]);

  const animatedDotStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  if (band === 'calibrating') return null;

  const color = BAND_COLOR[band];
  const copy = BAND_COPY[band];

  return (
    <View style={styles.row} accessibilityLabel={copy}>
      <Animated.View style={[styles.dot, { backgroundColor: color }, animatedDotStyle]} />
      <Text style={[styles.label, { color }]}>{copy}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 24,
    gap: Spacing.xs,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  label: {
    ...Mono,
  },
});
