import type { OpenAPIHono } from "@hono/zod-openapi";
import {
  createToolSchema,
  listToolsQuerySchema,
  pageSchema,
  toolSchema,
  updateToolSchema,
} from "@te/contracts";
import type { Services } from "@te/core";
import { idParams, json, jsonBody, noContent, route } from "../http/openapi.ts";
import { userIdOf, type AppEnv } from "../http/types.ts";

const tag = "Tools";

export function registerToolRoutes(app: OpenAPIHono<AppEnv>, s: Services) {
  app.openapi(
    route(tag, {
      method: "get",
      path: "/v1/tools",
      summary: "List tools",
      request: { query: listToolsQuerySchema },
      responses: { 200: json(pageSchema(toolSchema), "A page of tools") },
    }),
    async (c) => c.json(await s.tools.list(userIdOf(c), c.req.valid("query")), 200),
  );

  app.openapi(
    route(tag, {
      method: "post",
      path: "/v1/tools",
      summary: "Attach a tool to a change target",
      description: "`config` is validated against the tool type's config schema; unknown types are rejected.",
      request: { body: jsonBody(createToolSchema) },
      responses: { 201: json(toolSchema, "Created") },
    }),
    async (c) => c.json(await s.tools.create(userIdOf(c), c.req.valid("json")), 201),
  );

  app.openapi(
    route(tag, {
      method: "get",
      path: "/v1/tools/{id}",
      summary: "Get a tool",
      request: { params: idParams },
      responses: { 200: json(toolSchema, "The tool") },
    }),
    async (c) => c.json(await s.tools.get(userIdOf(c), c.req.valid("param").id), 200),
  );

  app.openapi(
    route(tag, {
      method: "patch",
      path: "/v1/tools/{id}",
      summary: "Update a tool (partial; config is merged and revalidated)",
      request: { params: idParams, body: jsonBody(updateToolSchema) },
      responses: { 200: json(toolSchema, "Updated") },
    }),
    async (c) => c.json(await s.tools.update(userIdOf(c), c.req.valid("param").id, c.req.valid("json")), 200),
  );

  app.openapi(
    route(tag, {
      method: "delete",
      path: "/v1/tools/{id}",
      summary: "Delete a tool (soft delete)",
      request: { params: idParams },
      responses: noContent,
    }),
    async (c) => {
      await s.tools.remove(userIdOf(c), c.req.valid("param").id);
      return c.body(null, 204);
    },
  );
}
