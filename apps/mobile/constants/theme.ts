/**
 * Design tokens for Apsis (UI-SPEC: Spacing Scale, Typography).
 * Dark-only theme — see constants/Colors.ts for the color palette.
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

type TypographyRole = Pick<TextStyle, 'fontSize' | 'fontWeight' | 'lineHeight'>;

/** Typography roles — only these 4 sizes / 2 weights exist in this phase's UI. */
export const Typography: Record<'body' | 'label' | 'heading' | 'display', TypographyRole> = {
  body: { fontSize: 16, fontWeight: '400', lineHeight: 24 },
  label: { fontSize: 13, fontWeight: '400', lineHeight: 17 },
  heading: { fontSize: 20, fontWeight: '600', lineHeight: 24 },
  display: { fontSize: 32, fontWeight: '600', lineHeight: 35 },
};

/**
 * Style helper for numeric UI (set weight/reps, RPE, live HSS ticker, elapsed
 * timer, rest-timer countdown) so digits don't jitter/reflow horizontally as
 * values change live (UI-SPEC Design System — Font).
 */
export const tabularNums: Pick<TextStyle, 'fontVariant'> = {
  fontVariant: ['tabular-nums'],
};
