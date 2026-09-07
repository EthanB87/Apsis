/**
 * apps/mobile/components/session/LiveHssHeader.tsx
 *
 * Pinned sticky header (D-22/D-23): elapsed session time (Body, tabular-nums, left) and the
 * live session HSS (Display size, Accent, right) with a Reanimated `withTiming` count-up
 * (~400-600ms ease-out) whenever `sessionStore.liveHss` changes — the differentiator moment
 * (LIFT-08): the athlete watches training load accumulate as they log. Tapping the HSS
 * number opens the breakdown sheet (D-24). The "Finish" button (UI-SPEC Copywriting
 * Contract) is presentational only — `onFinish` owns marking the workout finished and
 * navigating, so this component stays a pure display of session store state.
 */

import { useEffect, useState } from 'react';
import type { ComponentProps } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import Animated, { Easing, useAnimatedProps, useSharedValue, withTiming } from 'react-native-reanimated';

import Colors from '../../constants/Colors';
import { HIT_TARGET_MIN, Radius, Spacing, tabularNums } from '../../constants/theme';
import { useSessionStore } from '../../stores/sessionStore';

Animated.addWhitelistedNativeProps({ text: true });
const AnimatedTextInput = Animated.createAnimatedComponent(TextInput);

const COUNT_UP_DURATION_MS = 500;

function formatElapsed(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

export interface LiveHssHeaderProps {
  startedAt: Date;
  onFinish: () => void;
}

export function LiveHssHeader({ startedAt, onFinish }: LiveHssHeaderProps): React.JSX.Element {
  const liveHss = useSessionStore((s) => s.liveHss);
  const setBreakdownOpen = useSessionStore((s) => s.setBreakdownOpen);

  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  useEffect(() => {
    const startedAtMs = startedAt.getTime();
    const tick = () => setElapsedSeconds(Math.max(0, Math.floor((Date.now() - startedAtMs) / 1000)));
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [startedAt]);

  const hssValue = useSharedValue(liveHss);
  useEffect(() => {
    hssValue.value = withTiming(liveHss, {
      duration: COUNT_UP_DURATION_MS,
      easing: Easing.out(Easing.cubic),
    });
  }, [liveHss, hssValue]);

  const animatedProps = useAnimatedProps(() => ({
    text: `${Math.round(hssValue.value)}`,
  }));

  return (
    <View style={styles.header}>
      {/* Instrument HUD: every readout is a value with its mono label beneath it. */}
      <View style={styles.readout}>
        <Text style={[styles.elapsed, tabularNums]}>{formatElapsed(elapsedSeconds)}</Text>
        <Text style={styles.readoutLabel}>ELAPSED</Text>
      </View>

      <Pressable
        onPress={() => setBreakdownOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={`Session HSS ${Math.round(liveHss)}, view breakdown`}
        style={styles.hssTapArea}>
        <AnimatedTextInput
          editable={false}
          pointerEvents="none"
          caretHidden
          underlineColorAndroid="transparent"
          defaultValue={`${Math.round(liveHss)}`}
          // `text` is a native-only TextInput prop used by reanimated's documented
          // "animated counter" pattern (RN's official TS types don't model it) — the
          // AnimatedTextInput cast below is that pattern's standard escape hatch, scoped to
          // this one prop only.
          animatedProps={animatedProps as Partial<ComponentProps<typeof TextInput>>}
          style={[styles.hssValue, tabularNums]}
        />
        <Text style={styles.readoutLabel}>SESSION HSS</Text>
      </Pressable>

      <Pressable
        onPress={onFinish}
        accessibilityRole="button"
        accessibilityLabel="Finish"
        style={({ pressed }) => [styles.finishButton, pressed && { backgroundColor: Colors.dark.accentPressed }]}>
        <Text style={styles.finishLabel}>Finish</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.dark.surface,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.dark.border,
  },
  readout: {
    minWidth: 64,
    alignItems: 'flex-start',
    gap: 2,
  },
  readoutLabel: {
    fontFamily: 'JetBrainsMono_500Medium',
    fontSize: 9,
    letterSpacing: 1.4,
    color: Colors.dark.mutedText,
  },
  elapsed: {
    fontFamily: 'JetBrainsMono_500Medium',
    fontSize: 16,
    color: Colors.dark.text,
  },
  hssTapArea: {
    flex: 1,
    alignItems: 'center',
    minHeight: HIT_TARGET_MIN,
    justifyContent: 'center',
    gap: 2,
  },
  hssValue: {
    fontFamily: 'Archivo_900Black',
    fontSize: 34,
    lineHeight: 38,
    color: Colors.dark.accent,
    textAlign: 'center',
    padding: 0,
  },
  finishButton: {
    minHeight: 44,
    minWidth: 76,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radius.md,
    backgroundColor: Colors.dark.accent,
    paddingHorizontal: Spacing.lg,
  },
  finishLabel: {
    fontFamily: 'Archivo_500Medium',
    fontSize: 14,
    color: Colors.dark.onAccent,
  },
});
