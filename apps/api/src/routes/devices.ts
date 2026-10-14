import type { OpenAPIHono } from "@hono/zod-openapi";
import { deviceSchema, registerDeviceSchema } from "@te/contracts";
import type { Services } from "@te/core";
import { z } from "zod";
import { idParams, json, jsonBody, noContent, route } from "../http/openapi.ts";
import { userIdOf, type AppEnv } from "../http/types.ts";

const tag = "Devices";

export function registerDeviceRoutes(app: OpenAPIHono<AppEnv>, s: Services) {
  app.openapi(
    route(tag, {
      method: "get",
      path: "/v1/devices",
      summary: "List push devices",
      responses: { 200: json(z.object({ items: z.array(deviceSchema) }), "Devices") },
    }),
    async (c) => c.json({ items: await s.devices.list(userIdOf(c)) }, 200),
  );

  app.openapi(
    route(tag, {
      method: "post",
      path: "/v1/devices",
      summary: "Register or refresh a push device (upsert by Expo push token)",
      request: { body: jsonBody(registerDeviceSchema) },
      responses: { 200: json(deviceSchema, "Registered") },
    }),
    async (c) => c.json(await s.devices.register(userIdOf(c), c.req.valid("json")), 200),
  );

  app.openapi(
    route(tag, {
      method: "delete",
      path: "/v1/devices/{id}",
      summary: "Stop sending pushes to a device",
      request: { params: idParams },
      responses: noContent,
    }),
    async (c) => {
      await s.devices.remove(userIdOf(c), c.req.valid("param").id);
      return c.body(null, 204);
    },
  );
}
