import { z } from "zod";
import { timestampSchema } from "./common.ts";
import { changeTargetSchema } from "./change-target.ts";
import { entrySchema } from "./entry.ts";
import { reminderSchema } from "./reminder.ts";
import { toolSchema } from "./tool.ts";

export const exportFormatSchema = z.enum(["json", "markdown"]);

export const exportSchema = z
  .object({
    version: z.literal(1),
    exportedAt: timestampSchema,
    user: z.object({ id: z.string(), displayName: z.string(), timezone: z.string() }),
    changeTargets: z.array(changeTargetSchema),
    tools: z.array(toolSchema),
    entries: z.array(entrySchema),
    reminders: z.array(reminderSchema),
  })
  .meta({ id: "Export", description: "Everything for the user. Never includes credentials or the email." });
export type Export = z.infer<typeof exportSchema>;
