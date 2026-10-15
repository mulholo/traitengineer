import {
  createReminderSchema,
  DEFAULT_TIME_ZONE,
  updateReminderSchema,
  type CreateReminder,
  type Reminder,
  type UpdateReminder,
} from "@te/contracts";
import { NotFoundError, ValidationError } from "../errors.ts";
import { LOG_CATEGORY, type PushSender } from "../push.ts";
import type { NewReminder, ReminderRecord } from "../repositories.ts";
import { nextOccurrence, rruleToSchedule, scheduleToRrule } from "../schedule.ts";
import { compact, parseOrThrow } from "../validate.ts";
import type { ServiceDeps } from "./context.ts";

export type ReminderService = ReturnType<typeof createReminderService>;

export function toReminder(r: ReminderRecord): Reminder {
  return { ...r, schedule: rruleToSchedule(r.rrule) };
}

/** Deep link that opens the quick-log sheet (or Today when the reminder has no tool). */
export function reminderUrl(r: Pick<ReminderRecord, "toolId">): string {
  return r.toolId ? `traitengineer://log/${r.toolId}` : "traitengineer://";
}

export function createReminderService({ repos, now }: ServiceDeps, push: PushSender) {
  async function checkLinks(
    userId: string,
    toolId: string | null | undefined,
    changeTargetId: string | null | undefined,
  ) {
    if (toolId) {
      const tool = await repos.tools.get(userId, toolId);
      if (!tool) throw new NotFoundError("Tool", toolId);
      if (changeTargetId && tool.changeTargetId !== changeTargetId) {
        throw new ValidationError("Tool does not belong to that change target", [
          { path: "toolId", message: "Mismatched change target" },
        ]);
      }
      return { toolId, changeTargetId: tool.changeTargetId };
    }
    if (changeTargetId && !(await repos.changeTargets.get(userId, changeTargetId))) {
      throw new NotFoundError("Change target", changeTargetId);
    }
    return { toolId: null, changeTargetId: changeTargetId ?? null };
  }

  function computeNext(r: Pick<NewReminder, "rrule" | "timezone" | "enabled">): string | null {
    return r.enabled ? (nextOccurrence(r.rrule, r.timezone, now())?.toISOString() ?? null) : null;
  }

  async function getRecord(userId: string, id: string): Promise<ReminderRecord> {
    const r = await repos.reminders.get(userId, id);
    if (!r) throw new NotFoundError("Reminder", id);
    return r;
  }

  return {
    async create(userId: string, input: CreateReminder): Promise<Reminder> {
      const data = parseOrThrow(createReminderSchema, input, "reminder");
      const links = await checkLinks(userId, data.toolId, data.changeTargetId);
      const timezone = data.timezone ?? (await repos.users.get(userId))?.timezone ?? DEFAULT_TIME_ZONE;
      const rrule = scheduleToRrule(data.schedule);
      const record = await repos.reminders.create(userId, {
        ...links,
        rrule,
        timezone,
        title: data.title,
        body: data.body,
        enabled: data.enabled,
        nextFireAt: computeNext({ rrule, timezone, enabled: data.enabled }),
      });
      return toReminder(record);
    },

    async list(userId: string): Promise<Reminder[]> {
      return (await repos.reminders.list(userId)).map(toReminder);
    },

    async get(userId: string, id: string): Promise<Reminder> {
      return toReminder(await getRecord(userId, id));
    },

    async update(userId: string, id: string, input: UpdateReminder): Promise<Reminder> {
      const patch = compact(parseOrThrow(updateReminderSchema, input, "reminder"));
      const current = await getRecord(userId, id);
      const { schedule, ...rest } = patch;
      const next: Partial<NewReminder> = { ...rest };
      if (patch.toolId !== undefined || patch.changeTargetId !== undefined) {
        const toolId = patch.toolId !== undefined ? patch.toolId : current.toolId;
        // With a tool, its change target is derived unless given explicitly; without one, keep the current target.
        const targetId =
          patch.changeTargetId !== undefined
            ? patch.changeTargetId
            : toolId
              ? undefined
              : current.changeTargetId;
        Object.assign(next, await checkLinks(userId, toolId, targetId));
      }
      if (schedule) next.rrule = scheduleToRrule(schedule);
      const merged = { ...current, ...next };
      next.nextFireAt = computeNext(merged);
      const updated = await repos.reminders.update(userId, id, next);
      if (!updated) throw new NotFoundError("Reminder", id);
      return toReminder(updated);
    },

    async remove(userId: string, id: string): Promise<void> {
      if (!(await repos.reminders.delete(userId, id))) throw new NotFoundError("Reminder", id);
    },

    /** Send this reminder to every active device now. Does not change its schedule. */
    async sendTest(userId: string, id: string): Promise<{ devices: number }> {
      const r = await getRecord(userId, id);
      const devices = (await repos.devices.list(userId)).filter((d) => d.disabledAt === null);
      if (devices.length > 0) {
        await push.send(
          devices.map((d) => ({
            to: d.expoPushToken,
            title: r.title,
            body: r.body,
            data: { url: reminderUrl(r), reminderId: r.id, test: true },
            categoryId: LOG_CATEGORY,
          })),
        );
      }
      return { devices: devices.length };
    },
  };
}
