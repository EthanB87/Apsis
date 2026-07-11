/**
 * apps/mobile/components/SourceChip.tsx
 *
 * Ash-tinted "APPLE HEALTH" provenance chip (D-08, 05-UI-SPEC.md Component Notes §3).
 * Extracted from `components/history/DayRow.tsx`'s Task 1 chip so History's session
 * sub-rows and `app/session/detail.tsx`'s timestamp line render byte-identical chip
 * visuals instead of two divergent style copies — `Radius.pill`, `Mono` role at
 * `fontSize: 11`, ash tint (never volt/amber; a provenance label, not an accent element).
 *
 * Renders unconditionally when mounted — callers gate rendering on
 * `source === 'healthkit'` themselves (no chip is the default/expected case for
 * manually logged sessions, not an error state).
 */
import { StyleSheet, Text, View } from 'react-native';

import Colors from '../constants/Colors';
import { Mono, Radius, Spacing } from '../constants/theme';

export function SourceChip(): React.JSX.Element {
  return (
    <View style={styles.chip}>
      <Text style={styles.chipLabel}>APPLE HEALTH</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: Radius.pill,
    backgroundColor: 'rgba(138,144,152,0.15)',
  },
  chipLabel: {
    ...Mono,
    fontSize: 11,
    color: Colors.dark.mutedText,
  },
});
