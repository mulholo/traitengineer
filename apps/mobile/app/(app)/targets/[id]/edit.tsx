import { router, useLocalSearchParams } from "expo-router";
import { useTarget, useUpdateTarget } from "../../../../src/features/targets/hooks";
import { TargetForm } from "../../../../src/features/targets/TargetForm";
import { ErrorText, Heading, Loading, Screen } from "../../../../src/ui";

export default function EditTarget() {
  const { id = "" } = useLocalSearchParams<{ id: string }>();
  const target = useTarget(id);
  const update = useUpdateTarget(id);
  if (target.isPending) return <Loading />;
  return (
    <Screen testID="screen-target-edit">
      <Heading>Edit target</Heading>
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
