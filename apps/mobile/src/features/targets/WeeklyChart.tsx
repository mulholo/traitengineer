import { Text, View } from "react-native";

/** Simple bar chart of entries per ISO week (last 12 weeks). */
export function WeeklyChart({ weeks }: { weeks: { week: string; count: number }[] }) {
  const max = Math.max(1, ...weeks.map((w) => w.count));
  const total = weeks.reduce((sum, w) => sum + w.count, 0);
  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={`Entries per week for the last ${weeks.length} weeks: ${weeks.map((w) => w.count).join(", ")}. Total ${total}.`}
      className="gap-1"
      testID="weekly-chart"
    >
      <View className="h-32 flex-row items-end gap-1">
        {weeks.map((w) => (
          <View key={w.week} className="flex-1 items-center justify-end">
            {w.count > 0 ? <Text className="text-caption text-muted">{w.count}</Text> : null}
            <View
              className="w-full rounded-t bg-primary"
              style={{ height: `${(w.count / max) * 85}%`, minHeight: w.count > 0 ? 4 : 1 }}
            />
          </View>
        ))}
      </View>
      <View className="flex-row justify-between">
        <Text className="text-caption text-muted">{weeks[0]?.week.slice(5)}</Text>
        <Text className="text-caption text-muted">{weeks.at(-1)?.week.slice(5)}</Text>
      </View>
    </View>
  );
}
