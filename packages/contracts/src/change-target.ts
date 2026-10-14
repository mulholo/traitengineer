import { z } from "zod";
import { idSchema, pageQuerySchema, timestampSchema } from "./common.ts";

export const changeTargetStatusSchema = z.enum(["active", "paused", "achieved", "archived"]);
export type ChangeTargetStatus = z.infer<typeof changeTargetStatusSchema>;

const fields = {
  title: z.string().trim().min(1).max(120).meta({ example: "Default to action rather than over-planning" }),
  oldPattern: z.string().trim().max(5000).meta({ example: "Rewrite proposals three times before sending" }),
  desiredDefault: z.string().trim().max(5000).meta({ example: "Send the first good-enough version" }),
  why: z.string().trim().max(5000).meta({ example: "Momentum matters more than polish for me" }),
};

export const changeTargetSchema = z
  .object({
    id: idSchema,
    ...fields,
    status: changeTargetStatusSchema,
    sortOrder: z.number().int(),
    archivedAt: timestampSchema.nullable(),
    createdAt: timestampSchema,
    updatedAt: timestampSchema,
  })
  .meta({ id: "ChangeTarget" });
export type ChangeTarget = z.infer<typeof changeTargetSchema>;

export const createChangeTargetSchema = z
  .object({
    title: fields.title,
    oldPattern: fields.oldPattern.default(""),
    desiredDefault: fields.desiredDefault.default(""),
    why: fields.why.default(""),
    status: changeTargetStatusSchema.exclude(["archived"]).default("active"),
    sortOrder: z.number().int().optional(),
  })
  .meta({ id: "CreateChangeTarget" });
export type CreateChangeTarget = z.input<typeof createChangeTargetSchema>;

export const updateChangeTargetSchema = z
  .object({
    title: fields.title,
    oldPattern: fields.oldPattern,
    desiredDefault: fields.desiredDefault,
    why: fields.why,
    status: changeTargetStatusSchema,
    sortOrder: z.number().int(),
  })
  .partial()
  .meta({ id: "UpdateChangeTarget" });
export type UpdateChangeTarget = z.infer<typeof updateChangeTargetSchema>;

export const listChangeTargetsQuerySchema = pageQuerySchema.extend({
  status: changeTargetStatusSchema.optional(),
});
export type ListChangeTargetsQuery = z.input<typeof listChangeTargetsQuerySchema>;
