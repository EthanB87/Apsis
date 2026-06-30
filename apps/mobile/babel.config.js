module.exports = {
  presets: ['babel-preset-expo'], // use babel-preset-expo, NOT @react-native/babel-preset
  plugins: [
    // Required for drizzle migration SQL bundling (BOTH metro and babel must be set — see RESEARCH Pitfall 2)
    ['inline-import', { extensions: ['.sql'] }],
  ],
};
