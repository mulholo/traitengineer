import type { ConfigContext, ExpoConfig } from "expo/config";

// Not secrets: committed so `eas-cli` (which can't edit a TS config) finds the project. Env vars override them,
// e.g. for previews or a fork (docs/setup.md).
const projectId = process.env["EAS_PROJECT_ID"] || "ec1f0a51-c8b6-490d-8b3d-e3805f4bcdf4";
const bundleId = process.env["IOS_BUNDLE_ID"] || "com.mulholo.traitengineer";

/**
 * Shared web credentials: ties the app to the API's domain so password managers offer its saved logins in the
 * app (and native passkeys can use it later). The API serves the matching apple-app-site-association
 * (apps/api/src/http/app-links.ts). Only for a real https host; local and dev builds have none.
 */
function associatedDomains(apiUrl: string | undefined): string[] {
  if (!apiUrl?.startsWith("https://")) return [];
  const host = new URL(apiUrl).hostname;
  return host.endsWith(".example.com") ? [] : [`webcredentials:${host}`];
}
const iosAssociatedDomains = associatedDomains(process.env["EXPO_PUBLIC_API_URL"]);

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: "Trait Engineer",
  slug: "traitengineer",
  owner: "mulholo",
  scheme: "traitengineer",
  version: "1.0.0",
  orientation: "portrait",
  userInterfaceStyle: "automatic",
  ios: {
    bundleIdentifier: bundleId,
    supportsTablet: true,
    // EAS syncs the Associated Domains capability to the App ID and regenerates the profile on the next build.
    ...(iosAssociatedDomains.length ? { associatedDomains: iosAssociatedDomains } : {}),
  },
  android: { package: bundleId },
  web: { bundler: "metro", output: "single" },
  runtimeVersion: { policy: "fingerprint" },
  ...(projectId ? { updates: { url: `https://u.expo.dev/${projectId}` } } : {}),
  extra: {
    apiUrl: process.env["EXPO_PUBLIC_API_URL"] ?? "",
    ...(projectId ? { eas: { projectId } } : {}),
  },
  plugins: [
    "expo-router",
    "expo-status-bar",
    "expo-secure-store",
    "expo-web-browser",
    "expo-localization",
    [
      "expo-quick-actions",
      {
        iosActions: [
          { id: "log", title: "Log evidence", icon: "symbol:plus.circle", params: { href: "/log/recent" } },
        ],
      },
    ],
    ["expo-notifications", { defaultChannel: "reminders" }],
    // iOS 27 requires the UIScene life cycle (see the plugin for details).
    "./plugins/with-scene-lifecycle",
  ],
  experiments: { typedRoutes: false },
});
