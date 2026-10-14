import { useMutationState } from "@tanstack/react-query";
import type { BottomTabBarProps } from "expo-router/build/react-navigation/bottom-tabs";
import { Pressable, Text, useWindowDimensions, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { CREATE_ENTRY } from "../query/client";

export const WIDE_BREAKPOINT = 768;

/** Tabs shown in the nav, in order. Other routes in the group (e.g. entries/[id]) are hidden from it. */
export const NAV_ROUTES = [
  { name: "index", label: "Today" },
  { name: "targets", label: "Targets" },
  { name: "reminders", label: "Reminders" },
  { name: "settings", label: "Settings" },
] as const;

export function useIsWide(): boolean {
  return useWindowDimensions().width >= WIDE_BREAKPOINT;
}

/** "n entries waiting to sync" while entry creates are paused (offline). */
export function SyncBanner() {
  const pending = useMutationState({
    filters: { mutationKey: CREATE_ENTRY, status: "pending" },
    select: (m) => m.state.isPaused,
  }).filter(Boolean).length;
  if (pending === 0) return null;
  return (
    <View accessibilityRole="alert" testID="sync-banner" className="bg-primary px-4 py-2">
      <Text className="text-center text-body font-semibold text-on-primary">
        {pending} {pending === 1 ? "entry" : "entries"} waiting to sync
      </Text>
    </View>
  );
}

/** Custom tab bar: bottom tab bar on narrow screens, left sidebar at ≥768px. */
export function NavBar({ state, navigation }: BottomTabBarProps) {
  const wide = useIsWide();
  const insets = useSafeAreaInsets();
  const current = state.routes[state.index]?.name ?? "";

  const items = NAV_ROUTES.map((item) => {
    const active = current === item.name || current.startsWith(`${item.name}/`);
    return (
      <Pressable
        key={item.name}
        accessibilityRole="link"
        accessibilityLabel={item.label}
        accessibilityState={{ selected: active }}
        onPress={() => navigation.navigate(item.name)}
        className={`min-h-tap justify-center rounded-control px-4 ${wide ? "" : "flex-1 items-center"} ${active ? "bg-surface" : ""}`}
      >
        <Text className={`text-body ${active ? "font-semibold text-primary" : "text-muted"}`}>
          {item.label}
        </Text>
      </Pressable>
    );
  });

  if (wide) {
    return (
      <View
        role="navigation"
        className="h-full w-56 gap-1 border-r border-border bg-bg px-3 py-6"
        style={{ paddingTop: insets.top + 24 }}
      >
        <Text className="mb-4 px-4 text-title font-bold text-text">Trait Engineer</Text>
        {items}
      </View>
    );
  }
  return (
    <View
      role="tablist"
      className="flex-row border-t border-border bg-bg px-2 pt-1"
      style={{ paddingBottom: Math.max(insets.bottom, 8) }}
    >
      {items}
    </View>
  );
}
