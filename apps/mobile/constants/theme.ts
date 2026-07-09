/**
 * Design tokens for Apsis (UI-SPEC: Spacing Scale, Typography).
 * Dark-only theme — see constants/Colors.ts for the color palette.
 *
 * Type system (apsis_claude_design_prompt.md): Archivo Expanded (heavy) for display/
 * headline sizes and big numbers, Archivo for body/UI, JetBrains Mono for data/
 * telemetry (metrics, units, timestamps, set/rep data) — the mono-for-data rule is
 * core to the "performance instrument, not a diary" identity. True "Expanded" width
 * isn't shipped on expo-google-fonts, so heavy-weight Archivo (900/800) is the
 * pragmatic stand-in the design brief explicitly permits.
 */
import type { TextStyle } from 'react-native';

/** Spacing scale — all values are multiples of 4 (UI-SPEC Spacing Scale). */
export const Spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
  xxxl: 64,
} as const;

/**
 * Minimum hit target (44x44pt) for every icon-only or single-tap control,
 * regardless of the visible glyph size (UI-SPEC Spacing Scale — Exceptions;
 * Apple HIG minimum).
 */
export const HIT_TARGET_MIN = 44;

/** Hairline divider width between set rows / card edges (UI-SPEC exception, not a spacing token). */
export const HAIRLINE_WIDTH = 2;

/** Corner radius tokens — sharp, not pillowy (design brief: ~6-10px on cards/buttons). */
export const Radius = {
  sm: 6,
  md: 8,
  lg: 10,
} as const;

type TypographyRole = Pick<
  TextStyle,
  'fontSize' | 'fontWeight' | 'lineHeight' | 'fontFamily' | 'textTransform' | 'letterSpacing'
>;

/** Typography roles — display/heading carry the heavy Archivo family, ALL CAPS, tight tracking. */
export const Typography: Record<'body' | 'label' | 'heading' | 'display', TypographyRole> = {
  body: { fontFamily: 'Archivo_400Regular', fontSize: 16, fontWeight: '400', lineHeight: 24 },
  label: { fontFamily: 'Archivo_500Medium', fontSize: 13, fontWeight: '400', lineHeight: 17 },
  heading: {
    fontFamily: 'Archivo_800ExtraBold',
    fontSize: 20,
    fontWeight: '600',
    lineHeight: 24,
    textTransform: 'uppercase',
    letterSpacing: -0.5,
  },
  display: {
    fontFamily: 'Archivo_900Black',
    fontSize: 40,
    fontWeight: '600',
    lineHeight: 44,
    textTransform: 'uppercase',
    letterSpacing: -0.5,
  },
};

/**
 * Data / telemetry role for metrics, units, timestamps, set/rep data (design brief:
 * "numbers must look like instrument readouts"). Wide-tracked, uppercase JetBrains Mono.
 */
export const Mono: TypographyRole = {
  fontFamily: 'JetBrainsMono_500Medium',
  fontSize: 13,
  letterSpacing: 1,
  textTransform: 'uppercase',
};

/**
 * Style helper for numeric UI (set weight/reps, RPE, live HSS ticker, elapsed
 * timer, rest-timer countdown) so digits don't jitter/reflow horizontally as
 * values change live (UI-SPEC Design System — Font).
 */
export const tabularNums: Pick<TextStyle, 'fontVariant'> = {
  fontVariant: ['tabular-nums'],
};
