/**
 * Design tokens for Apsis (UI-SPEC: Spacing Scale, Typography).
 * Dark-only theme — see constants/Colors.ts for the color palette.
 *
 * Type system (docs/apsis_claude_design_prompt.md): Archivo Expanded (heavy) for display/
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

/**
 * Typography roles — display/heading carry the heavy Archivo family, ALL CAPS, tight tracking.
 * Sizes/tracking per DESIGN-SYSTEM.md §2: H3 (heading) ~22, H2 (title) ~30, hero (display)
 * ~68 is the Phase-4 HSS ring number and is NOT built yet -- display stays at 40 (session
 * header size) per this plan's Phase-3-only scope. heading/display/title are single-face
 * (Archivo_800ExtraBold / Archivo_900Black) so they carry no fontWeight key -- a mismatched
 * weight can shift face selection/metrics on iOS.
 */
export const Typography: Record<'body' | 'label' | 'heading' | 'display' | 'displayXl' | 'title', TypographyRole> = {
  body: { fontFamily: 'Archivo_400Regular', fontSize: 16, fontWeight: '400', lineHeight: 24 },
  label: { fontFamily: 'Archivo_500Medium', fontSize: 13, fontWeight: '400', lineHeight: 17 },
  heading: {
    fontFamily: 'Archivo_800ExtraBold',
    fontSize: 22,
    lineHeight: 21,
    textTransform: 'uppercase',
    letterSpacing: -0.3,
  },
  display: {
    fontFamily: 'Archivo_900Black',
    fontSize: 40,
    lineHeight: 44,
    textTransform: 'uppercase',
    letterSpacing: -0.5,
  },
  /**
   * Phase-4 addition (04-UI-SPEC.md Typography): the home 200px HSS ring's count-up number
   * ONLY. Single-face heavy (Archivo_900Black), no `fontWeight` key.
   */
  displayXl: {
    fontFamily: 'Archivo_900Black',
    fontSize: 60,
    lineHeight: 54,
    textTransform: 'uppercase',
    letterSpacing: -0.6,
  },
  /** Screen-header heavy title (Design System v1) — pairs with the `Kicker` mono line above it. */
  title: {
    fontFamily: 'Archivo_900Black',
    fontSize: 30,
    lineHeight: 28,
    textTransform: 'uppercase',
    letterSpacing: -0.45,
  },
};

/**
 * Data / telemetry role for metrics, units, timestamps, set/rep data (design brief:
 * "numbers must look like instrument readouts"). Wide-tracked, uppercase JetBrains Mono
 * (DESIGN-SYSTEM.md §2: wide tracking 0.2-0.34em on uppercase mono labels -- 0.2em @ 13px ~= 2.6).
 * Numeric VALUE styling (set-row load/reps/RPE) must NOT inherit this label tracking --
 * consume the mono fontFamily directly with `tabularNums`, not this role, to protect row width.
 */
export const Mono: TypographyRole = {
  fontFamily: 'JetBrainsMono_500Medium',
  fontSize: 13,
  letterSpacing: 2.6,
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
 * Tracking widened to 0.2em @ 11px (~2.2) per DESIGN-SYSTEM.md §2.
 */
export const Kicker: TypographyRole = {
  fontFamily: 'JetBrainsMono_500Medium',
  fontSize: 11,
  letterSpacing: 2.2,
  textTransform: 'uppercase',
};
