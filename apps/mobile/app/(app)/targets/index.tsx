import { Link, router } from "expo-router";
import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import {
  countByStatus,
  groupByStatus,
  rowLabel,
  sinceLabel,
  STATUS_LABEL,
  STATUS_ORDER,
  streakLabel,
  targetStats,
  type StatusFilter,
  type TargetStats,
} from "../../../src/features/targets/format";
import { useTargets, useTargetSummaries, type ChangeTarget } from "../../../src/features/targets/hooks";
import {
  Band,
  ColumnHead,
  ErrorText,
  FilterLinks,
  Heading,
  Page,
  Spark,
  TableAction,
  TableHead,
  TableNote,
} from "../../../src/ui";

const FILTERS: readonly StatusFilter[] = [...STATUS_ORDER, "all"];

/**
 * Column widths, shared by the head and every row. Columns drop out as the page narrows: a phone keeps the
 * target, its entry count and the age of the last entry.
 */
const COL = {
  target: "flex-[3]",
  oldPattern: "hidden flex-[2] xl:flex",
  desiredDefault: "hidden flex-[2] lg:flex",
  entries: "w-12 md:w-14",
  weeks: "hidden w-[94px] lg:flex",
  streak: "hidden w-12 md:flex",
  since: "w-16 md:w-[68px]",
};
const ROW_GAP = "gap-2 md:gap-3";
const CELL = "text-caption text-ink";
const NUM = "text-right text-caption tabular-nums text-ink";

/**
 * Change targets as one table: a row a target, numbers from each target's summary, "New target" as its last row.
 * Rows are grouped under a status band only when the filter spans more than one status.
 */
export default function Targets() {
  const [filter, setFilter] = useState<StatusFilter>("active");
  const targets = useTargets();
  const all = targets.data?.items ?? [];
  const counts = countByStatus(all);
  const groups = groupByStatus(all, filter);
  const shown = groups.flatMap((g) => g.items);
  const summaries = useTargetSummaries(shown.map((t) => t.id));
  const grouped = filter === "all";

  return (
    <Page testID="screen-targets">
      <Heading hidden>Change targets</Heading>
      <FilterLinks
        label="Status"
        value={filter}
        onChange={setFilter}
        options={FILTERS.map((value) => ({
          value,
          label: value === "all" ? "All" : STATUS_LABEL[value],
          count: counts[value],
        }))}
      />
      <ErrorText error={targets.error} />
      <View className="mt-2">
        <TableHead className={ROW_GAP}>
          <ColumnHead className={COL.target}>Target</ColumnHead>
          <ColumnHead className={COL.oldPattern}>Old pattern</ColumnHead>
          <ColumnHead className={COL.desiredDefault}>Desired default</ColumnHead>
          <ColumnHead className={COL.entries} numeric>
            Entries
          </ColumnHead>
          <ColumnHead className={COL.weeks}>Last 12 wk</ColumnHead>
          <ColumnHead className={COL.streak} numeric>
            Streak
          </ColumnHead>
          <ColumnHead className={COL.since} numeric>
            Last entry
          </ColumnHead>
        </TableHead>
        {targets.isPending ? <TableNote>Loading…</TableNote> : null}
        {targets.data && shown.length === 0 ? (
          <TableNote>
            {filter === "all"
              ? "No change targets yet."
              : `No ${STATUS_LABEL[filter].toLowerCase()} targets.`}
          </TableNote>
        ) : null}
        {groups.map((group) => (
          <View key={group.status}>
            {grouped ? <Band title={STATUS_LABEL[group.status]} /> : null}
            {group.items.map((target) => {
              const summary = summaries.get(target.id);
              return (
                <TargetRow
                  key={target.id}
                  target={target}
                  stats={summary ? targetStats(summary) : undefined}
                />
              );
            })}
          </View>
        ))}
        <TableAction label="New target" onPress={() => router.push("/targets/new")} testID="new-target" />
      </View>
    </Page>
  );
}

/** One target: the whole row is the link, so it is a full-width 44pt target on a phone. */
function TargetRow({ target, stats }: { target: ChangeTarget; stats: TargetStats | undefined }) {
  return (
    <Link href={`/targets/${target.id}`} asChild>
      <Pressable
        accessibilityRole="link"
        accessibilityLabel={rowLabel(target, stats)}
        testID="target-row"
        className={`min-h-tap flex-row items-start border-b border-rule px-2 py-1 hover:bg-mark active:bg-mark ${ROW_GAP}`}
      >
        <View className={COL.target}>
          <Text className="text-caption text-link" numberOfLines={2}>
            {target.title}
          </Text>
          {target.desiredDefault ? (
            <View className="lg:hidden">
              <Text className="text-caption text-dim" numberOfLines={1}>
                {target.desiredDefault}
              </Text>
            </View>
          ) : null}
        </View>
        <View className={COL.oldPattern}>
          <Text className={CELL} numberOfLines={2}>
            {target.oldPattern || "—"}
          </Text>
        </View>
        <View className={COL.desiredDefault}>
          <Text className={CELL} numberOfLines={2}>
            {target.desiredDefault || "—"}
          </Text>
        </View>
        <View className={`items-end ${COL.entries}`}>
          <Text className={NUM}>{stats ? stats.entries : "·"}</Text>
        </View>
        <View className={`pt-px ${COL.weeks}`}>
          {stats ? <Spark points={stats.weeks.map((w) => ({ key: w.week, value: w.count }))} /> : null}
        </View>
        <View className={`items-end ${COL.streak}`}>
          <Text className={NUM}>{stats ? streakLabel(stats.streakDays) : "·"}</Text>
        </View>
        <View className={`items-end ${COL.since}`}>
          <Text className={NUM}>{stats ? sinceLabel(stats.daysSinceLastEntry) : "·"}</Text>
        </View>
      </Pressable>
    </Link>
  );
}
