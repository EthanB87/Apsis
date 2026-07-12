const { getSentryExpoConfig } = require('@sentry/react-native/metro');

// REL-03/D-01: wraps the default Expo metro config to add Sentry debug-ID + source-map
// tooling to the output bundle. Source maps upload automatically during the EAS native
// build once SENTRY_AUTH_TOKEN is set as an EAS secret (see app.json Sentry plugin block).
const config = getSentryExpoConfig(__dirname);

// Required for drizzle migration SQL bundling (BOTH metro and babel must be set — see RESEARCH Pitfall 2)
// expo/metro-config auto-detects the monorepo root via pnpm-workspace.yaml (SDK 52+)
// Do NOT add manual watchFolders — SDK 56 handles monorepo detection automatically
config.resolver.sourceExts.push('sql');

module.exports = config;
