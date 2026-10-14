import { Redirect, router, useLocalSearchParams } from "expo-router";
import { Platform, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "../../src/auth/session";
import { LAST_TOOL_KEY, useLogEntry } from "../../src/features/entries/hooks";
import { useTarget, useTool } from "../../src/features/targets/hooks";
import { kvStorage } from "../../src/platform/storage";
import { successHaptic } from "../../src/platform/haptics";
import { uiFor } from "../../src/tools";
import { Body, Button, Caption, ErrorText, Heading, Loading } from "../../src/ui";

function newClientId(): string {
  return (
    globalThis.crypto?.randomUUID?.() ??
    "10000000-1000-4000-8000-100000000000".replace(/[018]/g, (c) =>
      (Number(c) ^ ((Math.random() * 16) >> (Number(c) / 4))).toString(16),
    )
  );
}

const close = () => (router.canGoBack() ? router.back() : router.replace("/"));

/** Quick-log sheet (modal). `/log/recent` opens the most recently used tool (home-screen quick action). */
export default function QuickLog() {
  const { status } = useAuth();
  const params = useLocalSearchParams<{ toolId: string }>();
  const toolId =
    params.toolId === "recent" ? (kvStorage.getItem(LAST_TOOL_KEY) ?? "") : (params.toolId ?? "");
  const tool = useTool(toolId);
  const target = useTarget(tool.data?.changeTargetId ?? "");
  const log = useLogEntry();

  if (status === "signedOut") return <Redirect href="/sign-in" />;
  if (!toolId) return <Redirect href="/" />;

  const ui = tool.data ? uiFor(tool.data.type) : undefined;

  return (
    <SafeAreaView className="flex-1 bg-bg" testID="screen-log">
      <View className="w-full max-w-[720px] flex-1 gap-3 self-center px-gutter py-4">
        <View className="flex-row items-start justify-between gap-2">
          <View className="flex-1">
            <Heading level={2}>{tool.data?.name ?? "Log"}</Heading>
            {target.data ? <Caption>{target.data.title}</Caption> : null}
          </View>
          <Button label="Cancel" variant="ghost" compact onPress={close} />
        </View>
        <ErrorText error={tool.error ?? log.error} />
        {tool.isPending ? <Loading /> : null}
        {tool.data && ui ? (
          <ui.QuickLogForm
            tool={tool.data}
            onSubmit={(payload) => {
              // Fire-and-forget: the mutation is persisted and replays when online, so the sheet can close now.
              log.mutate({
                toolId: tool.data.id,
                clientId: newClientId(),
                payload,
                source: Platform.OS === "web" ? "web" : "mobile",
              });
              successHaptic();
              close();
            }}
          />
        ) : tool.data ? (
          <Body muted>This tool type is not supported by this version of the app.</Body>
        ) : null}
      </View>
    </SafeAreaView>
  );
}
