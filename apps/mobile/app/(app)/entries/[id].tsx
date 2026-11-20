import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { View } from "react-native";
import { useDeleteEntry, useEntry, useUpdateEntry } from "../../../src/features/entries/hooks";
import { useTarget, useTool } from "../../../src/features/targets/hooks";
import { uiFor } from "../../../src/tools";
import type { Entry } from "../../../src/tools/types";
import { BackLink } from "../../../src/ui/BackLink";
import { Button, ErrorText, Heading, Loading, Screen, SpecList } from "../../../src/ui";

const back = () => (router.canGoBack() ? router.back() : router.replace("/"));

/** Evidence-log payload fields in reading order, with their spec-sheet labels. */
const FIELDS: readonly [key: string, label: string][] = [
  ["expected", "Expected"],
  ["happened", "Happened"],
  ["supports", "Supports"],
  ["uncertain", "Uncertain"],
  ["details", "Details"],
];

function text(p: Record<string, unknown>, key: string): string {
  const v = p[key];
  return typeof v === "string" ? v : "";
}

/** The entry as a spec sheet: when, where it was logged, then each answered field. Empty rows drop out. */
function entryRows(entry: Entry, toolName: string | undefined, targetTitle: string | undefined) {
  const p = entry.payload;
  return [
    {
      label: "When",
      value: new Date(entry.occurredAt).toLocaleString(undefined, {
        dateStyle: "medium",
        timeStyle: "short",
      }),
    },
    { label: "Target", value: targetTitle ?? "" },
    { label: "Tool", value: toolName ?? "" },
    ...FIELDS.map(([key, label]) => ({ label, value: text(p, key) })),
    { label: "Difficulty", value: typeof p["difficulty"] === "number" ? `${p["difficulty"]} of 5` : "" },
  ];
}

/** View, edit and delete one entry. The entry's summary is the page's subject. */
export default function EntryDetail() {
  const { id = "" } = useLocalSearchParams<{ id: string }>();
  const entry = useEntry(id);
  const tool = useTool(entry.data?.toolId ?? "");
  const target = useTarget(entry.data?.changeTargetId ?? "");
  const update = useUpdateEntry(id);
  const remove = useDeleteEntry(id);
  const [editing, setEditing] = useState(false);

  if (entry.isPending) return <Loading />;
  if (!entry.data)
    return (
      <Screen narrow>
        <BackLink label="Today" fallback="/" />
        <ErrorText error={entry.error ?? new Error("Not found")} />
      </Screen>
    );
  const ui = uiFor(entry.data.toolType);
  const summary = text(entry.data.payload, "summary");

  return (
    <Screen narrow testID="screen-entry">
      <View>
        <BackLink
          label={target.data?.title ?? "Today"}
          fallback={target.data ? `/targets/${target.data.id}` : "/"}
        />
        <Heading>{editing ? "Edit entry" : summary || "Entry"}</Heading>
      </View>
      <ErrorText error={update.error ?? remove.error} />
      {editing && tool.data && ui ? (
        <ui.QuickLogForm
          tool={tool.data}
          initialPayload={entry.data.payload}
          submitLabel="Save changes"
          busy={update.isPending}
          onSubmit={(payload) => update.mutate({ payload }, { onSuccess: () => setEditing(false) })}
        />
      ) : entry.data.toolType === "evidence_log" ? (
        <SpecList rows={entryRows(entry.data, tool.data?.name, target.data?.title)} />
      ) : ui ? (
        <ui.EntryCard entry={entry.data} {...(tool.data ? { toolName: tool.data.name } : {})} />
      ) : null}
      {!editing ? (
        <View className="flex-row gap-2">
          <Button label="Edit" variant="secondary" onPress={() => setEditing(true)} testID="edit-entry" />
          <Button
            label="Delete"
            variant="danger"
            busy={remove.isPending}
            onPress={() => remove.mutate(undefined, { onSuccess: back })}
            testID="delete-entry"
          />
        </View>
      ) : (
        <Button label="Cancel" variant="ghost" onPress={() => setEditing(false)} />
      )}
    </Screen>
  );
}
