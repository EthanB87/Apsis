/**
 * apps/mobile/components/ScreenHeader.tsx
 *
 * Reusable screen header (Design System v1): a mono kicker line above a heavy
 * uppercase title. Presentational only — no navigation/db/router imports.
 */

import React from 'react';
import { View, Text, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import Colors from '../constants/Colors';
import { Kicker, Typography } from '../constants/theme';

export interface ScreenHeaderProps {
  /** Small mono line above the title (e.g. "CONFIG"). */
  kicker: string;
  /** Heavy uppercase title (e.g. "Settings"). */
  title: string;
  style?: StyleProp<ViewStyle>;
}

export function ScreenHeader({ kicker, title, style }: ScreenHeaderProps): React.JSX.Element {
  return (
    <View style={style}>
      <Text style={styles.kicker}>{kicker}</Text>
      <Text style={styles.title}>{title}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  kicker: {
    ...Kicker,
    color: Colors.dark.mutedText,
  },
  title: {
    ...Typography.title,
    color: Colors.dark.text,
  },
});
