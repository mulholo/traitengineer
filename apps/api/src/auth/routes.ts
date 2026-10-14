import type { Services } from "@te/core";
import { loginKeys } from "@te/core";
import type { Context, Hono } from "hono";
import { problem } from "../http/problem.ts";
import type { AppEnv } from "../http/types.ts";
import type { Env } from "../env.ts";
import type { Auth } from "./better-auth.ts";

async function readJson(req: Request): Promise<Record<string, unknown>> {
  try {
    const body: unknown = await req.clone().json();
    return typeof body === "object" && body !== null ? (body as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

/** Only the configured proxy header is trusted (Fly-Client-IP in production); never X-Forwarded-For. */
function clientIp(c: Context, header: string): string {
  return c.req.header(header)?.split(",")[0]?.trim() || "unknown";
}

/**
 * Mount Better Auth at /api/auth with the single-owner rules from the spec:
 * - every sign-up route is 403 (except NODE_ENV=test),
 * - email sign-in is throttled per email and per IP with exponential backoff,
 * - password changes always revoke other sessions.
 */
export function mountAuth(app: Hono<AppEnv>, deps: { auth: Auth; services: Services; env: Env }) {
  const { auth, services, env } = deps;

  if (env.NODE_ENV !== "test") {
    app.all("/api/auth/sign-up/*", (c) => problem(c, "forbidden", "Sign-up is disabled"));
  }

  app.post("/api/auth/sign-in/email", async (c) => {
    const body = await readJson(c.req.raw);
    const keys = loginKeys(
      typeof body["email"] === "string" ? body["email"] : undefined,
      clientIp(c, env.CLIENT_IP_HEADER),
    );
    const wait = await services.loginThrottle.retryAfter(keys);
    if (wait > 0) {
      return problem(c, "rate_limited", "Too many sign-in attempts. Try again later.", {
        headers: { "retry-after": String(wait) },
      });
    }
    const res = await auth.handler(c.req.raw);
    if (res.status === 401) await services.loginThrottle.recordFailure(keys);
    else if (res.ok) await services.loginThrottle.recordSuccess(keys);
    return res;
  });

  app.post("/api/auth/change-password", async (c) => {
    const body = await readJson(c.req.raw);
    const headers = new Headers(c.req.raw.headers);
    headers.delete("content-length");
    const req = new Request(c.req.raw.url, {
      method: "POST",
      headers,
      body: JSON.stringify({ ...body, revokeOtherSessions: true }),
    });
    return auth.handler(req);
  });

  app.on(["GET", "POST"], "/api/auth/*", (c) => auth.handler(c.req.raw));
}

/** NODE_ENV=test only: `POST /api/test/session` returns a session token for a seeded user. */
export function mountTestSession(app: Hono<AppEnv>, deps: { auth: Auth }) {
  app.post("/api/test/session", async (c) => {
    const body = await readJson(c.req.raw);
    const email = (typeof body["email"] === "string" ? body["email"] : "owner@example.test").toLowerCase();
    const ctx = await deps.auth.$context;
    const existing = await ctx.internalAdapter.findUserByEmail(email);
    const user =
      existing?.user ??
      (await ctx.internalAdapter.createUser(
        { email, name: "Test owner", emailVerified: true },
        { method: "admin" },
      ));
    const session = await ctx.internalAdapter.createSession(user.id);
    return c.json({ userId: user.id, token: session.token });
  });
}
