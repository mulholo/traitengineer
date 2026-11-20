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
    <View accessibilityRole="alert" testID="sync-banner" className="bg-ink px-4 py-1">
      <Text className="text-center text-caption font-semibold text-paper">
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
        className={`group min-h-tap justify-center ${wide ? "" : "flex-1 items-center"}`}
      >
        {/* One line, shrinking slightly on narrow phones rather than wrapping ("Reminders" on a 390pt iPhone). */}
        <View className={`px-1.5 py-0.5 group-hover:bg-mark ${active ? "bg-mark" : ""}`}>
          <Text
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.8}
            className={`text-caption ${active ? "font-semibold text-ink" : "text-link"}`}
          >
            {item.label}
          </Text>
        </View>
      </Pressable>
    );
  });

  if (wide) {
    return (
      <View
        role="navigation"
        className="h-full w-44 border-r border-rule bg-paper px-3"
        style={{ paddingTop: insets.top + 12 }}
      >
        <Text className="mb-2 min-h-tap px-1.5 py-3 text-caption font-semibold text-ink">Trait Engineer</Text>
        {items}
      </View>
    );
  }
  return (
    <View
      role="tablist"
      className="flex-row border-t border-rule bg-paper px-2"
      style={{ paddingBottom: Math.max(insets.bottom, 8) }}
    >
      {items}
    </View>
  );
}
