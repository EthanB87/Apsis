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

/**
 * Spacing scale — all values are multiples of 4 (DESIGN-SYSTEM.md §3 base-4 scale).
 * Contract-name equivalence (TS identifiers can't start with a digit, so key names
 * stay camel-safe): xs=4, sm=8, md=12, lg=16, xl=24, xxl=32 (contract "2xl"),
 * xxxl=48 (contract "3xl"), xxxxl=64 (contract "4xl").
 */
export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
  xxxxl: 64,
} as const;

/**
 * Minimum hit target (44x44pt) for every icon-only or single-tap control,
 * regardless of the visible glyph size (UI-SPEC Spacing Scale — Exceptions;
 * Apple HIG minimum).
 */
export const HIT_TARGET_MIN = 44;

/** Hairline divider width between set rows / card edges (DESIGN-SYSTEM.md §3: hairline borders are 1px). */
export const HAIRLINE_WIDTH = 1;

/**
 * Corner radius tokens — sharp, not pillowy (DESIGN-SYSTEM.md §3: btn 6, card 8, sheet 10, pill 9999).
 * Mapping (Design System v1): sm(6)=buttons/inputs/chips/segments, md(8)=cards/rows,
 * lg(10)=sheets, pill(9999)=readiness pills/progress bars.
 */
export const Radius = {
  sm: 6,
  md: 8,
  lg: 10,
  pill: 9999,
} as const;

/** Disabled control treatment (Design System v1): steel bg + ash label + this opacity. */
export const DISABLED_OPACITY = 0.7;

type TypographyRole = Pick<
  TextStyle,
  'fontSize' | 'fontWeight' | 'lineHeight' | 'fontFamily' | 'textTransform' | 'letterSpacing'
>;

/** Typography roles — display/heading carry the heavy Archivo family, ALL CAPS, tight tracking. */
export const Typography: Record<'body' | 'label' | 'heading' | 'display' | 'title', TypographyRole> = {
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
  /** Screen-header heavy title (Design System v1) — pairs with the `Kicker` mono line above it. */
  title: {
    fontFamily: 'Archivo_900Black',
    fontSize: 29,
    fontWeight: '600',
    lineHeight: 32,
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

/**
 * Mono kicker line that sits above a `Typography.title` (Design System v1 screen header).
 * Color is applied by the consumer (typically `Colors.dark.mutedText`).
 */
export const Kicker: TypographyRole = {
  fontFamily: 'JetBrainsMono_500Medium',
  fontSize: 11,
  letterSpacing: 1.8,
  textTransform: 'uppercase',
};
