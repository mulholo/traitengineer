import { router, type Href } from "expo-router";
import { Pressable, Text } from "react-native";

// Kept out of ./index.tsx so components that only need the shared controls don't pull expo-router into
// their Jest tests.

/**
 * "‹ Targets": the way back up from a detail page, as a link. Goes back when there is history (keeps scroll and
 * filters), otherwise to `fallback` (a deep link or a reload).
 */
export function BackLink({ label, fallback }: { label: string; fallback: Href }) {
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={`Back to ${label}`}
      onPress={() => (router.canGoBack() ? router.back() : router.replace(fallback))}
      className="min-h-tap self-start justify-center pr-2 hover:bg-mark"
    >
      <Text className="text-caption text-link">‹ {label}</Text>
    </Pressable>
  );
}
