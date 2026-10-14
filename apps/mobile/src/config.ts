import Constants from "expo-constants";
import { Platform } from "react-native";

/**
 * API origin. On web the app is served by the API itself, so requests are same-origin ("") unless
 * EXPO_PUBLIC_API_URL points elsewhere (e.g. `expo start --web` on :8081 against the API on :3000).
 */
export function apiBaseUrl(): string {
  const fromEnv = process.env["EXPO_PUBLIC_API_URL"];
  if (fromEnv) return fromEnv.replace(/\/$/, "");
  if (Platform.OS === "web") return "";
  const extra = Constants.expoConfig?.extra as { apiUrl?: string } | undefined;
  return (extra?.apiUrl || "http://localhost:3000").replace(/\/$/, "");
}

/** Absolute origin (Better Auth's client needs one even on web). */
export function apiOrigin(): string {
  const base = apiBaseUrl();
  if (base) return base;
  return typeof window !== "undefined" ? window.location.origin : "http://localhost:3000";
}
