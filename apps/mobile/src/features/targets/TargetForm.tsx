import { zodResolver } from "@hookform/resolvers/zod";
import { createChangeTargetSchema } from "@te/contracts";
import { Controller, useForm } from "react-hook-form";
import { View } from "react-native";
import type { z } from "zod";
import { Button, Segmented, TextField } from "../../ui";
import type { ChangeTarget } from "./hooks";

const schema = createChangeTargetSchema.omit({ sortOrder: true });
type Values = z.input<typeof schema>;
export type TargetFormValues = z.output<typeof schema>;

const STATUSES = [
  { value: "active", label: "Active" },
  { value: "paused", label: "Paused" },
  { value: "achieved", label: "Achieved" },
] as const;

export function TargetForm(props: {
  initial?: ChangeTarget | undefined;
  submitLabel: string;
  busy?: boolean | undefined;
  onSubmit(values: TargetFormValues): void;
}) {
  const { control, handleSubmit, formState } = useForm<Values, unknown, TargetFormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      title: props.initial?.title ?? "",
      oldPattern: props.initial?.oldPattern ?? "",
      desiredDefault: props.initial?.desiredDefault ?? "",
      why: props.initial?.why ?? "",
      status: props.initial && props.initial.status !== "archived" ? props.initial.status : "active",
    },
  });
  const field = (
    name: "title" | "oldPattern" | "desiredDefault" | "why",
    label: string,
    hint: string,
    multiline = true,
  ) => (
    <Controller
      control={control}
      name={name}
      render={({ field: f }) => (
        <TextField
          label={label}
          hint={hint}
          multiline={multiline}
          value={f.value ?? ""}
          onChangeText={f.onChange}
          onBlur={f.onBlur}
          testID={`field-${name}`}
          error={formState.errors[name]?.message}
        />
      )}
    />
  );
  return (
    <View className="gap-4">
      {field("title", "Title", "e.g. Default to action rather than over-planning", false)}
      {field("oldPattern", "Old pattern", "What do you do now, and when?")}
      {field("desiredDefault", "Desired default", "What do you want to do instead?")}
      {field("why", "Why it matters", "In your own words")}
      <Controller
        control={control}
        name="status"
        render={({ field: f }) => (
          <Segmented label="Status" value={f.value} options={STATUSES} onChange={f.onChange} />
        )}
      />
      <Button
        label={props.submitLabel}
        busy={props.busy}
        onPress={() => void handleSubmit(props.onSubmit)()}
        testID="save-target"
      />
    </View>
  );
}
