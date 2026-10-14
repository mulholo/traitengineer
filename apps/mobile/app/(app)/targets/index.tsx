import { Link, router } from "expo-router";
import { useState } from "react";
import { Pressable, View } from "react-native";
import { useTargets, type Status } from "../../../src/features/targets/hooks";
import {
  Body,
  Button,
  Caption,
  Empty,
  ErrorText,
  Heading,
  Loading,
  Screen,
  Segmented,
} from "../../../src/ui";

const FILTERS = [
  { value: "active", label: "Active" },
  { value: "paused", label: "Paused" },
  { value: "achieved", label: "Achieved" },
  { value: "archived", label: "Archived" },
  { value: "all", label: "All" },
] as const;

export default function Targets() {
  const [filter, setFilter] = useState<Status | "all">("active");
  const targets = useTargets(filter === "all" ? undefined : filter);
  return (
    <Screen testID="screen-targets">
      <View className="flex-row items-center justify-between">
        <Heading>Change targets</Heading>
        <Button label="New" compact onPress={() => router.push("/targets/new")} testID="new-target" />
      </View>
      <Segmented label="Status" value={filter} options={FILTERS} onChange={setFilter} />
      <ErrorText error={targets.error} />
      {targets.isPending ? <Loading /> : null}
      {targets.data?.items.length === 0 ? <Empty title="Nothing here yet" /> : null}
      {targets.data?.items.map((t) => (
        <Link key={t.id} href={`/targets/${t.id}`} asChild>
          <Pressable
            accessibilityRole="link"
            accessibilityLabel={t.title}
            className="min-h-tap gap-1 rounded-card border border-border bg-surface p-4 active:opacity-80"
          >
            <Body className="font-semibold">{t.title}</Body>
            {t.desiredDefault ? <Body muted>{t.desiredDefault}</Body> : null}
            <Caption>{t.status}</Caption>
          </Pressable>
        </Link>
      ))}
    </Screen>
  );
}
