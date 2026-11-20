import { Link, router } from "expo-router";
import { Pressable, Text, View } from "react-native";
import { startOfToday, useEntries } from "../../src/features/entries/hooks";
import { useTargets, useTools, type ChangeTarget, type Tool } from "../../src/features/targets/hooks";
import { uiFor } from "../../src/tools";
import { EntryHead } from "../../src/tools/evidence_log/EntryCard";
import {
  Button,
  ColumnHead,
  ErrorText,
  Heading,
  Loading,
  Screen,
  TableAction,
  TableHead,
  TableNote,
} from "../../src/ui";

/** "Log evidence" for the default evidence log; "Log: <name>" for renamed or other tools. */
function logLabel(tool: Tool): string {
  return tool.type === "evidence_log" && tool.name === "Evidence log" ? "Log evidence" : `Log: ${tool.name}`;
}

function daysSince(iso: string | null | undefined): string {
  if (!iso) return "No entries yet";
  const days = Math.floor((Date.now() - Date.parse(iso)) / 86_400_000);
  return days <= 0 ? "Logged today" : days === 1 ? "1 day since last entry" : `${days} days since last entry`;
}

/**
 * Column widths, shared by the head and every row. Below md the last-entry text folds under the target, so a
 * phone has two columns: the target and its Log buttons.
 */
const COL = {
  main: "flex-1 md:flex-row md:gap-3",
  target: "md:flex-[3]",
  since: "md:w-48",
  log: "items-end",
};
const ROW_GAP = "gap-2 md:gap-3";

/** Today: active targets with one-tap Log buttons and days since last entry, then today's entries. */
export default function Today() {
  const targets = useTargets("active");
  const tools = useTools();
  const today = useEntries({ since: startOfToday() }, 100);
  const recent = useEntries({}, 200);

  if (targets.isPending) return <Loading />;
  const toolsByTarget = new Map<string, Tool[]>();
  for (const t of tools.data?.items ?? [])
    toolsByTarget.set(t.changeTargetId, [...(toolsByTarget.get(t.changeTargetId) ?? []), t]);
  const lastByTarget = new Map<string, string>();
  for (const e of recent.data?.items ?? [])
    if (!lastByTarget.has(e.changeTargetId)) lastByTarget.set(e.changeTargetId, e.occurredAt);
  const toolName = new Map((tools.data?.items ?? []).map((t) => [t.id, t.name]));
  const active = targets.data?.items ?? [];

  return (
    <Screen testID="screen-today">
      <Heading hidden>Today</Heading>
      <ErrorText error={targets.error} />
      <View>
        <TableHead className={ROW_GAP}>
          <View className={COL.main}>
            <ColumnHead className={COL.target}>Target</ColumnHead>
            <ColumnHead className={`hidden md:flex ${COL.since}`}>Last entry</ColumnHead>
          </View>
          <ColumnHead className={COL.log}>Log</ColumnHead>
        </TableHead>
        {targets.data && active.length === 0 ? (
          <>
            <TableNote>No active change targets.</TableNote>
            <TableAction label="Create your first target" onPress={() => router.push("/targets/new")} />
          </>
        ) : null}
        {active.map((target) => (
          <TargetRow
            key={target.id}
            target={target}
            tools={toolsByTarget.get(target.id) ?? []}
            since={daysSince(lastByTarget.get(target.id))}
          />
        ))}
      </View>
      <View>
        <Heading level={2}>Today's entries</Heading>
        <EntryHead />
        {today.data?.items.length === 0 ? <TableNote>Nothing logged yet today.</TableNote> : null}
        {today.data?.items.map((entry) => {
          const ui = uiFor(entry.toolType);
          return ui ? (
            <ui.EntryCard
              key={entry.id}
              entry={entry}
              toolName={toolName.get(entry.toolId)}
              onPress={() => router.push(`/entries/${entry.id}`)}
            />
          ) : null;
        })}
      </View>
    </Screen>
  );
}

/**
 * One active target. The row holds Log buttons, so it can't be one link: the target cell (title and desired
 * default) is the link, the buttons sit in the right-hand column.
 */
function TargetRow({ target, tools, since }: { target: ChangeTarget; tools: Tool[]; since: string }) {
  return (
    <View testID="target-card" className={`flex-row items-start border-b border-rule px-2 py-1 ${ROW_GAP}`}>
      <View className={COL.main}>
        <Link href={`/targets/${target.id}`} asChild>
          <Pressable
            accessibilityRole="link"
            accessibilityLabel={target.title}
            className={`min-h-tap justify-center hover:bg-mark active:bg-mark ${COL.target}`}
          >
            <Text className="text-caption text-link" numberOfLines={2}>
              {target.title}
            </Text>
            {target.desiredDefault ? (
              <Text className="text-caption text-dim" numberOfLines={1}>
                {target.desiredDefault}
              </Text>
            ) : null}
          </Pressable>
        </Link>
        <View className={`md:min-h-tap md:justify-center ${COL.since}`}>
          <Text className="text-caption tabular-nums text-dim">{since}</Text>
        </View>
      </View>
      <View className={`gap-1 ${COL.log}`}>
        {tools.map((tool) => (
          <Button
            key={tool.id}
            compact
            variant="secondary"
            label={logLabel(tool)}
            accessibilityLabel={`Log ${tool.name} for ${target.title}`}
            onPress={() => router.push(`/log/${tool.id}`)}
            testID="log-button"
          />
        ))}
      </View>
    </View>
  );
}
