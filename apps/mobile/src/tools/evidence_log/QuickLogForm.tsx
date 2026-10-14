import { zodResolver } from "@hookform/resolvers/zod";
import { evidenceLogConfigSchema, evidenceLogPayloadSchema } from "@te/contracts";
import { Controller, useForm } from "react-hook-form";
import { KeyboardAvoidingView, Platform, ScrollView, View } from "react-native";
import { z } from "zod";
import { Button, Segmented, TextField } from "../../ui";
import type { QuickLogFormProps } from "../types";

/** Form values: tags are typed as one comma-separated string; difficulty as a string choice. */
const formSchema = evidenceLogPayloadSchema.omit({ tags: true, difficulty: true }).extend({
  tags: z.string().max(600),
  difficulty: z.enum(["", "1", "2", "3", "4", "5"]),
});
type FormValues = z.input<typeof formSchema>;

const DIFFICULTY = [
  { value: "1", label: "1" },
  { value: "2", label: "2" },
  { value: "3", label: "3" },
  { value: "4", label: "4" },
  { value: "5", label: "5" },
] as const;

const REFLECTIONS = [
  { name: "expected", label: "What I expected" },
  { name: "happened", label: "What happened" },
  { name: "supports", label: "What this supports" },
  { name: "uncertain", label: "What remains uncertain" },
  { name: "details", label: "Other notes" },
] as const;

export function toPayload(values: FormValues): Record<string, unknown> {
  const payload: Record<string, unknown> = { summary: values.summary.trim() };
  for (const { name } of REFLECTIONS) {
    const v = values[name]?.trim();
    if (v) payload[name] = v;
  }
  if (values.difficulty) payload["difficulty"] = Number(values.difficulty);
  payload["tags"] = values.tags
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean)
    .slice(0, 10);
  return evidenceLogPayloadSchema.parse(payload);
}

function fromPayload(p: Record<string, unknown> | undefined): FormValues {
  const str = (k: string) => (typeof p?.[k] === "string" ? (p[k] as string) : "");
  return {
    summary: str("summary"),
    expected: str("expected"),
    happened: str("happened"),
    supports: str("supports"),
    uncertain: str("uncertain"),
    details: str("details"),
    difficulty:
      typeof p?.["difficulty"] === "number" ? (String(p["difficulty"]) as FormValues["difficulty"]) : "",
    tags: Array.isArray(p?.["tags"]) ? (p["tags"] as string[]).join(", ") : "",
  };
}

/**
 * Evidence-log quick-log form. The first field (what I did) is autofocused; the Save button sits below the
 * scrolling fields so it is always reachable without scrolling.
 */
export function QuickLogForm({
  tool,
  initialPayload,
  submitLabel = "Save",
  busy,
  onSubmit,
}: QuickLogFormProps) {
  const config = evidenceLogConfigSchema.parse(tool.config);
  const { control, handleSubmit, formState } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: fromPayload(initialPayload),
  });

  const submit = handleSubmit((values) => onSubmit(toPayload(values)));

  return (
    <KeyboardAvoidingView className="flex-1" behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView
        className="flex-1"
        contentContainerClassName="gap-4 pb-4"
        keyboardShouldPersistTaps="handled"
      >
        <Controller
          control={control}
          name="summary"
          render={({ field }) => (
            <TextField
              label={config.prompt}
              // The spec requires the first field to be focused so logging takes three taps or fewer.
              // oxlint-disable-next-line jsx-a11y/no-autofocus
              autoFocus
              value={field.value}
              onChangeText={field.onChange}
              onBlur={field.onBlur}
              maxLength={280}
              returnKeyType="done"
              testID="field-summary"
              error={formState.errors.summary ? "Say what you did (1–280 characters)" : undefined}
            />
          )}
        />
        {REFLECTIONS.map(({ name, label }) => (
          <Controller
            key={name}
            control={control}
            name={name}
            render={({ field }) => (
              <TextField
                label={label}
                multiline
                value={field.value ?? ""}
                onChangeText={field.onChange}
                onBlur={field.onBlur}
                testID={`field-${name}`}
              />
            )}
          />
        ))}
        {config.askDifficulty ? (
          <Controller
            control={control}
            name="difficulty"
            render={({ field }) => (
              <Segmented
                label="Difficulty (1 easy – 5 very hard)"
                value={field.value || undefined}
                options={DIFFICULTY}
                onChange={(v) => field.onChange(field.value === v ? "" : v)}
              />
            )}
          />
        ) : null}
        <Controller
          control={control}
          name="tags"
          render={({ field }) => (
            <TextField
              label="Tags"
              hint="Comma-separated, up to 10"
              autoCapitalize="none"
              value={field.value}
              onChangeText={field.onChange}
              testID="field-tags"
            />
          )}
        />
      </ScrollView>
      <View className="border-t border-border bg-bg pt-3">
        <Button label={submitLabel} busy={busy} onPress={() => void submit()} testID="save-entry" />
      </View>
    </KeyboardAvoidingView>
  );
}
