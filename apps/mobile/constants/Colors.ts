/**
 * Apsis ships dark-mode only in v1.0 (UI-SPEC Design System — Theming decision).
 * The `light`/`dark` key shape is kept for future-proofing, but both resolve to
 * the same dark palette this phase.
 *
 * Palette source of truth: docs/apsis_claude_design_prompt.md ("PERFORMANCE INSTRUMENT,
 * NOT A DIARY") — void/carbon/steel/line/bone/ash/volt/molten. Volt is the single
 * primary accent; molten is reserved for alert/heat/overreaching states only — the
 * two must never compete as fills in the same view (quick task 260709-qmv).
 */

const background = '#0B0C0E'; // void — Dominant (60%) — screen backgrounds
const surface = '#15171A'; // carbon — Secondary (30%) — cards / elevated surfaces
const steel = '#1F2329'; // steel — raised surface, inactive track
const accent = '#C6F23D'; // volt — Accent (10%) — primary CTAs, live HSS number, active tab, "go/ready"
const onAccent = '#0B0C0E'; // void — label color for volt-filled CTAs (never bone-on-volt)
const destructive = '#FF5A1F'; // molten — alert/heat accent: overreaching, red-zone readiness, "stop"
const warning = '#CDBE4A'; // amber — amber/caution readiness (never pure volt)
const text = '#F2F1EC'; // bone — primary text on all dark surfaces
const mutedText = '#8A9098'; // ash — secondary/muted text, metadata, placeholders
const border = '#2A2F36'; // line — hairline dividers, card edges
const accentPressed = '#A9D32B'; // volt pressed state — primary CTA press feedback (Design System v1)

const darkPalette = {
  text,
  mutedText,
  background,
  surface,
  steel,
  tint: accent,
  accent,
  accentPressed,
  onAccent,
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
