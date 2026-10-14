import { z } from "zod";
import { idSchema, timeZoneSchema, timestampSchema } from "./common.ts";

const timeOfDay = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use 24-hour HH:MM")
  .meta({ example: "08:30" });

/** UI-facing schedule presets. They compile to an RFC 5545 RRULE server-side; raw rrules are never exposed in the UI. */
export const reminderScheduleSchema = z
  .discriminatedUnion("type", [
    z.object({ type: z.literal("daily"), time: timeOfDay }),
    z.object({ type: z.literal("weekdays"), time: timeOfDay }),
    z
      .object({
        type: z.literal("every_n_hours"),
        everyHours: z.number().int().min(1).max(12),
        start: timeOfDay,
        end: timeOfDay,
      })
      .refine((s) => s.start <= s.end, { message: "start must not be after end", path: ["end"] }),
  ])
  .meta({ id: "ReminderSchedule" });
export type ReminderSchedule = z.infer<typeof reminderScheduleSchema>;

export const reminderSchema = z
  .object({
    id: idSchema,
    toolId: idSchema.nullable(),
    changeTargetId: idSchema.nullable(),
    schedule: reminderScheduleSchema,
    rrule: z.string().meta({ description: "RFC 5545 RRULE compiled from the schedule (read-only)" }),
    timezone: z.string(),
    title: z.string(),
    body: z.string(),
    enabled: z.boolean(),
    nextFireAt: timestampSchema.nullable(),
    lastFiredAt: timestampSchema.nullable(),
    createdAt: timestampSchema,
    updatedAt: timestampSchema,
  })
  .meta({ id: "Reminder" });
export type Reminder = z.infer<typeof reminderSchema>;

export const createReminderSchema = z
  .object({
    toolId: idSchema.nullable().optional(),
    changeTargetId: idSchema.nullable().optional(),
    schedule: reminderScheduleSchema,
    timezone: timeZoneSchema.optional().meta({ description: "Defaults to the user's time zone" }),
    title: z.string().trim().min(1).max(100).default("Time to log some evidence"),
    body: z.string().trim().max(300).default(""),
    enabled: z.boolean().default(true),
  })
  .meta({ id: "CreateReminder" });
export type CreateReminder = z.input<typeof createReminderSchema>;

export const updateReminderSchema = z
  .object({
    schedule: reminderScheduleSchema,
    timezone: timeZoneSchema,
    title: z.string().trim().min(1).max(100),
    body: z.string().trim().max(300),
    enabled: z.boolean(),
    toolId: idSchema.nullable(),
    changeTargetId: idSchema.nullable(),
  })
  .partial()
  .meta({ id: "UpdateReminder" });
export type UpdateReminder = z.infer<typeof updateReminderSchema>;
