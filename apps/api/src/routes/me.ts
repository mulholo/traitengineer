import type { OpenAPIHono } from "@hono/zod-openapi";
import { exportFormatSchema, exportSchema, meSchema, updateMeSchema, type Me } from "@te/contracts";
import { renderExportMarkdown, type Services, type User } from "@te/core";
import { z } from "zod";
import { json, jsonBody, route } from "../http/openapi.ts";
import { userIdOf, type AppEnv, type Principal } from "../http/types.ts";

function toMe(user: User, principal: Principal | undefined): Me {
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    timezone: user.timezone,
    scopes: principal?.scopes ?? [],
    createdAt: user.createdAt,
  };
}

export function registerMeRoutes(app: OpenAPIHono<AppEnv>, s: Services) {
  app.openapi(
    route("Me", {
      method: "get",
      path: "/v1/me",
      summary: "The signed-in user",
      responses: { 200: json(meSchema, "Current user") },
    }),
    async (c) => c.json(toMe(await s.users.get(userIdOf(c)), c.var.principal), 200),
  );

  app.openapi(
    route("Me", {
      method: "patch",
      path: "/v1/me",
      summary: "Update time zone or display name",
      request: { body: jsonBody(updateMeSchema) },
      responses: { 200: json(meSchema, "Updated") },
    }),
    async (c) => c.json(toMe(await s.users.update(userIdOf(c), c.req.valid("json")), c.var.principal), 200),
  );

  app.openapi(
    route("Export", {
      method: "get",
      path: "/v1/export",
      summary: "Export everything (JSON or Markdown)",
      request: { query: z.object({ format: exportFormatSchema.default("json") }) },
      responses: {
        200: {
          description: "Export",
          content: { "application/json": { schema: exportSchema }, "text/markdown": { schema: z.string() } },
        },
      },
    }),
    async (c) => {
      const data = await s.exports.exportAll(userIdOf(c));
      const stamp = data.exportedAt.slice(0, 10);
      if (c.req.valid("query").format === "markdown") {
        return c.body(renderExportMarkdown(data), 200, {
          "content-type": "text/markdown; charset=utf-8",
          "content-disposition": `attachment; filename="traitengineer-${stamp}.md"`,
        });
      }
      c.header("content-disposition", `attachment; filename="traitengineer-${stamp}.json"`);
      return c.json(data, 200);
    },
  );
}
