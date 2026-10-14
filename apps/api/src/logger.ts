import { pino, type Logger } from "pino";
import type { Env } from "./env.ts";

export type { Logger };

/** JSON logs. Never log emails, passwords, tokens or cookies: log the user ID instead. */
export function createLogger(env: Pick<Env, "LOG_LEVEL" | "NODE_ENV">): Logger {
  return pino({
    level: env.NODE_ENV === "test" ? "silent" : env.LOG_LEVEL,
    base: { service: "te-api" },
    redact: {
      paths: ["req.headers.authorization", "req.headers.cookie", "*.password", "*.email", "*.token"],
      censor: "[redacted]",
    },
  });
}
