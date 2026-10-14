import { createRoute, type RouteConfig } from "@hono/zod-openapi";
import { idSchema, problemSchema } from "@te/contracts";
import { z } from "zod";

const problemContent = { "application/problem+json": { schema: problemSchema } };

/** Error responses every authenticated route can return. */
export const errorResponses = {
  400: { description: "Validation failed", content: problemContent },
  401: { description: "Not authenticated", content: problemContent },
  403: { description: "Insufficient scope", content: problemContent },
  404: { description: "Not found", content: problemContent },
  429: { description: "Rate limited", content: problemContent },
} as const;

export const json = <T extends z.ZodType>(schema: T, description: string) => ({
  description,
  content: { "application/json": { schema } },
});

export const jsonBody = <T extends z.ZodType>(schema: T) => ({
  required: true,
  content: { "application/json": { schema } },
});

export const idParams = z.object({ id: idSchema });

export const security = [{ Bearer: [] }, { Cookie: [] }];

/** createRoute with shared security + error responses and a tag. */
export function route<
  const R extends Omit<RouteConfig, "responses"> & { responses: RouteConfig["responses"] },
>(tag: string, config: R) {
  return createRoute({
    ...config,
    tags: [tag],
    security,
    responses: { ...errorResponses, ...config.responses },
  } as R & { tags: string[] });
}

export const noContent = { 204: { description: "Done" } } as const;
