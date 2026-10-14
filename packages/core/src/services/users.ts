import { timeZoneSchema } from "@te/contracts";
import { z } from "zod";
import { NotFoundError } from "../errors.ts";
import type { User } from "../repositories.ts";
import { compact, parseOrThrow } from "../validate.ts";
import type { ServiceDeps } from "./context.ts";

export const updateMeSchema = z
  .object({ timezone: timeZoneSchema, displayName: z.string().trim().min(1).max(80) })
  .partial();

export type UserService = ReturnType<typeof createUserService>;

export function createUserService({ repos }: ServiceDeps) {
  return {
    async get(userId: string): Promise<User> {
      const user = await repos.users.get(userId);
      if (!user) throw new NotFoundError("User", userId);
      return user;
    },
    async update(userId: string, input: z.input<typeof updateMeSchema>): Promise<User> {
      const patch = compact(parseOrThrow(updateMeSchema, input, "profile"));
      const user = await repos.users.update(userId, patch);
      if (!user) throw new NotFoundError("User", userId);
      return user;
    },
  };
}
