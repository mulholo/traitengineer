import type { OpenAPIHono } from "@hono/zod-openapi";
import { createReminderSchema, reminderSchema, updateReminderSchema } from "@te/contracts";
import type { Services } from "@te/core";
import { z } from "zod";
import { idParams, json, jsonBody, noContent, route } from "../http/openapi.ts";
import { userIdOf, type AppEnv } from "../http/types.ts";

const tag = "Reminders";

export function registerReminderRoutes(app: OpenAPIHono<AppEnv>, s: Services) {
  app.openapi(
    route(tag, {
      method: "get",
      path: "/v1/reminders",
      summary: "List reminders",
      responses: { 200: json(z.object({ items: z.array(reminderSchema) }), "All reminders") },
    }),
    async (c) => c.json({ items: await s.reminders.list(userIdOf(c)) }, 200),
  );

  app.openapi(
    route(tag, {
      method: "post",
      path: "/v1/reminders",
      summary: "Create a reminder from a schedule preset",
      request: { body: jsonBody(createReminderSchema) },
      responses: { 201: json(reminderSchema, "Created") },
    }),
    async (c) => c.json(await s.reminders.create(userIdOf(c), c.req.valid("json")), 201),
  );

  app.openapi(
    route(tag, {
      method: "patch",
      path: "/v1/reminders/{id}",
      summary: "Update a reminder (recomputes the next fire time)",
      request: { params: idParams, body: jsonBody(updateReminderSchema) },
      responses: { 200: json(reminderSchema, "Updated") },
    }),
    async (c) =>
      c.json(await s.reminders.update(userIdOf(c), c.req.valid("param").id, c.req.valid("json")), 200),
  );

  app.openapi(
    route(tag, {
      method: "delete",
      path: "/v1/reminders/{id}",
      summary: "Delete a reminder",
      request: { params: idParams },
      responses: noContent,
    }),
    async (c) => {
      await s.reminders.remove(userIdOf(c), c.req.valid("param").id);
      return c.body(null, 204);
    },
  );

  app.openapi(
    route(tag, {
      method: "post",
      path: "/v1/reminders/{id}/test",
      summary: "Send this reminder to all active devices now",
      request: { params: idParams },
      responses: { 200: json(z.object({ devices: z.number().int() }), "Number of devices notified") },
    }),
    async (c) => c.json(await s.reminders.sendTest(userIdOf(c), c.req.valid("param").id), 200),
  );
}
