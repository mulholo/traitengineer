import { z } from "zod";
import { idSchema, timeZoneSchema, timestampSchema } from "./common.ts";
import { scopeSchema } from "./token.ts";

export const meSchema = z
  .object({
    id: idSchema,
    email: z.string().meta({ description: "Owner's email (only returned to the authenticated owner)" }),
    timezone: z.string(),
    scopes: z.array(scopeSchema).meta({ description: "Scopes of the credential used for this request" }),
    createdAt: timestampSchema,
  })
  .meta({ id: "Me" });
export type Me = z.infer<typeof meSchema>;

export const updateMeSchema = z.object({ timezone: timeZoneSchema }).partial().meta({ id: "UpdateMe" });
export type UpdateMe = z.infer<typeof updateMeSchema>;
