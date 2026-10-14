import { z } from "zod";
import { idSchema, pageQuerySchema, sourceSchema, timestampSchema } from "./common.ts";
import { toolTypeSchema } from "./tool-types/registry.ts";

export const entrySchema = z
  .object({
    id: idSchema,
    toolId: idSchema,
    changeTargetId: idSchema,
    toolType: toolTypeSchema,
    payload: z
      .record(z.string(), z.unknown())
      .meta({ description: "Validated by the tool type's payloadSchema" }),
    occurredAt: timestampSchema,
    source: sourceSchema,
    clientId: idSchema,
    createdAt: timestampSchema,
    updatedAt: timestampSchema,
  })
  .meta({ id: "Entry" });
export type Entry = z.infer<typeof entrySchema>;

export const createEntrySchema = z
  .object({
    toolId: idSchema,
    payload: z.record(z.string(), z.unknown()),
    occurredAt: timestampSchema.optional().meta({ description: "When it happened; defaults to now" }),
    source: sourceSchema.default("api"),
    clientId: idSchema.meta({
      description: "Client-generated UUID; repeating a create with the same clientId is safe",
    }),
  })
  .meta({ id: "CreateEntry" });
export type CreateEntry = z.input<typeof createEntrySchema>;

export const updateEntrySchema = z
  .object({
    payload: z.record(z.string(), z.unknown()),
    occurredAt: timestampSchema,
  })
  .partial()
  .meta({ id: "UpdateEntry" });
export type UpdateEntry = z.infer<typeof updateEntrySchema>;

export const listEntriesQuerySchema = pageQuerySchema.extend({
  changeTargetId: idSchema.optional(),
  toolId: idSchema.optional(),
  since: timestampSchema.optional(),
  until: timestampSchema.optional(),
  tag: z.string().min(1).max(50).optional(),
});
export type ListEntriesQuery = z.input<typeof listEntriesQuerySchema>;
