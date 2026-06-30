/**
 * apps/mobile/components/BootStates.tsx
 *
 * Boot-sequence screens rendered by _layout.tsx before the database is ready.
 *
 * Security (V7 / T-1-02 — Error Handling):
 *   ErrorScreen renders a hardcoded generic string ONLY.
 *   It accepts NO message prop and interpolates NO error object, error.message,
 *   or file paths. Raw error details are console.error'd in _layout.tsx for
 *   developer diagnostics but must never reach the user's screen.
 */

import React from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';

// ---------------------------------------------------------------------------
// LoadingScreen
// ---------------------------------------------------------------------------

/**
 * Shown while useMigrations() is running (success === false and error is absent).
 * Uses ActivityIndicator so the user knows something is happening.
 */
export function LoadingScreen(): React.JSX.Element {
  return (
    <View style={styles.container} testID="boot-loading">
      <ActivityIndicator size="large" color="#555" />
      <Text style={styles.loadingText}>Starting database...</Text>
    </View>
  );
}

// ---------------------------------------------------------------------------
// ErrorScreen
// ---------------------------------------------------------------------------

/**
 * Shown when useMigrations() resolves with an error.
 *
 * HARD RULE (V7 / T-1-02): this component renders only the literal string below.
 * Do NOT add a `message` prop, do NOT interpolate `error.message`, do NOT render
 * any path that came from the error object. Log raw error in _layout.tsx only.
 */
export function ErrorScreen(): React.JSX.Element {
  return (
    <View style={styles.container} testID="boot-error">
      <Text style={styles.errorText}>
        Could not start the local database. Please reinstall the app.
      </Text>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
    paddingHorizontal: 32,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666666',
    textAlign: 'center',
  },
  errorText: {
    fontSize: 16,
    color: '#c0392b',
    textAlign: 'center',
    lineHeight: 24,
  },
});
