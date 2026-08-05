/**
 * apps/mobile/components/DecimalPadDoneBar.tsx
 *
 * Shared keyboard "Done" affordance (D-11/D-13) — the decimal pad has no return key, so
 * every quantity/number field that opens it needs an explicit way to dismiss the keyboard.
 * Built once as a single `InputAccessoryView` (RN core, no new dependency) and shared across
 * every opting-in `TextInput` via one stable nativeID: each screen mounts
 * `<DecimalPadDoneBar />` once (e.g. alongside its inputs), and every `TextInput` that opens
 * a decimal/number pad sets `inputAccessoryViewID={DECIMAL_PAD_ACCESSORY_ID}` to attach to it.
 *
 * iOS-only: `InputAccessoryView` has no Android equivalent, and Android's decimal pad already
 * ships a system dismiss affordance (RESEARCH A2) — this component renders null there, and
 * setting `inputAccessoryViewID` on an Android TextInput is a harmless no-op.
 */

import { InputAccessoryView, Keyboard, Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import Colors from '../constants/Colors';
import { Spacing } from '../constants/theme';

/** Stable nativeID every opting-in decimal/number-pad TextInput attaches to. */
export const DECIMAL_PAD_ACCESSORY_ID = 'apsis-decimal-done-bar';

export function DecimalPadDoneBar(): React.JSX.Element | null {
  if (Platform.OS !== 'ios') return null;

  return (
    <InputAccessoryView nativeID={DECIMAL_PAD_ACCESSORY_ID}>
      <View style={styles.bar}>
        <Pressable
          onPress={() => Keyboard.dismiss()}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Done"
          style={styles.doneButton}>
          <Text style={styles.doneLabel}>Done</Text>
        </Pressable>
      </View>
    </InputAccessoryView>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    height: 44,
    paddingHorizontal: Spacing.lg,
    backgroundColor: Colors.dark.surface,
    borderTopWidth: 1,
    borderTopColor: Colors.dark.border,
  },
  doneButton: {
    minHeight: 44,
    minWidth: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  doneLabel: {
    fontFamily: 'Archivo_500Medium',
    fontSize: 16,
    color: Colors.dark.accent,
  },
});
