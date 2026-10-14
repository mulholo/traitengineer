import type { Scope } from "@te/contracts";
import { isPersonalAccessToken, type Services } from "@te/core";
import type { MiddlewareHandler } from "hono";
import type { Auth } from "../auth/better-auth.ts";
import type { Logger } from "../logger.ts";
import { problem } from "./problem.ts";
import type { AppEnv, Principal } from "./types.ts";

/** Attach a per-request child logger (request ID + user ID once known) and log one line per request. */
export function requestLogger(logger: Logger): MiddlewareHandler<AppEnv> {
  return async (c, next) => {
    const start = performance.now();
    const log = logger.child({ requestId: c.get("requestId") });
    c.set("log", log);
    await next();
    log.info(
      {
        method: c.req.method,
        path: c.req.path,
        status: c.res.status,
        ms: Math.round(performance.now() - start),
        userId: c.get("principal")?.userId,
      },
      "request",
    );
  };
}

function bearerToken(header: string | undefined): string | undefined {
  const match = header?.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim();
}

/** Resolve the caller from a personal access token or a Better Auth session (cookie or bearer). */
export async function resolvePrincipal(
  headers: Headers,
  deps: { auth: Auth; services: Services },
): Promise<Principal | undefined> {
  const token = bearerToken(headers.get("authorization") ?? undefined);
  if (token && isPersonalAccessToken(token)) {
    const pat = await deps.services.tokens.verify(token);
    return pat ? { userId: pat.userId, scopes: pat.scopes, via: "pat" } : undefined;
  }
  const session = await deps.auth.api.getSession({ headers });
  if (session) return { userId: session.user.id, scopes: ["read", "write"], via: "session" };
  return undefined;
}

export function authenticate(deps: { auth: Auth; services: Services }): MiddlewareHandler<AppEnv> {
  return async (c, next) => {
    const principal = await resolvePrincipal(c.req.raw.headers, deps);
    if (!principal) return problem(c, "unauthenticated", "Sign in or send a valid bearer token");
    c.set("principal", principal);
    return next();
  };
}

const WRITE_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

/** Reads need `read`; writes need `write`. */
export function requireScopes(): MiddlewareHandler<AppEnv> {
  return async (c, next) => {
    const needed: Scope = WRITE_METHODS.has(c.req.method) ? "write" : "read";
    const principal = c.get("principal");
    if (!principal?.scopes.includes(needed)) {
      return problem(c, "insufficient_scope", `This request needs the '${needed}' scope`);
    }
    return next();
  };
}

/** Simple in-memory per-user write limit (default 120/min) to catch runaway agents. */
export function writeRateLimit(opts: { perMinute: number; now?: () => number }): MiddlewareHandler<AppEnv> {
  const now = opts.now ?? Date.now;
  const hits = new Map<string, number[]>();
  return async (c, next) => {
    const userId = c.get("principal")?.userId;
    if (!userId || !WRITE_METHODS.has(c.req.method)) return next();
    const t = now();
    const recent = (hits.get(userId) ?? []).filter((ts) => t - ts < 60_000);
    if (recent.length >= opts.perMinute) {
      const retryAfter = Math.max(1, Math.ceil((60_000 - (t - (recent[0] ?? t))) / 1000));
      hits.set(userId, recent);
      return problem(c, "rate_limited", `More than ${opts.perMinute} writes per minute`, {
        headers: { "retry-after": String(retryAfter) },
      });
    }
    recent.push(t);
    hits.set(userId, recent);
    return next();
  };
}
