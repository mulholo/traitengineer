import { reminderScheduleSchema } from "@te/contracts";
import { useState } from "react";
import { Text, View } from "react-native";
import {
  describeSchedule,
  useCreateReminder,
  useDeleteReminder,
  useReminders,
  useSendTestReminder,
  useUpdateReminder,
  type Reminder,
  type Schedule,
} from "../../src/features/reminders/hooks";
import { useTargets, useTools } from "../../src/features/targets/hooks";
import { notificationsSupported } from "../../src/notifications";
import {
  Body,
  Button,
  ColumnHead,
  ErrorText,
  Heading,
  RowAction,
  Screen,
  Segmented,
  TableAction,
  TableHead,
  TableNote,
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

function nextLabel(r: Reminder): string {
  return r.nextFireAt
    ? new Date(r.nextFireAt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })
    : "—";
}

/**
 * Column widths, shared by the head and every row. A phone keeps the reminder cell (schedule and next time folded
 * under the title) with its controls on a line below; schedule, opens and next become columns as the page widens.
 */
const COL = {
  reminder: "md:flex-[3]",
  schedule: "hidden flex-[2] md:flex",
  opens: "hidden flex-[2] lg:flex",
  next: "hidden w-[136px] items-end lg:flex",
  controls: "md:w-[248px]",
};
const ROW_GAP = "md:gap-3";

/** Where a reminder's notification leads: "Target · Tool", or "—" when it opens the app. */
type OpensLookup = (toolId: string | null) => { target?: string; tool: string };

/**
 * What a test send did. Only the iPhone app receives notifications (web has none in v1), so every message says
 * where to look, and refusals from the push service are shown rather than reported as sent.
 */
function describeTestResult(res: { devices: number; failed: number; errors: string[] }): string {
  if (res.devices === 0) {
    return "No devices registered yet. Open the iPhone app, sign in and allow notifications, then try again.";
  }
  const sent = res.devices - res.failed;
  const reasons = res.errors.length > 0 ? ` Push service said: ${res.errors.join("; ")}.` : "";
  if (sent === 0) return `Not sent: the push service refused all ${res.devices} device(s).${reasons}`;
  const refused = res.failed > 0 ? ` ${res.failed} refused.${reasons}` : "";
  const where = notificationsSupported
    ? ""
    : " Check your iPhone; the web app does not receive notifications.";
  return `Sent to ${sent} device(s).${where}${refused}`;
}

/** Reminders: list, create from presets (never raw rrule), enable toggle, send test. */
export default function Reminders() {
  const reminders = useReminders();
  const tools = useTools();
  const targets = useTargets();
  const create = useCreateReminder();
  const update = useUpdateReminder();
  const remove = useDeleteReminder();
  const test = useSendTestReminder();
  const [adding, setAdding] = useState(false);
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

  const toolList = tools.data?.items ?? [];
  const toolOptions = toolList.map((t) => ({ value: t.id, label: t.name }));
  const opens: OpensLookup = (id) => {
    if (!id) return { tool: "—" };
    const tool = toolList.find((t) => t.id === id);
    if (!tool) return { tool: "·" };
    const target = targets.data?.items.find((t) => t.id === tool.changeTargetId);
    return target ? { target: target.title, tool: tool.name } : { tool: tool.name };
  };

  function submit() {
    const parsed = reminderScheduleSchema.safeParse(buildSchedule(type, form));
    if (!parsed.success) {
      setFormError(parsed.error.issues[0]?.message ?? "Check the times (HH:MM)");
      return;
    }
    setFormError(undefined);
    create.mutate(
      { schedule: parsed.data, title: form.title, ...(toolId ? { toolId } : {}) },
      { onSuccess: () => setAdding(false) },
    );
  }

  function sendTest(id: string) {
    setTestResult(undefined);
    test.mutate(id, { onSuccess: (res) => setTestResult(describeTestResult(res)) });
  }

  return (
    <Screen testID="screen-reminders">
      <Heading hidden>Reminders</Heading>
      <ErrorText error={reminders.error ?? update.error ?? remove.error ?? test.error} />
      <View>
        <TableHead className={ROW_GAP}>
          <ColumnHead className={`flex-1 ${COL.reminder}`}>Reminder</ColumnHead>
          <ColumnHead className={COL.schedule}>Schedule</ColumnHead>
          <ColumnHead className={COL.opens}>Opens</ColumnHead>
          <ColumnHead className={COL.next} numeric>
            Next
          </ColumnHead>
          <View className={`hidden md:flex ${COL.controls}`} />
        </TableHead>
        {reminders.isPending ? <TableNote>Loading…</TableNote> : null}
        {reminders.data?.items.length === 0 ? <TableNote>No reminders yet</TableNote> : null}
        {reminders.data?.items.map((r) => (
          <ReminderRow
            key={r.id}
            reminder={r}
            opens={opens(r.toolId)}
            testing={test.isPending && test.variables === r.id}
            onToggle={(enabled) => update.mutate({ id: r.id, body: { enabled } })}
            onTest={() => sendTest(r.id)}
            onDelete={() => remove.mutate(r.id)}
          />
        ))}
        {adding ? null : <TableAction label="New reminder" onPress={() => setAdding(true)} />}
      </View>
      {testResult ? <Body muted>{testResult}</Body> : null}

      {adding ? (
        <View className="gap-3">
          <Heading level={2}>New reminder</Heading>
          <View className="w-full max-w-[640px] gap-3 px-2">
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
              <Segmented
                label="Opens quick log for"
                value={toolId}
                options={toolOptions}
                onChange={setToolId}
              />
            ) : null}
            {formError ? <Body className="text-alert">{formError}</Body> : null}
            <ErrorText error={create.error} />
            <View className="flex-row flex-wrap items-center gap-2">
              <Button label="Add reminder" busy={create.isPending} onPress={submit} testID="add-reminder" />
              <Button label="Cancel" variant="ghost" onPress={() => setAdding(false)} />
            </View>
          </View>
        </View>
      ) : null}
    </Screen>
  );
}

/**
 * One reminder. Nothing to open, so the row is not a link: its controls (enabled, send test, delete) sit at the
 * right on wide screens and on their own line under the reminder on a phone.
 */
function ReminderRow(props: {
  reminder: Reminder;
  opens: { target?: string; tool: string };
  testing: boolean;
  onToggle: (enabled: boolean) => void;
  onTest: () => void;
  onDelete: () => void;
}) {
  const r = props.reminder;
  const schedule = describeSchedule(r.schedule);
  const opens = props.opens.target ? `${props.opens.target} · ${props.opens.tool}` : props.opens.tool;
  return (
    <View
      testID="reminder-card"
      className={`border-b border-rule px-2 pt-1 md:flex-row md:items-center md:py-1 ${ROW_GAP}`}
    >
      <View className={COL.reminder}>
        <Text className="text-caption text-ink">{r.title}</Text>
        <View className="md:hidden">
          <Text className="text-caption text-dim">
            {schedule} · {r.timezone}
          </Text>
        </View>
        <View className="lg:hidden">
          <Text className="text-caption text-dim">
            {r.nextFireAt ? `next ${nextLabel(r)}` : "not scheduled"}
            {r.toolId ? ` · opens ${opens}` : ""}
          </Text>
        </View>
      </View>
      <View className={COL.schedule}>
        <Text className="text-caption text-ink">{schedule}</Text>
        <Text className="text-caption text-dim">{r.timezone}</Text>
      </View>
      <View className={COL.opens}>
        {props.opens.target ? (
          <>
            <Text className="text-caption text-ink" numberOfLines={2}>
              {props.opens.target}
            </Text>
            <Text className="text-caption text-dim" numberOfLines={1}>
              {props.opens.tool}
            </Text>
          </>
        ) : (
          <Text className="text-caption text-ink">{props.opens.tool}</Text>
        )}
      </View>
      <View className={COL.next}>
        <Text className="text-right text-caption tabular-nums text-ink">{nextLabel(r)}</Text>
      </View>
      <View className={`flex-row flex-wrap items-center gap-2 md:justify-end ${COL.controls}`}>
        <Toggle label="Enabled" value={r.enabled} onChange={props.onToggle} />
        <Button label="Send test" variant="ghost" compact busy={props.testing} onPress={props.onTest} />
        <RowAction destructive label="Delete" onPress={props.onDelete} />
      </View>
    </View>
  );
}
