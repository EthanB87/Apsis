/**
 * Apsis ships dark-mode only in v1.0 (UI-SPEC Design System — Theming decision).
 * The `light`/`dark` key shape is kept for future-proofing, but both resolve to
 * the same dark palette this phase.
 */

const background = '#0C0E12'; // Dominant (60%) — screen backgrounds
const surface = '#181B20'; // Secondary (30%) — elevated surfaces
const accent = '#3E8EF7'; // Accent (10%) — primary CTAs, live HSS number, active tab
const destructive = '#E5484D'; // Discard action, swipe-to-delete reveal
const warning = '#D9A441'; // Engine-warning badge, out-of-range notice
const text = '#F2F3F5'; // Primary text on all dark surfaces
const mutedText = '#8A8F98'; // Secondary/muted text, placeholders
const border = '#2A2E35'; // Hairline dividers, card edges

const darkPalette = {
  text,
  mutedText,
  background,
  surface,
  tint: accent,
  accent,
  destructive,
  warning,
  border,
  tabIconDefault: mutedText,
  tabIconSelected: accent,
};

export default {
  light: darkPalette,
  dark: darkPalette,
};
