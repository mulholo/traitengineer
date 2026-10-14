import type { OpenAPIHono } from "@hono/zod-openapi";
import {
  createdPersonalAccessTokenSchema,
  createPersonalAccessTokenSchema,
  personalAccessTokenSchema,
} from "@te/contracts";
import { DomainError, type Services } from "@te/core";
import { z } from "zod";
import { idParams, json, jsonBody, noContent, route } from "../http/openapi.ts";
import { userIdOf, type AppEnv } from "../http/types.ts";

const tag = "Personal access tokens";

export function registerTokenRoutes(app: OpenAPIHono<AppEnv>, s: Services) {
  app.openapi(
    route(tag, {
      method: "get",
      path: "/v1/tokens",
      summary: "List personal access tokens (never includes the token value)",
      responses: { 200: json(z.object({ items: z.array(personalAccessTokenSchema) }), "Tokens") },
    }),
    async (c) => c.json({ items: await s.tokens.list(userIdOf(c)) }, 200),
  );

  app.openapi(
    route(tag, {
      method: "post",
      path: "/v1/tokens",
      summary: "Create a personal access token",
      description:
        "The plaintext `token` is returned once. Tokens cannot create other tokens; use a signed-in session.",
      request: { body: jsonBody(createPersonalAccessTokenSchema) },
      responses: { 201: json(createdPersonalAccessTokenSchema, "Created; store the token now") },
    }),
    async (c) => {
      if (c.var.principal?.via !== "session")
        throw new DomainError("forbidden", "Create tokens from a signed-in session");
      return c.json(await s.tokens.create(userIdOf(c), c.req.valid("json")), 201);
    },
  );

  app.openapi(
    route(tag, {
      method: "delete",
      path: "/v1/tokens/{id}",
      summary: "Revoke a personal access token",
      request: { params: idParams },
      responses: noContent,
    }),
    async (c) => {
      await s.tokens.revoke(userIdOf(c), c.req.valid("param").id);
      return c.body(null, 204);
    },
  );
}
