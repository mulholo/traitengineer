import type { Scope } from "@te/contracts";
import type { Logger } from "../logger.ts";

export interface Principal {
  userId: string;
  scopes: Scope[];
  via: "session" | "pat" | "oauth";
}

export interface AppEnv {
  Variables: {
    requestId: string;
    log: Logger;
    principal: Principal | undefined;
  };
}

/** The authenticated user's ID. Routes behind `authenticate()` always have one; throw if wiring is wrong. */
export function userIdOf(c: { get(key: "principal"): Principal | undefined }): string {
  const principal = c.get("principal");
  if (!principal) throw new Error("route reached without an authenticated principal");
  return principal.userId;
}
