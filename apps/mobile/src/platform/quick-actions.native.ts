import { useQuickActionRouting } from "expo-quick-actions/router";

/** Route home-screen quick actions ("Log evidence" → /log/recent) through Expo Router. */
export function useQuickActions(): void {
  useQuickActionRouting();
}
