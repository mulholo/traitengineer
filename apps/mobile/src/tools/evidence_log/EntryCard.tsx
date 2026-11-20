import { Pressable, Text, View } from "react-native";
import { ColumnHead, TableHead } from "../../ui";
import type { EntryCardProps } from "../types";

const LABELS: [string, string][] = [
  ["expected", "Expected"],
  ["happened", "Happened"],
  ["supports", "Supports"],
  ["uncertain", "Uncertain"],
];

/** Column widths, shared by `EntryHead` and every `EntryCard` row. */
const COL = { when: "w-[72px] md:w-32", entry: "flex-1" };
const ROW_GAP = "gap-2 md:gap-3";

/** Column heads for a table of entry rows; put it above a list of `EntryCard`s. */
export function EntryHead() {
  return (
    <TableHead className={ROW_GAP}>
      <ColumnHead className={COL.when}>When</ColumnHead>
      <ColumnHead className={COL.entry}>Entry</ColumnHead>
    </TableHead>
  );
}

function whenParts(iso: string): { date: string; time: string } {
  const d = new Date(iso);
  const sameYear = d.getFullYear() === new Date().getFullYear();
  return {
    date: d.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      ...(sameYear ? {} : { year: "numeric" as const }),
    }),
    time: d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" }),
  };
}

/**
 * One entry as a ruled table row: when it happened in a narrow left column, the summary as the main cell with
 * the other fields folded under it, then tool and difficulty as small dim text. The whole row is
 * pressable when `onPress` is given.
 */
export function EntryCard({ entry, toolName, onPress }: EntryCardProps) {
  const p = entry.payload;
  const summary = String(p["summary"] ?? "");
  const when = new Date(entry.occurredAt).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
  const { date, time } = whenParts(entry.occurredAt);
  const meta = [
    toolName,
    typeof p["difficulty"] === "number" ? `difficulty ${p["difficulty"]}/5` : undefined,
  ].filter((s): s is string => !!s);
  return (
    <Pressable
      accessibilityRole={onPress ? "button" : undefined}
      accessibilityLabel={`Entry: ${summary}, ${when}`}
      onPress={onPress}
      disabled={!onPress}
      testID="entry-card"
      className={`min-h-tap flex-row items-start border-b border-rule px-2 py-1 ${ROW_GAP} ${onPress ? "hover:bg-mark active:bg-mark" : ""}`}
    >
      <View className={`${COL.when} md:flex-row md:gap-2`}>
        <Text className="text-caption tabular-nums text-ink">{date}</Text>
        <Text className="text-caption tabular-nums text-dim">{time}</Text>
      </View>
      <View className={`${COL.entry} gap-0.5`}>
        <Text selectable={!onPress} className={`text-caption ${onPress ? "text-link" : "text-ink"}`}>
          {summary}
        </Text>
        {LABELS.map(([key, label]) =>
          typeof p[key] === "string" && p[key] ? (
            <Text key={key} className="text-caption text-dim" numberOfLines={onPress ? 2 : undefined}>
              {label}: {String(p[key])}
            </Text>
          ) : null,
        )}
        {meta.length > 0 ? <Text className="text-micro text-dim">{meta.join(" · ")}</Text> : null}
      </View>
    </Pressable>
  );
}
