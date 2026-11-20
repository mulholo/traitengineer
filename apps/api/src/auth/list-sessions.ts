import type { BetterAuthPlugin } from "better-auth";
import { createAuthEndpoint, sessionMiddleware } from "better-auth/api";
import { parseSessionOutput } from "better-auth/db";

/**
 * Better Auth guards `GET /list-sessions` with its freshness check (`session.freshAge`, one day since sign-in),
 * so with 30-day rolling sessions the Settings list fails with "Session is not fresh" a day after signing in.
 * Seeing your own sessions is not sensitive (and is how you spot one to revoke), so this plugin replaces the
 * endpoint (plugins override core endpoints by key) with the same handler behind the plain session check.
 * Freshness still guards what it should: registering a passkey and unlinking an account.
 */
export function listSessionsWithoutFreshness() {
  return {
    id: "te-list-sessions",
    endpoints: {
      listSessions: createAuthEndpoint(
        "/list-sessions",
        { method: "GET", use: [sessionMiddleware], requireHeaders: true },
        async (ctx) => {
          const now = new Date();
          const sessions = await ctx.context.internalAdapter.listSessions(ctx.context.session.user.id, {
            onlyActiveSessions: true,
          });
          return ctx.json(
            sessions.filter((s) => s.expiresAt > now).map((s) => parseSessionOutput(ctx.context.options, s)),
          );
        },
      ),
    },
  } satisfies BetterAuthPlugin;
}
