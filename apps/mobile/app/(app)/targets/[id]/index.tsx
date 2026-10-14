import { router, useLocalSearchParams } from "expo-router";
import { View } from "react-native";
import { useEntries } from "../../../../src/features/entries/hooks";
import {
  useArchiveTarget,
  useTarget,
  useTargetSummary,
  useTools,
} from "../../../../src/features/targets/hooks";
import { WeeklyChart } from "../../../../src/features/targets/WeeklyChart";
import { uiFor } from "../../../../src/tools";
import { Body, Button, Caption, Card, ErrorText, Heading, Loading, Screen } from "../../../../src/ui";

export default function TargetDetail() {
  const { id = "" } = useLocalSearchParams<{ id: string }>();
  const target = useTarget(id);
  const summary = useTargetSummary(id);
  const tools = useTools(id);
  const entries = useEntries({ changeTargetId: id }, 50);
  const archive = useArchiveTarget(id);

  if (target.isPending) return <Loading />;
  if (!target.data)
    return (
      <Screen>
        <ErrorText error={target.error ?? new Error("Not found")} />
      </Screen>
    );
  const t = target.data;
  const toolName = new Map((tools.data?.items ?? []).map((x) => [x.id, x.name]));
  const firstTool = summary.data?.tools[0];

  return (
    <Screen testID="screen-target-detail">
      <Button
        label="‹ Targets"
        variant="ghost"
        compact
        onPress={() => (router.canGoBack() ? router.back() : router.replace("/targets"))}
      />
      <Heading>{t.title}</Heading>
      <Caption>{t.status}</Caption>
      <Card>
        {t.oldPattern ? (
          <Body>
            <Body className="font-semibold">Old pattern: </Body>
            {t.oldPattern}
          </Body>
        ) : null}
        {t.desiredDefault ? (
          <Body>
            <Body className="font-semibold">Desired default: </Body>
            {t.desiredDefault}
          </Body>
        ) : null}
        {t.why ? (
          <Body>
            <Body className="font-semibold">Why: </Body>
            {t.why}
          </Body>
        ) : null}
      </Card>
      <View className="flex-row flex-wrap gap-2">
        {(tools.data?.items ?? []).map((tool) => (
          <Button
            key={tool.id}
            label={tool.name === "Evidence log" ? "Log evidence" : `Log: ${tool.name}`}
            onPress={() => router.push(`/log/${tool.id}`)}
          />
        ))}
        <Button label="Edit" variant="secondary" onPress={() => router.push(`/targets/${id}/edit`)} />
        {t.status !== "archived" ? (
          <Button
            label="Archive"
            variant="danger"
            busy={archive.isPending}
            onPress={() => archive.mutate()}
          />
        ) : null}
      </View>
      <Heading level={2}>Last 12 weeks</Heading>
      {firstTool ? (
        <Card>
          <WeeklyChart weeks={firstTool.summary.weeklyCounts} />
          <Caption>
            {summary.data?.totals.entries ?? 0} entries · current streak {firstTool.summary.currentStreakDays}{" "}
            days
          </Caption>
        </Card>
      ) : (
        <Body muted>No tools yet.</Body>
      )}
      <Heading level={2}>Timeline</Heading>
      {entries.data?.items.length === 0 ? <Body muted>No entries yet.</Body> : null}
      {entries.data?.items.map((entry) => {
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
