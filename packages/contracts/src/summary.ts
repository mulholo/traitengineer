import { z } from "zod";
import { idSchema, timestampSchema } from "./common.ts";
import { toolSummarySchema } from "./tool-types/registry.ts";

export const changeTargetSummarySchema = z
  .object({
    changeTargetId: idSchema,
    timeZone: z.string(),
    generatedAt: timestampSchema,
    totals: z.object({
      entries: z.number().int(),
      tools: z.number().int(),
      lastEntryAt: timestampSchema.nullable(),
      daysSinceLastEntry: z.number().int().nullable(),
    }),
    tools: z.array(toolSummarySchema),
  })
  .meta({ id: "ChangeTargetSummary" });
export type ChangeTargetSummary = z.infer<typeof changeTargetSummarySchema>;
