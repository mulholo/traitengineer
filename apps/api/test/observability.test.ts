import { DomainError } from "@te/core";
import { OpenAPIHono } from "@hono/zod-openapi";
import { expect, test } from "vitest";
import { createOnError } from "../src/http/problem.ts";
import type { AppEnv } from "../src/http/types.ts";
import { createErrorReporter, noopReporter } from "../src/observability.ts";

test("unexpected errors are reported with request and user IDs; domain errors are not", async () => {
  const reports: { err: unknown; ctx: Record<string, unknown> }[] = [];
  const app = new OpenAPIHono<AppEnv>();
  app.use(async (c, next) => {
    c.set("requestId", "req-1");
    c.set("principal", { userId: "user-1", scopes: ["read"], via: "pat" });
    await next();
  });
  app.onError(createOnError((err, ctx) => reports.push({ err, ctx })));
  app.get("/boom", () => {
    throw new Error("kaboom");
  });
  app.get("/missing", () => {
    throw new DomainError("not_found", "nope");
  });

  const boom = await app.request("/boom");
  expect(boom.status).toBe(500);
  expect(await boom.text()).not.toContain("kaboom"); // no internals leak to clients
  expect(reports).toHaveLength(1);
  expect(reports[0]?.ctx).toEqual({ path: "/boom", userId: "user-1", requestId: "req-1" });

  expect((await app.request("/missing")).status).toBe(404);
  expect(reports).toHaveLength(1);
});

test("Sentry stays off without a DSN", () => {
  expect(createErrorReporter({ SENTRY_DSN: undefined, NODE_ENV: "production" })).toBe(noopReporter);
});
