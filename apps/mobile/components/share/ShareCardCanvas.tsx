/**
 * apps/mobile/components/share/ShareCardCanvas.tsx
 *
 * The share-edition render tree (D-01/D-02/D-05/D-09): a 1080x1080 Skia `<Canvas>` -- the
 * SAME component is used both for the live compose-screen preview AND the export snapshot
 * (one render tree, no preview/export drift, per 08-RESEARCH.md's recommended project
 * structure).
 *
 * This tracer plan (08-02) renders ONLY the D-07 no-photo void-black card: a solid void
 * background, the share-edition HSS ring, the big session number, and the mono
 * session-type + date caption. The D-03 stat trio and D-04 footer wordmark/plate-mark are
 * deliberately NOT rendered here -- reserved visual space below the ring is left for 08-03
 * to fill in (a functionality gap, not an architectural one; see 08-02-PLAN.md Task 1).
 *
 * Ring: a NEW, separately-sized Skia element recomposed at 1080px scale (D-09) -- NOT a
 * re-mount of the react-native-svg-based `HssRing.tsx` component, since Skia `<Canvas>`
 * trees cannot embed react-native-svg elements. `RING_FILL_REFERENCE_HSS` and the capped
 * `fillFraction = min(hss/200, 1)` formula are imported (not redefined) from `HssRing.tsx`
 * so ring fill semantics never drift between the in-app rings and this share edition
 * (08-PATTERNS.md "Capped-ring-fill formula"). Per D-05, this ring is ALWAYS a volt arc --
 * there is no `band` prop and no steel-only calibrating variant, since a single-session ring
 * never carries readiness-band semantics.
 */

import { useMemo } from 'react';
import type { RefObject } from 'react';
import { Canvas, Circle, Fill, Path, Text, matchFont, type CanvasRef } from '@shopify/react-native-skia';

import Colors from '../../constants/Colors';
import { RING_FILL_REFERENCE_HSS } from '../home/HssRing';

/** D-01: single output format, square 1080x1080. */
export const SHARE_CARD_SIZE = 1080;

const RING_RADIUS = 320;
const RING_STROKE_WIDTH = 32;
const RING_CENTER_X = SHARE_CARD_SIZE / 2;
const RING_CENTER_Y = 460;

// D-09: bigger, more dramatic type than the in-app 200px/84px rings -- tuned for 1080px social.
const NUMBER_FONT_SIZE = 260;
const CAPTION_FONT_SIZE = 44;
const CAPTION_Y = 940;

export interface ShareCardCanvasProps {
  hss: number;
  caption: string;
  /** From `useCanvasRef()`, passed by the compose screen so it can call `makeImageSnapshot()`. */
  canvasRef?: RefObject<CanvasRef | null>;
}

/**
 * A full-circle SVG path starting at 12 o'clock and sweeping clockwise. Combined with the
 * `Path` component's `start`/`end` (0..1, fraction of path length) props, this reproduces the
 * same "capped arc fill" visual as `HssRing.tsx`'s react-native-svg
 * strokeDasharray/strokeDashoffset + `rotation={-90}` technique -- without embedding
 * react-native-svg inside a Skia canvas tree.
 */
function fullCirclePath(cx: number, cy: number, r: number): string {
  return `M ${cx} ${cy - r} A ${r} ${r} 0 1 1 ${cx} ${cy + r} A ${r} ${r} 0 1 1 ${cx} ${cy - r}`;
}

export default function ShareCardCanvas({
  hss,
  caption,
  canvasRef,
}: ShareCardCanvasProps): React.JSX.Element {
  // D-02: same capped-arc formula as the in-app ring, imported (not redefined).
  const fillFraction = Math.min(hss / RING_FILL_REFERENCE_HSS, 1);

  const ringPath = useMemo(() => fullCirclePath(RING_CENTER_X, RING_CENTER_Y, RING_RADIUS), []);

  // Guarded matchFont (TrendChart.tsx pattern, 08-PATTERNS.md) -- a font-resolution failure
  // must never crash card render/export; the text simply doesn't draw.
  const numberFont = useMemo(() => {
    try {
      return matchFont({ fontFamily: 'Archivo_900Black', fontSize: NUMBER_FONT_SIZE });
    } catch {
      return undefined;
    }
  }, []);
  const captionFont = useMemo(() => {
    try {
      return matchFont({ fontFamily: 'JetBrainsMono_500Medium', fontSize: CAPTION_FONT_SIZE });
    } catch {
      return undefined;
    }
  }, []);

  const numberText = `${Math.round(hss)}`;
  const numberWidth = numberFont ? numberFont.measureText(numberText).width : 0;
  const captionWidth = captionFont ? captionFont.measureText(caption).width : 0;

  return (
    <Canvas ref={canvasRef} style={{ width: SHARE_CARD_SIZE, height: SHARE_CARD_SIZE }}>
      {/* D-07: void-black background -- the only background this tracer renders; 08-03/08-04
          add the photo-background + void->transparent scrim variant (D-10). */}
      <Fill color={Colors.dark.background} />

      {/* Track: full steel circle, drawn first -- always visible (mirrors HssRing.tsx). */}
      <Circle
        cx={RING_CENTER_X}
        cy={RING_CENTER_Y}
        r={RING_RADIUS}
        style="stroke"
        strokeWidth={RING_STROKE_WIDTH}
        color={Colors.dark.steel}
      />
      {/* Volt fill arc -- always drawn (no calibrating/steel-only variant, D-05). */}
      <Path
        path={ringPath}
        style="stroke"
        strokeWidth={RING_STROKE_WIDTH}
        strokeCap="round"
        color={Colors.dark.accent}
        start={0}
        end={fillFraction}
      />

      {numberFont ? (
        <Text
          x={RING_CENTER_X - numberWidth / 2}
          y={RING_CENTER_Y + NUMBER_FONT_SIZE * 0.32}
          text={numberText}
          font={numberFont}
          color={Colors.dark.accent}
        />
      ) : null}

      {captionFont ? (
        <Text
          x={RING_CENTER_X - captionWidth / 2}
          y={CAPTION_Y}
          text={caption}
          font={captionFont}
          color={Colors.dark.text}
        />
      ) : null}
    </Canvas>
  );
}
