import { Link, router } from "expo-router";
import { Pressable, Text, View } from "react-native";
import { useAuth } from "../../src/auth/session";
import { startOfToday, useEntries } from "../../src/features/entries/hooks";
import { useTargets, useTools, type Tool } from "../../src/features/targets/hooks";
import { uiFor } from "../../src/tools";
import { Body, Button, Caption, Card, Empty, ErrorText, Heading, Loading, Screen } from "../../src/ui";

/** "Log evidence" for the default evidence log; "Log: <name>" for renamed or other tools. */
function logLabel(tool: Tool): string {
  return tool.type === "evidence_log" && tool.name === "Evidence log" ? "Log evidence" : `Log: ${tool.name}`;
}

function daysSince(iso: string | null | undefined): string {
  if (!iso) return "No entries yet";
  const days = Math.floor((Date.now() - Date.parse(iso)) / 86_400_000);
  return days <= 0 ? "Logged today" : days === 1 ? "1 day since last entry" : `${days} days since last entry`;
}

/** Today: active targets with one-tap Log buttons, days since last entry, and today's entries. */
export default function Today() {
  const { me } = useAuth();
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

  return (
    <Screen testID="screen-today">
      <Heading>Today</Heading>
      {me?.displayName ? <Body muted>Hi {me.displayName}. What did you do differently?</Body> : null}
      <ErrorText error={targets.error} />
      {targets.data?.items.length === 0 ? (
        <Empty title="No active change targets">
          <Button label="Create your first target" onPress={() => router.push("/targets/new")} />
        </Empty>
      ) : null}
      {targets.data?.items.map((target) => (
        <Card key={target.id} testID="target-card">
          <Link href={`/targets/${target.id}`} asChild>
            <Pressable
              accessibilityRole="link"
              accessibilityLabel={target.title}
              className="min-h-tap justify-center"
            >
              <Text className="text-title font-semibold text-text">{target.title}</Text>
            </Pressable>
          </Link>
          {target.desiredDefault ? <Body muted>{target.desiredDefault}</Body> : null}
          <Caption>{daysSince(lastByTarget.get(target.id))}</Caption>
          <View className="flex-row flex-wrap gap-2">
            {(toolsByTarget.get(target.id) ?? []).map((tool) => (
              <Button
                key={tool.id}
                compact
                label={logLabel(tool)}
                accessibilityLabel={`Log ${tool.name} for ${target.title}`}
                onPress={() => router.push(`/log/${tool.id}`)}
                testID="log-button"
              />
            ))}
          </View>
        </Card>
      ))}
      <Heading level={2}>Today's entries</Heading>
      {today.data?.items.length === 0 ? <Body muted>Nothing logged yet today.</Body> : null}
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
    </Screen>
  );
}
