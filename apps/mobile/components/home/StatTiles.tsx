/**
 * apps/mobile/components/home/StatTiles.tsx
 *
 * ATL / CTL / TSB stat tiles (D-21/D-24, 04-UI-SPEC.md §4): three equal-width carbon tiles
 * beneath the home ring. Numbers render BONE (not volt) per the One-Volt Discipline (D-09) --
 * the ring is the only volt-filled hero on Home. TSB always shows an explicit leading sign.
 * Tapping a tile cross-fades to its one-line explainer copy in place of the number+caption;
 * tapping again flips back.
 */

import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import Colors from '../../constants/Colors';
import { HIT_TARGET_MIN, Mono, Radius, Spacing, Typography, tabularNums } from '../../constants/theme';

const FLIP_FADE_DURATION_MS = 200;

const CAPTIONS = {
  atl: 'ATL · ACUTE',
  ctl: 'CTL · CHRONIC',
  tsb: 'TSB · BALANCE',
} as const;

const EXPLAINERS = {
  atl: "ATL — 7-day acute load: what you've done lately",
  ctl: 'CTL — 28-day chronic load: your fitness base.',
  tsb: 'TSB — CTL minus ATL: your training balance right now.',
} as const;

type StatKey = keyof typeof CAPTIONS;

function formatValue(key: StatKey, value: number): string {
  const rounded = Math.round(value);
  if (key === 'tsb') {
    // TSB always carries an explicit sign -- the sign IS the information (fresher vs. more
    // fatigued) — never a bare number, even for zero.
    return rounded > 0 ? `+${rounded}` : rounded < 0 ? `−${Math.abs(rounded)}` : '+0';
  }
  return String(rounded);
}

interface TileProps {
  statKey: StatKey;
  value: number;
}

function Tile({ statKey, value }: TileProps): React.JSX.Element {
  const [flipped, setFlipped] = useState(false);
  // Simple opacity cross-fade (~200ms, D-24) between the number+caption face and the
  // one-line explainer face -- no 3D flip needed per the plan's explicit guidance.
  const fade = useSharedValue(1);

  useEffect(() => {
    fade.value = 0;
    fade.value = withTiming(1, { duration: FLIP_FADE_DURATION_MS });
  }, [flipped, fade]);

  const animatedFadeStyle = useAnimatedStyle(() => ({ opacity: fade.value }));

  return (
    <Pressable
      onPress={() => setFlipped((open) => !open)}
      accessibilityRole="button"
      accessibilityLabel={flipped ? EXPLAINERS[statKey] : `${CAPTIONS[statKey]}, ${formatValue(statKey, value)}`}
      accessibilityState={{ expanded: flipped }}
      style={styles.tile}>
      <Animated.View style={[styles.tileFace, animatedFadeStyle]}>
        {flipped ? (
          <Text style={styles.explainer}>{EXPLAINERS[statKey]}</Text>
        ) : (
          <>
            <Text style={[styles.value, tabularNums]}>{formatValue(statKey, value)}</Text>
            <Text style={styles.caption}>{CAPTIONS[statKey]}</Text>
          </>
        )}
      </Animated.View>
    </Pressable>
  );
}

export interface StatTilesProps {
  atl: number;
  ctl: number;
  tsb: number;
}

export default function StatTiles({ atl, ctl, tsb }: StatTilesProps): React.JSX.Element {
  return (
    <View style={styles.row}>
      <Tile statKey="atl" value={atl} />
      <Tile statKey="ctl" value={ctl} />
      <Tile statKey="tsb" value={tsb} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: Spacing.lg,
  },
  tile: {
    flex: 1,
    minHeight: HIT_TARGET_MIN,
    backgroundColor: Colors.dark.surface,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    borderRadius: Radius.md,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.sm,
  },
  tileFace: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  value: {
    ...Typography.heading,
    color: Colors.dark.text,
  },
  caption: {
    ...Mono,
    color: Colors.dark.mutedText,
  },
  explainer: {
    ...Typography.label,
    color: Colors.dark.text,
    textAlign: 'center',
  },
});
