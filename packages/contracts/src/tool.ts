import { z } from "zod";
import { idSchema, pageQuerySchema, timestampSchema } from "./common.ts";
import { toolTypeSchema } from "./tool-types/registry.ts";

export const toolSchema = z
  .object({
    id: idSchema,
    changeTargetId: idSchema,
    type: toolTypeSchema,
    name: z.string(),
    config: z
      .record(z.string(), z.unknown())
      .meta({ description: "Validated by the tool type's configSchema" }),
    sortOrder: z.number().int(),
    createdAt: timestampSchema,
    updatedAt: timestampSchema,
  })
  .meta({ id: "Tool" });
export type Tool = z.infer<typeof toolSchema>;

const nameSchema = z.string().trim().min(1).max(120);

export const createToolSchema = z
  .object({
    changeTargetId: idSchema,
    type: toolTypeSchema,
    name: nameSchema.optional().meta({ description: "Defaults to the tool type's display name" }),
    config: z.record(z.string(), z.unknown()).optional(),
    sortOrder: z.number().int().optional(),
  })
  .meta({ id: "CreateTool" });
export type CreateTool = z.input<typeof createToolSchema>;

export const updateToolSchema = z
  .object({
    name: nameSchema,
    config: z.record(z.string(), z.unknown()),
    sortOrder: z.number().int(),
  })
  .partial()
  .meta({ id: "UpdateTool" });
export type UpdateTool = z.infer<typeof updateToolSchema>;

export const listToolsQuerySchema = pageQuerySchema.extend({ changeTargetId: idSchema.optional() });
export type ListToolsQuery = z.input<typeof listToolsQuerySchema>;
