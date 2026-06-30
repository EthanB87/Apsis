const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Required for drizzle migration SQL bundling (BOTH metro and babel must be set — see RESEARCH Pitfall 2)
// expo/metro-config auto-detects the monorepo root via pnpm-workspace.yaml (SDK 52+)
// Do NOT add manual watchFolders — SDK 56 handles monorepo detection automatically
config.resolver.sourceExts.push('sql');

module.exports = config;
