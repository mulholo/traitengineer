import { reminderScheduleSchema } from "@te/contracts";
import { useState } from "react";
import { View } from "react-native";
import {
  describeSchedule,
  useCreateReminder,
  useDeleteReminder,
  useReminders,
  useSendTestReminder,
  useUpdateReminder,
  type Schedule,
} from "../../src/features/reminders/hooks";
import { useTools } from "../../src/features/targets/hooks";
import {
  Body,
  Button,
  Caption,
  Card,
  Empty,
  ErrorText,
  Heading,
  Screen,
  Segmented,
  TextField,
  Toggle,
} from "../../src/ui";

const PRESETS = [
  { value: "daily", label: "Daily" },
  { value: "weekdays", label: "Weekdays" },
  { value: "every_n_hours", label: "Every N hours" },
] as const;

function buildSchedule(
  type: Schedule["type"],
  f: { time: string; every: string; start: string; end: string },
): unknown {
  if (type === "every_n_hours") return { type, everyHours: Number(f.every), start: f.start, end: f.end };
  return { type, time: f.time };
}

/** Reminders: list, create from presets (never raw rrule), enable toggle, send test. */
export default function Reminders() {
  const reminders = useReminders();
  const tools = useTools();
  const create = useCreateReminder();
  const update = useUpdateReminder();
  const remove = useDeleteReminder();
  const test = useSendTestReminder();
  const [type, setType] = useState<Schedule["type"]>("daily");
  const [form, setForm] = useState({
    time: "09:00",
    every: "3",
    start: "09:00",
    end: "18:00",
    title: "Time to log some evidence",
  });
  const [toolId, setToolId] = useState<string | undefined>();
  const [formError, setFormError] = useState<string>();
  const [testResult, setTestResult] = useState<string>();

  const toolOptions = (tools.data?.items ?? []).map((t) => ({ value: t.id, label: t.name }));

  function submit() {
    const parsed = reminderScheduleSchema.safeParse(buildSchedule(type, form));
    if (!parsed.success) {
      setFormError(parsed.error.issues[0]?.message ?? "Check the times (HH:MM)");
      return;
    }
    setFormError(undefined);
    create.mutate({ schedule: parsed.data, title: form.title, ...(toolId ? { toolId } : {}) });
  }

  return (
    <Screen testID="screen-reminders">
      <Heading>Reminders</Heading>
      <ErrorText error={reminders.error ?? update.error ?? remove.error} />
      {reminders.data?.items.length === 0 ? <Empty title="No reminders yet" /> : null}
      {reminders.data?.items.map((r) => (
        <Card key={r.id} testID="reminder-card">
          <Body className="font-semibold">{r.title}</Body>
          <Caption>
            {describeSchedule(r.schedule)} · {r.timezone}
            {r.nextFireAt
              ? ` · next ${new Date(r.nextFireAt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}`
              : ""}
          </Caption>
          <Toggle
            label="Enabled"
            value={r.enabled}
            onChange={(enabled) => update.mutate({ id: r.id, body: { enabled } })}
          />
          <View className="flex-row flex-wrap gap-2">
            <Button
              label="Send test"
              variant="secondary"
              compact
              busy={test.isPending && test.variables === r.id}
              onPress={() =>
                test.mutate(r.id, {
                  onSuccess: (res) =>
                    setTestResult(
                      res.devices === 0
                        ? "No devices registered yet — open the iPhone app and allow notifications."
                        : `Sent to ${res.devices} device(s).`,
                    ),
                })
              }
            />
            <Button label="Delete" variant="danger" compact onPress={() => remove.mutate(r.id)} />
          </View>
        </Card>
      ))}
      {testResult ? <Body muted>{testResult}</Body> : null}

      <Heading level={2}>New reminder</Heading>
      <Card>
        <Segmented label="Schedule" value={type} options={PRESETS} onChange={setType} />
        {type === "every_n_hours" ? (
          <View className="gap-3">
            <TextField
              label="Every (hours)"
              keyboardType="number-pad"
              value={form.every}
              onChangeText={(every) => setForm({ ...form, every })}
            />
            <TextField
              label="From (HH:MM)"
              value={form.start}
              onChangeText={(start) => setForm({ ...form, start })}
            />
            <TextField
              label="Until (HH:MM)"
              value={form.end}
              onChangeText={(end) => setForm({ ...form, end })}
            />
          </View>
        ) : (
          <TextField
            label="Time (HH:MM, 24-hour)"
            value={form.time}
            onChangeText={(time) => setForm({ ...form, time })}
            testID="reminder-time"
          />
        )}
        <TextField
          label="Notification text"
          value={form.title}
          onChangeText={(title) => setForm({ ...form, title })}
        />
        {toolOptions.length > 0 ? (
          <Segmented label="Opens quick log for" value={toolId} options={toolOptions} onChange={setToolId} />
        ) : null}
        {formError ? <Body className="text-danger">{formError}</Body> : null}
        <ErrorText error={create.error} />
        <Button label="Add reminder" busy={create.isPending} onPress={submit} testID="add-reminder" />
      </Card>
    </Screen>
  );
}
