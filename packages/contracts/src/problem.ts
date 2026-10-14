import { z } from "zod";

/** Stable machine-readable error codes carried in RFC 9457 problem responses. */
export const problemCodes = [
  "validation_failed",
  "unauthenticated",
  "forbidden",
  "insufficient_scope",
  "not_found",
  "conflict",
  "rate_limited",
  "unknown_tool_type",
  "internal_error",
] as const;
export const problemCodeSchema = z.enum(problemCodes);
export type ProblemCode = z.infer<typeof problemCodeSchema>;

export const problemSchema = z
  .object({
    type: z.string(),
    title: z.string(),
    status: z.number().int(),
    code: problemCodeSchema,
    detail: z.string().optional(),
    instance: z.string().optional(),
    errors: z.array(z.object({ path: z.string(), message: z.string() })).optional(),
  })
  .meta({ id: "Problem", description: "RFC 9457 problem details" });
export type Problem = z.infer<typeof problemSchema>;
