import type { OpenAPIHono } from "@hono/zod-openapi";
import { meSchema, updateMeSchema, type Me } from "@te/contracts";
import { type Services, type User } from "@te/core";
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
}
