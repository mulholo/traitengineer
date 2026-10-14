import { Pressable, Text, View } from "react-native";
import { Caption } from "../../ui";
import type { EntryCardProps } from "../types";

const LABELS: [string, string][] = [
  ["expected", "Expected"],
  ["happened", "Happened"],
  ["supports", "Supports"],
  ["uncertain", "Uncertain"],
];

export function EntryCard({ entry, toolName, onPress }: EntryCardProps) {
  const p = entry.payload;
  const when = new Date(entry.occurredAt).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
  const tags = Array.isArray(p["tags"]) ? (p["tags"] as string[]) : [];
  return (
    <Pressable
      accessibilityRole={onPress ? "button" : undefined}
      accessibilityLabel={`Entry: ${String(p["summary"] ?? "")}, ${when}`}
      onPress={onPress}
      disabled={!onPress}
      testID="entry-card"
      className="min-h-tap gap-1 rounded-card border border-border bg-surface p-4"
    >
      <Text className="text-body font-semibold text-text">{String(p["summary"] ?? "")}</Text>
      {LABELS.map(([key, label]) =>
        typeof p[key] === "string" && p[key] ? (
          <Text key={key} className="text-body text-muted" numberOfLines={2}>
            <Text className="font-semibold">{label}: </Text>
            {String(p[key])}
          </Text>
        ) : null,
      )}
      <View className="flex-row flex-wrap items-center gap-2">
        <Caption>
          {when}
          {toolName ? ` · ${toolName}` : ""}
          {typeof p["difficulty"] === "number" ? ` · difficulty ${p["difficulty"]}/5` : ""}
        </Caption>
        {tags.map((t) => (
          <Text key={t} className="rounded-full border border-border px-2 text-caption text-muted">
            #{t}
          </Text>
        ))}
      </View>
    </Pressable>
  );
}
