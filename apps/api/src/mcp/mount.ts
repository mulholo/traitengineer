import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import type { Scope } from "@te/contracts";
import { isPersonalAccessToken, type Services } from "@te/core";
import { createMcpServer, type McpPrincipal } from "@te/mcp";
import type { Hono } from "hono";
import { createLocalJWKSet, jwtVerify, type JSONWebKeySet } from "jose";
import { mcpResource, type Auth } from "../auth/better-auth.ts";
import type { Env } from "../env.ts";
import type { AppEnv } from "../http/types.ts";

export function oauthIssuer(env: Pick<Env, "PUBLIC_URL">): string {
  return `${env.PUBLIC_URL.replace(/\/$/, "")}/api/auth`;
}

export function protectedResourceMetadataUrl(env: Pick<Env, "PUBLIC_URL">): string {
  return `${env.PUBLIC_URL.replace(/\/$/, "")}/.well-known/oauth-protected-resource/mcp`;
}

/** Map OAuth scopes to TE scopes; `write` implies `read`. */
export function toTeScopes(granted: Iterable<string>): Scope[] {
  const set = new Set(granted);
  if (set.has("write")) return ["read", "write"];
  return set.has("read") ? ["read"] : [];
}

/**
 * Resolve the MCP caller from either a personal access token (`te_pat_...`) or an OAuth access token issued by
 * our own authorisation server. OAuth JWTs are verified locally against our JWKS (signature, issuer,
 * audience = the MCP resource, expiry).
 */
export async function resolveMcpPrincipal(
  request: Request,
  deps: { auth: Auth; services: Services; env: Env },
): Promise<McpPrincipal | undefined> {
  const token = request.headers
    .get("authorization")
    ?.match(/^Bearer\s+(.+)$/i)?.[1]
    ?.trim();
  if (!token) return undefined;
  if (isPersonalAccessToken(token)) {
    const pat = await deps.services.tokens.verify(token);
    return pat ? { userId: pat.userId, scopes: pat.scopes } : undefined;
  }
  try {
    const jwks = (await deps.auth.api.getJwks()) as JSONWebKeySet;
    const { payload } = await jwtVerify(token, createLocalJWKSet(jwks), {
      issuer: oauthIssuer(deps.env),
      audience: mcpResource(deps.env),
    });
    if (typeof payload.sub !== "string") return undefined;
    const scopes = toTeScopes(typeof payload["scope"] === "string" ? payload["scope"].split(" ") : []);
    if (scopes.length === 0) return undefined;
    return { userId: payload.sub, scopes };
  } catch {
    return undefined;
  }
}

/** Remote MCP server at /mcp: stateless Streamable HTTP with JSON responses, one server per request. */
export function mountMcp(
  app: Hono<AppEnv>,
  deps: { auth: Auth; services: Services; env: Env; now?: () => Date },
) {
  app.all("/mcp", async (c) => {
    const principal = await resolveMcpPrincipal(c.req.raw, deps);
    if (!principal) {
      return c.json(
        { jsonrpc: "2.0", error: { code: -32001, message: "Authentication required" }, id: null },
        401,
        {
          "WWW-Authenticate": `Bearer resource_metadata="${protectedResourceMetadataUrl(deps.env)}", scope="read write"`,
        },
      );
    }
    c.set("principal", { ...principal, via: "oauth" });
    const server = createMcpServer({
      services: deps.services,
      principal,
      ...(deps.now ? { now: deps.now } : {}),
    });
    // No sessionIdGenerator → stateless mode (no Mcp-Session-Id, no server-side session state).
    const transport = new WebStandardStreamableHTTPServerTransport({ enableJsonResponse: true });
    await server.connect(transport);
    try {
      return await transport.handleRequest(c.req.raw);
    } finally {
      await server.close();
    }
  });
}

/**
 * OAuth discovery. Better Auth serves RFC 9728 protected-resource metadata and RFC 8414 / OIDC metadata for
 * the issuer path; the bare `/.well-known/oauth-authorization-server` is aliased to it for clients that do not
 * insert the issuer path.
 */
export function mountWellKnown(app: Hono<AppEnv>, deps: { auth: Auth }) {
  app.get("/.well-known/oauth-authorization-server", (c) => {
    const url = new URL(c.req.url);
    url.pathname = "/.well-known/oauth-authorization-server/api/auth";
    return deps.auth.handler(new Request(url, { headers: c.req.raw.headers }));
  });
  app.get("/.well-known/*", (c) => deps.auth.handler(c.req.raw));
}
