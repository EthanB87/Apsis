/**
 * apps/mobile/components/session/HSSBreakdownSheet.tsx
 *
 * MINIMAL STUB — mount point only. Plan 08 fleshes this out into the full D-24 breakdown:
 * per-exercise Label-size subtotal rows (name + set count + stress subtotal) ending in a
 * Heading-size session total. This plan only wires `sessionStore.breakdownOpen` to a real
 * `@gorhom/bottom-sheet` showing the session total, so `session.tsx` can mount it now and
 * Plan 08 only has to extend this file's contents — never touch `session.tsx` again.
 */

import { StyleSheet, Text } from 'react-native';
import BottomSheet, { BottomSheetView } from '@gorhom/bottom-sheet';

import Colors from '../../constants/Colors';
import { Spacing, Typography } from '../../constants/theme';
import { useSessionStore } from '../../stores/sessionStore';

export function HSSBreakdownSheet(): React.JSX.Element {
  const breakdownOpen = useSessionStore((s) => s.breakdownOpen);
  const liveHss = useSessionStore((s) => s.liveHss);
  const setBreakdownOpen = useSessionStore((s) => s.setBreakdownOpen);

  return (
    <BottomSheet
      index={breakdownOpen ? 0 : -1}
      snapPoints={['40%']}
      enablePanDownToClose
      onClose={() => setBreakdownOpen(false)}
      backgroundStyle={styles.background}
      handleIndicatorStyle={styles.handleIndicator}>
      <BottomSheetView style={styles.content}>
        <Text style={styles.label}>Session Total</Text>
        <Text style={styles.total}>{Math.round(liveHss)}</Text>
      </BottomSheetView>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  background: {
    backgroundColor: Colors.dark.surface,
  },
  handleIndicator: {
    backgroundColor: Colors.dark.border,
  },
  content: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    alignItems: 'center',
  },
  label: {
    ...Typography.label,
    color: Colors.dark.mutedText,
    marginBottom: Spacing.xs,
  },
  total: {
    ...Typography.heading,
    color: Colors.dark.accent,
  },
});
