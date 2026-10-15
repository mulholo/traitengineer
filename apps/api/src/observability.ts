import * as Sentry from "@sentry/node";
import type { Env } from "./env.ts";

/** Something that records unexpected errors (Sentry in production when SENTRY_DSN is set; no-op otherwise). */
export type ErrorReporter = (
  err: unknown,
  context: { requestId?: string; userId?: string; path?: string },
) => void;

export const noopReporter: ErrorReporter = () => {};

/**
 * Initialise Sentry only when SENTRY_DSN is set. No PII (Sentry's default) and, belt and braces, no request
 * bodies, cookies or auth headers; users
 * are identified by ID only (never email).
 */
export function createErrorReporter(env: Pick<Env, "SENTRY_DSN" | "NODE_ENV">): ErrorReporter {
  if (!env.SENTRY_DSN) return noopReporter;
  Sentry.init({
    dsn: env.SENTRY_DSN,
    environment: env.NODE_ENV,
    tracesSampleRate: 0,
    beforeSend(event) {
      if (event.request) {
        delete event.request.cookies;
        delete event.request.data;
        if (event.request.headers) {
          delete event.request.headers["authorization"];
          delete event.request.headers["cookie"];
        }
      }
      return event;
    },
  });
  return (err, context) => {
    Sentry.withScope((scope) => {
      if (context.userId) scope.setUser({ id: context.userId });
      if (context.requestId) scope.setTag("requestId", context.requestId);
      if (context.path) scope.setTag("path", context.path);
      Sentry.captureException(err);
    });
  };
}
