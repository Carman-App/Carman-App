/** Component and logic tests for critical flows. */
module.exports = {
  preset: "jest-expo",
  setupFiles: ["./tests/setup.ts"],
  testMatch: ["**/tests/**/*.test.ts?(x)"],
  moduleNameMapper: { "^@/(.*)$": "<rootDir>/$1" },
  // pnpm keeps packages under node_modules/.pnpm, so allow-list by package name anywhere in the path.
  transformIgnorePatterns: [
    "node_modules/(?!(\\.pnpm|((jest-)?react-native|@react-native(-community)?)|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|nativewind|react-native-css-interop|@showrooms/.*|zustand))",
  ],
};
