import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { View } from "react-native";
import { useDeleteEntry, useEntry, useUpdateEntry } from "../../../src/features/entries/hooks";
import { useTool } from "../../../src/features/targets/hooks";
import { uiFor } from "../../../src/tools";
import { Button, ErrorText, Heading, Loading, Screen } from "../../../src/ui";

const back = () => (router.canGoBack() ? router.back() : router.replace("/"));

/** View, edit and delete one entry. */
export default function EntryDetail() {
  const { id = "" } = useLocalSearchParams<{ id: string }>();
  const entry = useEntry(id);
  const tool = useTool(entry.data?.toolId ?? "");
  const update = useUpdateEntry(id);
  const remove = useDeleteEntry(id);
  const [editing, setEditing] = useState(false);

  if (entry.isPending) return <Loading />;
  if (!entry.data)
    return (
      <Screen>
        <ErrorText error={entry.error ?? new Error("Not found")} />
      </Screen>
    );
  const ui = uiFor(entry.data.toolType);

  return (
    <Screen testID="screen-entry">
      <Button label="‹ Back" variant="ghost" compact onPress={back} />
      <Heading>{editing ? "Edit entry" : "Entry"}</Heading>
      <ErrorText error={update.error ?? remove.error} />
      {editing && tool.data && ui ? (
        <View className="min-h-[560px]">
          <ui.QuickLogForm
            tool={tool.data}
            initialPayload={entry.data.payload}
            submitLabel="Save changes"
            busy={update.isPending}
            onSubmit={(payload) => update.mutate({ payload }, { onSuccess: () => setEditing(false) })}
          />
        </View>
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
