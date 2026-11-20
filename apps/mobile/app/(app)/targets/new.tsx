import { router } from "expo-router";
import { View } from "react-native";
import { useCreateTarget } from "../../../src/features/targets/hooks";
import { TargetForm } from "../../../src/features/targets/TargetForm";
import { BackLink } from "../../../src/ui/BackLink";
import { ErrorText, Heading, Screen } from "../../../src/ui";

export default function NewTarget() {
  const create = useCreateTarget();
  return (
    <Screen narrow testID="screen-target-new">
      <View>
        <BackLink label="Targets" fallback="/targets" />
        <Heading>New change target</Heading>
      </View>
      <ErrorText error={create.error} />
      <TargetForm
        submitLabel="Create target"
        busy={create.isPending}
        onSubmit={(values) => create.mutate(values, { onSuccess: (t) => router.replace(`/targets/${t.id}`) })}
      />
    </Screen>
  );
}
