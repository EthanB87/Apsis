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
 * near-opaque by the card's bottom edge) so the stat trio + footer stay legible over a
 * bright/busy photo. `useImage` never throws (resolves `null` on a failed load), so a bad
 * photo URI simply falls back to the void `<Fill>` rather than crashing the export.
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
 * Ring placement is variant-dependent (user-chosen refinement out of the 08-04 Task 3 UAT):
 * on the VOID card the ring is the hero -- large and centered (the original composition). On
 * a PHOTO card the athlete's photo is the hero, so the ring shrinks to a compact
 * Strava-overlay-style badge anchored FIXED TOP-LEFT (its HSS number scaled down with it),
 * keeping the photo visible; the stat trio + footer stay in the bottom scrim unchanged in
 * both variants. The variant switches on the RESOLVED `photoImage` (not the raw
 * `backgroundPhotoUri` prop), so a failed photo load falls back to the full void
 * composition -- hero ring included -- exactly like an explicit skip, and the live preview
 * and the exported snapshot can never disagree (one render tree, one switch).
 *
 * Font loading: `useFont(require(...).ttf, size)`, NOT `matchFont({ fontFamily, fontSize })`.
 * `matchFont` resolves a family name through Skia's SYSTEM font manager
 * (`Skia.FontMgr.System().matchFamilyStyle`), which only sees fonts registered with the OS's
 * own font database. `app/_layout.tsx`'s `useFonts()` (expo-font) registers
 * `Archivo_900Black`/`JetBrainsMono_500Medium` as RN-bridge-only aliases usable by React
 * Native's own `<Text>` -- that registration is invisible to Skia's system font manager, so
 * `matchFamilyStyle` cannot find them and every `<Text>` in this canvas silently failed to
 * draw (caught by a try/catch around `matchFont`, font stayed `undefined`) while the ring
 * (Path/Circle, no font dependency) and plate-mark (`useImage`, no font dependency) rendered
 * fine -- this was diagnosed from an on-device UAT report where only the ring + plate-mark
 * showed and every stat/caption/wordmark was blank. `useFont` loads the SAME physical TTF
 * files (the exact asset modules `@expo-google-fonts/archivo`/`@expo-google-fonts/jetbrains-mono`
 * export, and that `_layout.tsx` already bundles) directly into Skia's OWN typeface system via
 * `Skia.Data.fromURI` + `MakeFreeTypeFaceFromData`, bypassing OS/system font registration
 * entirely -- Shopify's documented approach for custom fonts in a Skia canvas, and reliable
 * regardless of whether the OS has that family registered. `useFont` never throws: it resolves
 * to `null` while loading or on a genuine load failure, which every `<Text>` below already
 * guards against (skip drawing, don't crash). `useImage` (the plate-mark asset) never throws
 * either -- it resolves to `null` on failure, treated the same way (skip the icon, everything
 * else still renders).
 */

import { useEffect, useMemo, useRef } from 'react';
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
  useFont,
  useImage,
  vec,
  type CanvasRef,
  type SkImage,
} from '@shopify/react-native-skia';
import { Archivo_900Black } from '@expo-google-fonts/archivo';
import { JetBrainsMono_500Medium } from '@expo-google-fonts/jetbrains-mono';

import Colors from '../../constants/Colors';
import { RING_FILL_REFERENCE_HSS } from '../home/HssRing';
import type { ShareStatPair } from '../../lib/shareCard';

/** D-01: single output format, square 1080x1080. */
export const SHARE_CARD_SIZE = 1080;

// VOID-card hero ring -- large and centered (the ring IS the hero on the void card).
const RING_RADIUS = 280;
const RING_STROKE_WIDTH = 28;
const RING_CENTER_X = SHARE_CARD_SIZE / 2;
const RING_CENTER_Y = 420;

// PHOTO-card compact ring -- a Strava-overlay-style badge anchored fixed top-left so the
// athlete's photo stays the hero. Radius/stroke/number scale together (~0.46x of the hero
// ring, same stroke:radius proportion) so the badge reads as the same element, just smaller.
// The top-left padding reuses FOOTER_MARGIN (90) so the badge aligns with the footer's
// left edge -- one consistent margin around the whole composition.
const PHOTO_RING_RADIUS = 130;
const PHOTO_RING_STROKE_WIDTH = 14;
const PHOTO_RING_MARGIN = 90;
const PHOTO_RING_CENTER = PHOTO_RING_MARGIN + PHOTO_RING_STROKE_WIDTH / 2 + PHOTO_RING_RADIUS;

// D-09: bigger, more dramatic type than the in-app 200px/84px rings -- tuned for 1080px social.
const NUMBER_FONT_SIZE = 220;
// Photo-variant HSS number -- scaled with the compact ring (same ~number:radius ratio as the
// hero ring's 220/280) so it stays legible inside the smaller badge without overflowing it.
const PHOTO_NUMBER_FONT_SIZE = 100;
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
// stat trio + footer stay legible without changing their layout -- fully transparent near the
// top (keeping the photo + top-left ring badge clear), ramping to near-opaque void by the
// card's bottom edge. Stops/opacity are Claude's Discretion (08-CONTEXT.md) -- tuned for
// volt/bone legibility at feed size.
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
  /**
   * Fires whenever the all-fonts-loaded state changes. The compose screen gates the Share
   * button on this (in addition to its existing Pitfall-4 settle timer) so an export can never
   * fire while any card text is still fontless -- a blank-text PNG would otherwise be
   * indistinguishable from a successful share.
   */
  onFontsReady?: (ready: boolean) => void;
  /**
   * CR-01 fix: fires `false` the instant `backgroundPhotoUri` changes (a fresh async photo
   * decode has just started) and `true` once that decode has settled for the CURRENT uri --
   * either resolved to an image, or a confirmed failure (which falls back to the void
   * composition, D-07). Also fires `true` immediately when there is no photo to wait on. The
   * compose screen gates the Share button on this (alongside `onFontsReady` and its Pitfall-4
   * settle timer) so a background-photo swap can never be captured mid-decode as a stale or
   * blank frame.
   */
  onBackgroundReady?: (ready: boolean) => void;
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
  onFontsReady,
  onBackgroundReady,
}: ShareCardCanvasProps): React.JSX.Element {
  // D-02: same capped-arc formula as the in-app ring, imported (not redefined).
  const fillFraction = Math.min(hss / RING_FILL_REFERENCE_HSS, 1);

  // D-06/D-10/CR-01: the picked background photo -- useImage never throws, `null` (missing prop
  // or a failed load) falls back to the void `<Fill>` below rather than crashing the export.
  //
  // Readiness tracking: useImage's internal `data` state does NOT reset to null when `source`
  // changes -- it keeps the PREVIOUS resolved value until the new load settles (see
  // @shopify/react-native-skia's `Data.ts` `useLoading`) -- so neither a bare `photoImage != null`
  // check nor a naive reference-equality check can reliably tell "still decoding the new uri"
  // apart from "decode finished." `pendingUriRef` records the uri we're currently waiting on;
  // the effect below flips `onBackgroundReady` to false the instant `backgroundPhotoUri` changes
  // and back to true once `photoImage` resolves to a NEW value for that same uri. A failed
  // decode instead resolves back to the SAME `null` the canvas already held (a reference check
  // alone can't see that), so `useImage`'s own `onError` callback closes that gap -- it is
  // closed over the `backgroundPhotoUri` that was current when THIS decode attempt started, so a
  // stale/superseded swap's late failure can never incorrectly mark a newer pending uri ready.
  const pendingUriRef = useRef<string | null>(null);
  const settledImageRef = useRef<SkImage | null>(null);
  const photoImage = useImage(backgroundPhotoUri ?? undefined, () => {
    if (pendingUriRef.current === (backgroundPhotoUri ?? null)) {
      pendingUriRef.current = null;
      onBackgroundReady?.(true);
    }
  });

  useEffect(() => {
    if (backgroundPhotoUri == null) {
      // D-07: void card has no async background to wait on -- always ready.
      pendingUriRef.current = null;
      settledImageRef.current = photoImage;
      onBackgroundReady?.(true);
      return;
    }
    if (pendingUriRef.current !== backgroundPhotoUri) {
      // A new uri just arrived -- not ready until it settles (below, or via the onError
      // callback above).
      pendingUriRef.current = backgroundPhotoUri;
      onBackgroundReady?.(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [backgroundPhotoUri, onBackgroundReady]);

  useEffect(() => {
    if (
      backgroundPhotoUri != null &&
      photoImage != null &&
      photoImage !== settledImageRef.current &&
      pendingUriRef.current === backgroundPhotoUri
    ) {
      pendingUriRef.current = null;
      settledImageRef.current = photoImage;
      onBackgroundReady?.(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [photoImage, backgroundPhotoUri, onBackgroundReady]);

  // Ring variant (see file-header doc comment): photo card -> compact top-left badge; void
  // card (including a failed photo load) -> large centered hero ring. Keyed off the RESOLVED
  // image so the ring always matches the background actually being drawn.
  const isPhotoCard = photoImage != null;
  const ringRadius = isPhotoCard ? PHOTO_RING_RADIUS : RING_RADIUS;
  const ringStrokeWidth = isPhotoCard ? PHOTO_RING_STROKE_WIDTH : RING_STROKE_WIDTH;
  const ringCenterX = isPhotoCard ? PHOTO_RING_CENTER : RING_CENTER_X;
  const ringCenterY = isPhotoCard ? PHOTO_RING_CENTER : RING_CENTER_Y;
  const numberFontSize = isPhotoCard ? PHOTO_NUMBER_FONT_SIZE : NUMBER_FONT_SIZE;

  const ringPath = useMemo(
    () => fullCirclePath(ringCenterX, ringCenterY, ringRadius),
    [ringCenterX, ringCenterY, ringRadius]
  );

  // D-04: plate-mark asset -- already bone/ash/volt colored (same asset as the tab bar icon),
  // so it needs no tint to match the palette. useImage never throws; null just skips the icon.
  const plateMarkImage = useImage(require('../../assets/images/apsis-plate-mark.png'));

  // useFont loads the raw TTF directly into Skia's own typeface system (see file-header doc
  // comment) -- resolves to `null` while loading or on a genuine load failure, which every
  // `<Text>` below already guards against. The number font's size is variant-dependent
  // (hero vs. compact ring) -- useFont rebuilds the SkFont when `size` changes, reusing the
  // already-loaded typeface, so the void<->photo swap never re-fetches the TTF.
  const numberFont = useFont(Archivo_900Black, numberFontSize);
  const captionFont = useFont(JetBrainsMono_500Medium, CAPTION_FONT_SIZE);
  const statValueFont = useFont(Archivo_900Black, STAT_VALUE_FONT_SIZE);
  const statLabelFont = useFont(JetBrainsMono_500Medium, STAT_LABEL_FONT_SIZE);
  const wordmarkFont = useFont(JetBrainsMono_500Medium, FOOTER_WORDMARK_FONT_SIZE);

  const fontsReady = Boolean(numberFont && captionFont && statValueFont && statLabelFont && wordmarkFont);
  useEffect(() => {
    onFontsReady?.(fontsReady);
  }, [fontsReady, onFontsReady]);

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

      {/* Track: full steel circle, drawn first -- always visible (mirrors HssRing.tsx).
          Geometry is variant-dependent: hero centered on void, compact top-left on photo. */}
      <Circle
        cx={ringCenterX}
        cy={ringCenterY}
        r={ringRadius}
        style="stroke"
        strokeWidth={ringStrokeWidth}
        color={Colors.dark.steel}
      />
      {/* Volt fill arc -- always drawn (no calibrating/steel-only variant, D-05). */}
      <Path
        path={ringPath}
        style="stroke"
        strokeWidth={ringStrokeWidth}
        strokeCap="round"
        color={Colors.dark.accent}
        start={0}
        end={fillFraction}
      />

      {numberFont ? (
        <Text
          x={ringCenterX - numberWidth / 2}
          y={ringCenterY + numberFontSize * 0.32}
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
