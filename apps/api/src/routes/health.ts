import { createRoute, type OpenAPIHono } from "@hono/zod-openapi";
import { z } from "zod";
import type { AppEnv } from "../http/types.ts";

const healthSchema = z
  .object({ status: z.enum(["ok", "degraded"]), db: z.enum(["ok", "error"]) })
  .meta({ id: "Health" });

export function registerHealthRoute(app: OpenAPIHono<AppEnv>, checkDb: () => Promise<boolean>) {
  app.openapi(
    createRoute({
      method: "get",
      path: "/health",
      tags: ["Health"],
      summary: "Liveness and database reachability (no auth)",
      responses: {
        200: { description: "Healthy", content: { "application/json": { schema: healthSchema } } },
        503: {
          description: "Database unreachable",
          content: { "application/json": { schema: healthSchema } },
        },
      },
    }),
    async (c) => {
      const ok = await checkDb().catch(() => false);
      return ok
        ? c.json({ status: "ok" as const, db: "ok" as const }, 200)
        : c.json({ status: "degraded" as const, db: "error" as const }, 503);
    },
  );
}
