const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");

/** Expo's default Metro config already understands pnpm workspaces; NativeWind compiles global.css. */
const config = getDefaultConfig(__dirname);
module.exports = withNativeWind(config, { input: "./global.css" });
