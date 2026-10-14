import { router } from "expo-router";
import { useCreateTarget } from "../../../src/features/targets/hooks";
import { TargetForm } from "../../../src/features/targets/TargetForm";
import { Body, ErrorText, Heading, Screen } from "../../../src/ui";

export default function NewTarget() {
  const create = useCreateTarget();
  return (
    <Screen testID="screen-target-new">
      <Heading>New change target</Heading>
      <Body muted>An evidence log is attached automatically so you can start logging straight away.</Body>
      <ErrorText error={create.error} />
      <TargetForm
        submitLabel="Create target"
        busy={create.isPending}
        onSubmit={(values) => create.mutate(values, { onSuccess: (t) => router.replace(`/targets/${t.id}`) })}
      />
    </Screen>
  );
}
