import type { OpenAPIHono } from "@hono/zod-openapi";
import {
  createEntrySchema,
  entrySchema,
  listEntriesQuerySchema,
  pageSchema,
  updateEntrySchema,
} from "@te/contracts";
import type { Services } from "@te/core";
import { idParams, json, jsonBody, noContent, route } from "../http/openapi.ts";
import { userIdOf, type AppEnv } from "../http/types.ts";

const tag = "Entries";

export function registerEntryRoutes(app: OpenAPIHono<AppEnv>, s: Services) {
  app.openapi(
    route(tag, {
      method: "get",
      path: "/v1/entries",
      summary: "List entries, newest first",
      request: { query: listEntriesQuerySchema },
      responses: { 200: json(pageSchema(entrySchema), "A page of entries") },
    }),
    async (c) => c.json(await s.entries.list(userIdOf(c), c.req.valid("query")), 200),
  );

  app.openapi(
    route(tag, {
      method: "post",
      path: "/v1/entries",
      summary: "Log an entry (idempotent on clientId)",
      description:
        "`payload` is validated against the tool type's payload schema. Repeating a request with the same `clientId` " +
        "returns the existing entry with status 200 instead of creating a duplicate.",
      request: { body: jsonBody(createEntrySchema) },
      responses: {
        201: json(entrySchema, "Created"),
        200: json(entrySchema, "Already existed (same clientId)"),
      },
    }),
    async (c) => {
      const { entry, created } = await s.entries.create(userIdOf(c), c.req.valid("json"));
      return created ? c.json(entry, 201) : c.json(entry, 200);
    },
  );

  app.openapi(
    route(tag, {
      method: "get",
      path: "/v1/entries/{id}",
      summary: "Get an entry",
      request: { params: idParams },
      responses: { 200: json(entrySchema, "The entry") },
    }),
    async (c) => c.json(await s.entries.get(userIdOf(c), c.req.valid("param").id), 200),
  );

  app.openapi(
    route(tag, {
      method: "patch",
      path: "/v1/entries/{id}",
      summary: "Update an entry (payload is merged and revalidated)",
      request: { params: idParams, body: jsonBody(updateEntrySchema) },
      responses: { 200: json(entrySchema, "Updated") },
    }),
    async (c) =>
      c.json(await s.entries.update(userIdOf(c), c.req.valid("param").id, c.req.valid("json")), 200),
  );

  app.openapi(
    route(tag, {
      method: "delete",
      path: "/v1/entries/{id}",
      summary: "Delete an entry (soft delete)",
      request: { params: idParams },
      responses: noContent,
    }),
    async (c) => {
      await s.entries.remove(userIdOf(c), c.req.valid("param").id);
      return c.body(null, 204);
    },
  );
}
