/**
 * apps/mobile/components/home/PlateOrbit.tsx
 *
 * The calibrating-state mark (D-08): nested bone ellipses, tilted -30deg, in continuous
 * slow rotation. User-directed deviation from DESIGN-SYSTEM.md §4's plate+runner pair —
 * only the plate exists here, no runner glyph. Lives centered inside HssRing.tsx while
 * `readinessBand === 'calibrating'` (04-UI-SPEC.md §2).
 */

import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import Svg, { Ellipse } from 'react-native-svg';

import Colors from '../../constants/Colors';

const ROTATION_DURATION_MS = 6000;
const TILT_DEG = -30;

export interface PlateOrbitProps {
  /** Diameter of the plate-orbit mark's bounding box. */
  size: number;
}

export default function PlateOrbit({ size }: PlateOrbitProps): React.JSX.Element {
  const rotation = useSharedValue(0);

  useEffect(() => {
    rotation.value = withRepeat(
      withTiming(360, { duration: ROTATION_DURATION_MS, easing: Easing.linear }),
      -1,
      false
    );
  }, [rotation]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }));

  const center = size / 2;
  // Two nested bone ellipses, tilted -30deg via the outer wrapper's rotation, sized
  // proportionally to the passed diameter (no fixed pixel values, so the same component
  // works at any inner-ring diameter).
  const outerRx = size * 0.46;
  const outerRy = size * 0.28;
  const innerRx = size * 0.3;
  const innerRy = size * 0.18;

  return (
    <View style={[styles.container, { width: size, height: size }]}>
      {/* Static -30deg tilt lives on this outer wrapper; the inner Animated.View owns the
          continuous rotation — two nested transforms, since RN style arrays don't merge a
          `transform` key across objects (the last one wins). */}
      <View style={[styles.rotator, { width: size, height: size, transform: [{ rotate: `${TILT_DEG}deg` }] }]}>
        <Animated.View style={[styles.rotator, { width: size, height: size }, animatedStyle]}>
          <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
            <Ellipse
              cx={center}
              cy={center}
              rx={outerRx}
              ry={outerRy}
              stroke={Colors.dark.text}
              strokeWidth={2}
              fill="none"
            />
            <Ellipse
              cx={center}
              cy={center}
              rx={innerRx}
              ry={innerRy}
              stroke={Colors.dark.text}
              strokeWidth={2}
              fill="none"
            />
          </Svg>
        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  rotator: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
