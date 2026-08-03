/**
 * apps/mobile/components/share/ShareCardCanvas.tsx
 *
 * The share-edition render tree (D-01/D-02/D-05/D-09): a 1080x1080 Skia `<Canvas>` -- the
 * SAME component is used both for the live compose-screen preview AND the export snapshot
 * (one render tree, no preview/export drift, per 08-RESEARCH.md's recommended project
 * structure).
 *
 * 08-03 expands the 08-02 tracer's void-black-only card (ring + number + caption) with the
 * full fixed composition: the D-03 stat trio (bottom-anchored, 3 columns) and the D-04
 * subtle footer (plate-mark + APSIS wordmark + mono session-type/date caption).
 *
 * 08-04 adds the photo-first background layer (D-06/D-10): an optional `backgroundPhotoUri`
 * prop. When present, a full-bleed 1080x1080 Skia `<Image>` (cover fit) replaces the void
 * `<Fill>`, and a void->transparent `<LinearGradient>` scrim is drawn on top (bottom-anchored,
 * near-opaque by the card's bottom edge) so the SAME ring/trio/footer composition stays
 * legible over a bright/busy photo -- the overlay layout itself never changes between the
 * void and photo variants (D-07: identical composition either way). `useImage` never throws
 * (resolves `null` on a failed load), so a bad photo URI simply falls back to the void
 * `<Fill>` rather than crashing the export.
 *
 * Ring: a NEW, separately-sized Skia element recomposed at 1080px scale (D-09) -- NOT a
 * re-mount of the react-native-svg-based `HssRing.tsx` component, since Skia `<Canvas>`
 * trees cannot embed react-native-svg elements. `RING_FILL_REFERENCE_HSS` and the capped
 * `fillFraction = min(hss/200, 1)` formula are imported (not redefined) from `HssRing.tsx`
 * so ring fill semantics never drift between the in-app rings and this share edition
 * (08-PATTERNS.md "Capped-ring-fill formula"). Per D-05, this ring is ALWAYS a volt arc --
 * there is no `band` prop and no steel-only calibrating variant, since a single-session ring
 * never carries readiness-band semantics.
 *
 * All Skia font resolution is guarded try/catch (TrendChart.tsx pattern) -- a font-resolution
 * miss must never crash card render/export; the affected text element simply doesn't draw.
 * `useImage` (the plate-mark asset) never throws -- it resolves to `null` on failure, which
 * this component treats the same way (skip drawing the icon, everything else still renders).
 */

import { useMemo } from 'react';
import type { RefObject } from 'react';
import {
  Canvas,
  Circle,
  Fill,
  Group,
  Image,
  LinearGradient,
  Path,
  Rect,
  Text,
  matchFont,
  useImage,
  vec,
  type CanvasRef,
} from '@shopify/react-native-skia';

import Colors from '../../constants/Colors';
import { RING_FILL_REFERENCE_HSS } from '../home/HssRing';
import type { ShareStatPair } from '../../lib/shareCard';

/** D-01: single output format, square 1080x1080. */
export const SHARE_CARD_SIZE = 1080;

const RING_RADIUS = 280;
const RING_STROKE_WIDTH = 28;
const RING_CENTER_X = SHARE_CARD_SIZE / 2;
const RING_CENTER_Y = 420;

// D-09: bigger, more dramatic type than the in-app 200px/84px rings -- tuned for 1080px social.
const NUMBER_FONT_SIZE = 220;
const CAPTION_FONT_SIZE = 34;

// D-03 stat trio row -- three equal columns spanning the full card width, value on top of
// label, both centered within their column.
const STAT_COL_CENTERS = [SHARE_CARD_SIZE / 6, SHARE_CARD_SIZE / 2, (SHARE_CARD_SIZE * 5) / 6];
const STAT_VALUE_FONT_SIZE = 52;
const STAT_LABEL_FONT_SIZE = 24;
const STAT_VALUE_Y = 800;
const STAT_LABEL_Y = 844;

// D-04 subtle footer -- plate-mark + APSIS wordmark bottom-left, mono caption bottom-right.
// Kept visually quiet: small icon/wordmark, caption size well below the ring number.
const FOOTER_Y = 970;
const FOOTER_MARGIN = 90;
const FOOTER_ICON_SIZE = 44;
const FOOTER_WORDMARK_FONT_SIZE = 32;
const FOOTER_WORDMARK_GAP = 16;

// D-10: void->transparent bottom-anchored scrim, drawn only over a photo background so the
// ring/trio/footer stay legible without changing their layout. Starts just above the ring's
// steel track (RING_CENTER_Y - RING_RADIUS - RING_STROKE_WIDTH ~= 112) so the ring number has
// some scrim behind it, ramping to near-opaque void by the card's bottom edge. Stops/opacity
// are Claude's Discretion (08-CONTEXT.md) -- tuned for volt/bone legibility at feed size.
const SCRIM_TOP_Y = 60;
const SCRIM_COLORS = ['rgba(11,12,14,0)', 'rgba(11,12,14,0.55)', 'rgba(11,12,14,0.92)'];
const SCRIM_POSITIONS = [0, 0.45, 1];

export interface ShareCardCanvasProps {
  hss: number;
  caption: string;
  /** D-03: exactly 3 { label, value } pairs from buildStrengthStatTrio/buildEnduranceStatTrio. */
  statTrio: ShareStatPair[];
  /**
   * D-06/D-10: optional picked-photo URI for the full-bleed background. `null`/`undefined`
   * renders the existing D-07 void-black fallback -- same overlay composition either way.
   */
  backgroundPhotoUri?: string | null;
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
  statTrio,
  backgroundPhotoUri,
  canvasRef,
}: ShareCardCanvasProps): React.JSX.Element {
  // D-02: same capped-arc formula as the in-app ring, imported (not redefined).
  const fillFraction = Math.min(hss / RING_FILL_REFERENCE_HSS, 1);

  const ringPath = useMemo(() => fullCirclePath(RING_CENTER_X, RING_CENTER_Y, RING_RADIUS), []);

  // D-06/D-10: the picked background photo -- useImage never throws, `null` (missing prop or a
  // failed load) falls back to the void `<Fill>` below rather than crashing the export.
  const photoImage = useImage(backgroundPhotoUri ?? undefined);

  // D-04: plate-mark asset -- already bone/ash/volt colored (same asset as the tab bar icon),
  // so it needs no tint to match the palette. useImage never throws; null just skips the icon.
  const plateMarkImage = useImage(require('../../assets/images/apsis-plate-mark.png'));

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
  const statValueFont = useMemo(() => {
    try {
      return matchFont({ fontFamily: 'Archivo_900Black', fontSize: STAT_VALUE_FONT_SIZE });
    } catch {
      return undefined;
    }
  }, []);
  const statLabelFont = useMemo(() => {
    try {
      return matchFont({ fontFamily: 'JetBrainsMono_500Medium', fontSize: STAT_LABEL_FONT_SIZE });
    } catch {
      return undefined;
    }
  }, []);
  const wordmarkFont = useMemo(() => {
    try {
      return matchFont({ fontFamily: 'JetBrainsMono_500Medium', fontSize: FOOTER_WORDMARK_FONT_SIZE });
    } catch {
      return undefined;
    }
  }, []);

  const numberText = `${Math.round(hss)}`;
  const numberWidth = numberFont ? numberFont.measureText(numberText).width : 0;
  const captionWidth = captionFont ? captionFont.measureText(caption).width : 0;
  const wordmarkWidth = wordmarkFont ? wordmarkFont.measureText('APSIS').width : 0;

  return (
    <Canvas ref={canvasRef} style={{ width: SHARE_CARD_SIZE, height: SHARE_CARD_SIZE }}>
      {photoImage ? (
        <>
          {/* D-06: full-bleed cover-fit photo background. */}
          <Image image={photoImage} x={0} y={0} width={SHARE_CARD_SIZE} height={SHARE_CARD_SIZE} fit="cover" />
          {/* D-10: void->transparent bottom-anchored scrim so the overlay stays legible. */}
          <Rect x={0} y={SCRIM_TOP_Y} width={SHARE_CARD_SIZE} height={SHARE_CARD_SIZE - SCRIM_TOP_Y}>
            <LinearGradient
              start={vec(0, SCRIM_TOP_Y)}
              end={vec(0, SHARE_CARD_SIZE)}
              colors={SCRIM_COLORS}
              positions={SCRIM_POSITIONS}
            />
          </Rect>
        </>
      ) : (
        /* D-07: void-black fallback -- no photo prop, or a failed photo load. */
        <Fill color={Colors.dark.background} />
      )}

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

      {/* D-03: fixed core stat trio, 3 equal columns, value over label. */}
      {statTrio.slice(0, 3).map((pair, index) => {
        const colCenterX = STAT_COL_CENTERS[index] ?? SHARE_CARD_SIZE / 2;
        const valueWidth = statValueFont ? statValueFont.measureText(pair.value).width : 0;
        const labelWidth = statLabelFont ? statLabelFont.measureText(pair.label).width : 0;
        return (
          <Group key={pair.label}>
            {statValueFont ? (
              <Text
                x={colCenterX - valueWidth / 2}
                y={STAT_VALUE_Y}
                text={pair.value}
                font={statValueFont}
                color={Colors.dark.text}
              />
            ) : null}
            {statLabelFont ? (
              <Text
                x={colCenterX - labelWidth / 2}
                y={STAT_LABEL_Y}
                text={pair.label}
                font={statLabelFont}
                color={Colors.dark.mutedText}
              />
            ) : null}
          </Group>
        );
      })}

      {/* D-04: subtle footer -- plate-mark + APSIS wordmark (bottom-left), mono session-type/
          date caption (bottom-right). Kept quiet: the athlete's stats stay the visual star. */}
      {plateMarkImage ? (
        <Image
          image={plateMarkImage}
          x={FOOTER_MARGIN}
          y={FOOTER_Y - FOOTER_ICON_SIZE / 2}
          width={FOOTER_ICON_SIZE}
          height={FOOTER_ICON_SIZE}
          fit="contain"
        />
      ) : null}
      {wordmarkFont ? (
        <Text
          x={FOOTER_MARGIN + FOOTER_ICON_SIZE + FOOTER_WORDMARK_GAP}
          y={FOOTER_Y + FOOTER_WORDMARK_FONT_SIZE * 0.32}
          text="APSIS"
          font={wordmarkFont}
          color={Colors.dark.mutedText}
        />
      ) : null}
      {captionFont ? (
        <Text
          x={SHARE_CARD_SIZE - FOOTER_MARGIN - captionWidth}
          y={FOOTER_Y + CAPTION_FONT_SIZE * 0.32}
          text={caption}
          font={captionFont}
          color={Colors.dark.mutedText}
        />
      ) : null}
    </Canvas>
  );
}
