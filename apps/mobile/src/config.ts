import Constants from "expo-constants";
import { Platform } from "react-native";

/** Where `pnpm dev` runs the API. */
const DEV_API_PORT = 3000;

/**
 * API origin. EXPO_PUBLIC_API_URL wins when set. Otherwise:
 * - web, production: the app is served by the API itself, so requests are same-origin ("").
 * - web, dev: Metro serves the app (e.g. :8081) and answers every unknown path with index.html and a 200, so
 *   same-origin would never reach the API. Use the API's dev port on the same host instead.
 * - native: app.config's apiUrl, else the local dev API.
 */
export function apiBaseUrl(): string {
  const fromEnv = process.env["EXPO_PUBLIC_API_URL"];
  if (fromEnv) return fromEnv.replace(/\/$/, "");
  if (Platform.OS === "web") {
    if (__DEV__ && typeof window !== "undefined") {
      return `${window.location.protocol}//${window.location.hostname}:${DEV_API_PORT}`;
    }
    return "";
  }
  const extra = Constants.expoConfig?.extra as { apiUrl?: string } | undefined;
  return (extra?.apiUrl || `http://localhost:${DEV_API_PORT}`).replace(/\/$/, "");
}

/** Absolute origin (Better Auth's client needs one even on web). */
export function apiOrigin(): string {
  const base = apiBaseUrl();
  if (base) return base;
  return typeof window !== "undefined" ? window.location.origin : `http://localhost:${DEV_API_PORT}`;
}
