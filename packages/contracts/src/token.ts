import { z } from "zod";
import { idSchema, timestampSchema } from "./common.ts";

export const scopeSchema = z.enum(["read", "write"]);
export type Scope = z.infer<typeof scopeSchema>;

export const personalAccessTokenSchema = z
  .object({
    id: idSchema,
    name: z.string(),
    scopes: z.array(scopeSchema),
    lastUsedAt: timestampSchema.nullable(),
    revokedAt: timestampSchema.nullable(),
    createdAt: timestampSchema,
  })
  .meta({ id: "PersonalAccessToken" });
export type PersonalAccessToken = z.infer<typeof personalAccessTokenSchema>;

export const createPersonalAccessTokenSchema = z
  .object({
    name: z.string().trim().min(1).max(100).meta({ example: "Claude Code on laptop" }),
    scope: scopeSchema.meta({ description: "`write` implies `read`" }),
  })
  .meta({ id: "CreatePersonalAccessToken" });
export type CreatePersonalAccessToken = z.input<typeof createPersonalAccessTokenSchema>;

export const createdPersonalAccessTokenSchema = personalAccessTokenSchema
  .extend({ token: z.string().meta({ description: "Plaintext token. Shown once; store it now." }) })
  .meta({ id: "CreatedPersonalAccessToken" });
export type CreatedPersonalAccessToken = z.infer<typeof createdPersonalAccessTokenSchema>;
