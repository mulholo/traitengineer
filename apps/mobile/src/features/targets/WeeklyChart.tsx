import { Text, View } from "react-native";

const BAR_AREA = 80;

/**
 * Entries per ISO week (last 12 weeks) as flat ink bars on a ruled baseline, each with its count above it in
 * tabular figures and its week under it. On a phone only every third week is labelled.
 */
export function WeeklyChart({ weeks }: { weeks: { week: string; count: number }[] }) {
  const max = Math.max(1, ...weeks.map((w) => w.count));
  const total = weeks.reduce((sum, w) => sum + w.count, 0);
  const last = weeks.length - 1;
  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={`Entries per week for the last ${weeks.length} weeks: ${weeks.map((w) => w.count).join(", ")}. Total ${total}.`}
      className="w-full max-w-[560px]"
      testID="weekly-chart"
    >
      <View className="flex-row items-end gap-[3px] border-b border-rule-strong">
        {weeks.map((w) => (
          <View key={w.week} className="flex-1 items-center justify-end">
            <Text className="text-micro tabular-nums text-dim">{w.count > 0 ? w.count : " "}</Text>
            <View
              className={`w-full ${w.count > 0 ? "bg-ink" : ""}`}
              style={{ height: w.count > 0 ? Math.max(2, Math.round((w.count / max) * BAR_AREA)) : 0 }}
            />
          </View>
        ))}
      </View>
      <View className="flex-row gap-[3px] pt-1">
        {weeks.map((w, i) => (
          <View key={w.week} className="flex-1 items-center">
            <Text
              className={`text-micro tabular-nums text-dim ${i % 3 === 0 || i === last ? "" : "opacity-0 md:opacity-100"}`}
              numberOfLines={1}
            >
              {w.week.slice(5)}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}
