import createClient, { type Middleware } from "openapi-fetch";
import type { components, paths } from "./generated/schema.ts";

export type { components, paths };
export type Schemas = components["schemas"];

export interface ApiClientOptions {
  /** Origin of the API, e.g. https://traitengineer.example.com (empty string = same origin on web). */
  baseUrl: string;
  /** Bearer token (session token on mobile, PAT for scripts). Omit on web to use the session cookie. */
  getToken?: () => string | null | undefined | Promise<string | null | undefined>;
  fetch?: typeof globalThis.fetch;
}

/** Typed client for the Trait Engineer REST API, generated from /openapi.json. */
export function createApiClient(opts: ApiClientOptions) {
  const client = createClient<paths>({
    baseUrl: opts.baseUrl,
    credentials: "include",
    ...(opts.fetch ? { fetch: opts.fetch } : {}),
  });
  const auth: Middleware = {
    async onRequest({ request }) {
      const token = await opts.getToken?.();
      if (token) request.headers.set("authorization", `Bearer ${token}`);
      return request;
    },
  };
  client.use(auth);
  return client;
}

export type ApiClient = ReturnType<typeof createApiClient>;

/** RFC 9457 problem body returned by every API error. */
export type Problem = components["schemas"]["Problem"];

export function isProblem(value: unknown): value is Problem {
  return (
    typeof value === "object" && value !== null && "code" in value && "status" in value && "title" in value
  );
}
