import { z } from "zod";
import { idSchema, timestampSchema } from "./common.ts";
import { changeTargetStatusSchema } from "./change-target.ts";
import { toolSummarySchema } from "./tool-types/registry.ts";

export const progressQuerySchema = z.object({
  changeTargetId: idSchema.optional().meta({ description: "One target; default is every active target" }),
  since: timestampSchema.optional().meta({ description: "Start of the period; default is 28 days ago" }),
});
export type ProgressQuery = z.input<typeof progressQuerySchema>;

export const progressSummarySchema = z
  .object({
    since: timestampSchema,
    until: timestampSchema,
    timeZone: z.string(),
    targets: z.array(
      z.object({
        changeTargetId: idSchema,
        title: z.string(),
        status: changeTargetStatusSchema,
        oldPattern: z.string(),
        desiredDefault: z.string(),
        entriesInPeriod: z.number().int(),
        daysSinceLastEntry: z.number().int().nullable(),
        tools: z.array(toolSummarySchema),
        recentEntries: z
          .array(
            z.object({
              entryId: idSchema,
              occurredAt: timestampSchema,
              toolName: z.string(),
              words: z
                .record(z.string(), z.unknown())
                .meta({ description: "The user's own words (the entry payload)" }),
            }),
          )
          .meta({ description: "Up to 20 most recent entries in the period, newest first" }),
      }),
    ),
  })
  .meta({ id: "ProgressSummary" });
export type ProgressSummary = z.infer<typeof progressSummarySchema>;
