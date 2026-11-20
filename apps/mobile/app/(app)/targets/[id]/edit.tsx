import { router, useLocalSearchParams } from "expo-router";
import { View } from "react-native";
import { useTarget, useUpdateTarget } from "../../../../src/features/targets/hooks";
import { TargetForm } from "../../../../src/features/targets/TargetForm";
import { BackLink } from "../../../../src/ui/BackLink";
import { ErrorText, Heading, Loading, Screen } from "../../../../src/ui";

export default function EditTarget() {
  const { id = "" } = useLocalSearchParams<{ id: string }>();
  const target = useTarget(id);
  const update = useUpdateTarget(id);
  if (target.isPending) return <Loading />;
  return (
    <Screen narrow testID="screen-target-edit">
      <View>
        <BackLink label={target.data?.title ?? "Target"} fallback={`/targets/${id}`} />
        <Heading>Edit target</Heading>
      </View>
      <ErrorText error={target.error ?? update.error} />
      <TargetForm
        initial={target.data}
        submitLabel="Save changes"
        busy={update.isPending}
        onSubmit={(values) => update.mutate(values, { onSuccess: () => router.replace(`/targets/${id}`) })}
      />
    </Screen>
  );
}
