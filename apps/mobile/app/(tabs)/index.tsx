import { StyleSheet } from 'react-native';

import { Text, View } from '@/components/Themed';
import Colors from '@/constants/Colors';
import { Spacing, Typography } from '@/constants/theme';

/**
 * Home placeholder (D-31): a branded "coming soon" screen. Phase 4 fills this
 * tab in with the HOME-* home-screen requirements. This phase must render no
 * session summary of any kind — ONB-03 is satisfied structurally by never
 * showing that summary anywhere yet.
 */
export default function HomeScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Coming soon</Text>
      <Text
        style={styles.body}
        lightColor={Colors.light.mutedText}
        darkColor={Colors.dark.mutedText}>
        Your training overview will live here. Head to the Log tab to start a workout.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.xl,
  },
  title: {
    ...Typography.heading,
    marginBottom: Spacing.sm,
  },
  body: {
    ...Typography.label,
    textAlign: 'center',
  },
});
