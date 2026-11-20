import { router, useLocalSearchParams } from "expo-router";
import { Text, View } from "react-native";
import { useEntries } from "../../../../src/features/entries/hooks";
import { STATUS_LABEL } from "../../../../src/features/targets/format";
import {
  useArchiveTarget,
  useTarget,
  useTargetSummary,
  useTools,
} from "../../../../src/features/targets/hooks";
import { WeeklyChart } from "../../../../src/features/targets/WeeklyChart";
import { uiFor } from "../../../../src/tools";
import { EntryHead } from "../../../../src/tools/evidence_log/EntryCard";
import { BackLink } from "../../../../src/ui/BackLink";
import {
  Button,
  ErrorText,
  Heading,
  Loading,
  Screen,
  Section,
  Sections,
  SpecList,
  TableNote,
} from "../../../../src/ui";

/**
 * One target: its title and status with a quiet row of actions under them, then three sections, each under a
 * grey band: the spec sheet, the last 12 weeks as a bar chart and the timeline of entries.
 */
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
        <BackLink label="Targets" fallback="/targets" />
        <ErrorText error={target.error ?? new Error("Not found")} />
      </Screen>
    );
  const t = target.data;
  const toolName = new Map((tools.data?.items ?? []).map((x) => [x.id, x.name]));
  const firstTool = summary.data?.tools[0];

  return (
    <Screen testID="screen-target-detail">
      <View>
        <BackLink label="Targets" fallback="/targets" />
        <Heading>{t.title}</Heading>
        <Text className="text-caption text-dim">{STATUS_LABEL[t.status]}</Text>
      </View>
      <View className="flex-row flex-wrap gap-2">
        {(tools.data?.items ?? []).map((tool) => (
          <Button
            key={tool.id}
            compact
            label={tool.name === "Evidence log" ? "Log evidence" : `Log: ${tool.name}`}
            onPress={() => router.push(`/log/${tool.id}`)}
          />
        ))}
        <Button label="Edit" variant="secondary" compact onPress={() => router.push(`/targets/${id}/edit`)} />
        {t.status !== "archived" ? (
          <Button
            label="Archive"
            variant="danger"
            compact
            busy={archive.isPending}
            onPress={() => archive.mutate()}
          />
        ) : null}
      </View>
      <Sections>
        <Section title="Details">
          <SpecList
            rows={[
              { label: "Old pattern", value: t.oldPattern },
              { label: "Desired default", value: t.desiredDefault },
              { label: "Why", value: t.why },
            ]}
          />
        </Section>
        <Section title="Last 12 weeks">
          {firstTool ? (
            <View className="gap-2 border-b border-rule px-2 pb-3 pt-2">
              <WeeklyChart weeks={firstTool.summary.weeklyCounts} />
              <Text className="text-caption tabular-nums text-dim">
                {summary.data?.totals.entries ?? 0} entries · current streak{" "}
                {firstTool.summary.currentStreakDays} days
              </Text>
            </View>
          ) : (
            <TableNote>No tools yet.</TableNote>
          )}
        </Section>
        <Section title="Timeline">
          <EntryHead />
          {entries.isPending ? <TableNote>Loading…</TableNote> : null}
          <ErrorText error={entries.error} />
          {entries.data?.items.length === 0 ? <TableNote>No entries yet.</TableNote> : null}
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
        </Section>
      </Sections>
    </Screen>
  );
}
