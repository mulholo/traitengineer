/** jest-expo unit tests (tool forms, offline queue). Playwright e2e lives in e2e/ and is not run by jest. */
module.exports = {
  preset: "jest-expo",
  watchman: false,
  cacheDirectory: "<rootDir>/node_modules/.cache/jest",
  setupFiles: ["<rootDir>/jest.setup.ts"],
  testMatch: ["<rootDir>/src/**/*.test.ts?(x)"],
  // pnpm nests packages under node_modules/.pnpm, so allow-list by package name anywhere in the path.
  transformIgnorePatterns: [
    "node_modules/(?!(\\.pnpm|((jest-)?react-native|@react-native(-community)?)|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@sentry/react-native|native-base|react-native-svg|nativewind|react-native-css-interop|@te/.*|zod|@hookform/.*|@tanstack/.*|openapi-fetch))",
  ],
};
