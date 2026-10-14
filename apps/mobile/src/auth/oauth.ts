import { Platform } from "react-native";

/** On web, the OAuth authorize flow lands on /sign-in or /consent with signed query params (`sig`). */
export function currentOAuthQuery(): string | undefined {
  if (Platform.OS !== "web" || typeof window === "undefined") return undefined;
  const search = window.location.search.slice(1);
  return new URLSearchParams(search).has("sig") ? search : undefined;
}

export function goTo(url: string): void {
  if (typeof window !== "undefined") window.location.assign(url);
}
