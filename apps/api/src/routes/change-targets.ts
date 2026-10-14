import type { OpenAPIHono } from "@hono/zod-openapi";
import {
  changeTargetSchema,
  changeTargetSummarySchema,
  createChangeTargetSchema,
  listChangeTargetsQuerySchema,
  pageSchema,
  updateChangeTargetSchema,
} from "@te/contracts";
import type { Services } from "@te/core";
import { z } from "zod";
import { idParams, json, jsonBody, route } from "../http/openapi.ts";
import { userIdOf, type AppEnv } from "../http/types.ts";

const tag = "Change targets";

export function registerChangeTargetRoutes(app: OpenAPIHono<AppEnv>, s: Services) {
  app.openapi(
    route(tag, {
      method: "get",
      path: "/v1/change-targets",
      summary: "List change targets",
      request: { query: listChangeTargetsQuerySchema },
      responses: { 200: json(pageSchema(changeTargetSchema), "A page of change targets") },
    }),
    async (c) => c.json(await s.changeTargets.list(userIdOf(c), c.req.valid("query")), 200),
  );

  app.openapi(
    route(tag, {
      method: "post",
      path: "/v1/change-targets",
      summary: "Create a change target",
      request: { body: jsonBody(createChangeTargetSchema) },
      responses: { 201: json(changeTargetSchema, "Created") },
    }),
    async (c) => c.json(await s.changeTargets.create(userIdOf(c), c.req.valid("json")), 201),
  );

  app.openapi(
    route(tag, {
      method: "get",
      path: "/v1/change-targets/{id}",
      summary: "Get a change target",
      request: { params: idParams },
      responses: { 200: json(changeTargetSchema, "The change target") },
    }),
    async (c) => c.json(await s.changeTargets.get(userIdOf(c), c.req.valid("param").id), 200),
  );

  app.openapi(
    route(tag, {
      method: "patch",
      path: "/v1/change-targets/{id}",
      summary: "Update a change target (partial)",
      request: { params: idParams, body: jsonBody(updateChangeTargetSchema) },
      responses: { 200: json(changeTargetSchema, "Updated") },
    }),
    async (c) =>
      c.json(await s.changeTargets.update(userIdOf(c), c.req.valid("param").id, c.req.valid("json")), 200),
  );

  app.openapi(
    route(tag, {
      method: "delete",
      path: "/v1/change-targets/{id}",
      summary: "Archive a change target",
      description: "Change targets are never hard-deleted: DELETE sets status to `archived`.",
      request: { params: idParams },
      responses: { 200: json(changeTargetSchema, "Archived") },
    }),
    async (c) => c.json(await s.changeTargets.archive(userIdOf(c), c.req.valid("param").id), 200),
  );

  app.openapi(
    route(tag, {
      method: "get",
      path: "/v1/change-targets/{id}/summary",
      summary: "Tool summaries and totals for a change target",
      request: {
        params: idParams,
        query: z.object({ weeks: z.coerce.number().int().min(1).max(52).optional() }),
      },
      responses: { 200: json(changeTargetSummarySchema, "Summary") },
    }),
    async (c) => {
      const { weeks } = c.req.valid("query");
      const summary = await s.summaries.forChangeTarget(
        userIdOf(c),
        c.req.valid("param").id,
        weeks ? { weeks } : {},
      );
      return c.json(summary, 200);
    },
  );
}
