import { updateMeSchema, type UpdateMe } from "@te/contracts";
import { NotFoundError } from "../errors.ts";
import type { User } from "../repositories.ts";
import { compact, parseOrThrow } from "../validate.ts";
import type { ServiceDeps } from "./context.ts";

export type UserService = ReturnType<typeof createUserService>;

export function createUserService({ repos }: ServiceDeps) {
  return {
    async get(userId: string): Promise<User> {
      const user = await repos.users.get(userId);
      if (!user) throw new NotFoundError("User", userId);
      return user;
    },
    async update(userId: string, input: UpdateMe): Promise<User> {
      const patch = compact(parseOrThrow(updateMeSchema, input, "profile"));
      const user = await repos.users.update(userId, patch);
      if (!user) throw new NotFoundError("User", userId);
      return user;
    },
  };
}
