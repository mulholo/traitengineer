# 0027. MCP OAuth with Better Auth's `mcp()` plugin

- Status: accepted
- Date: 2026-10-14

## Context

The spec asks for Better Auth's OAuth/OIDC provider "or its MCP plugin, whichever the current docs recommend",
with dynamic client registration, PKCE, the two well-known documents, a 401 + `WWW-Authenticate` on `/mcp`,
and `read` / `write` scopes.

## Decision

- Use `@better-auth/mcp` (`mcp()`), which the current docs recommend: it is the OAuth 2.1 provider configured for
  MCP (tokens audience-bound to `${PUBLIC_URL}/mcp`, RFC 9728 protected-resource metadata served automatically).
  It requires `jwt()` for signing keys (`/api/auth/jwks`). New tables: `jwks` and `oauth_*` (migration 0002).
- Scopes: `read`, `write` (TE scopes; `write` implies `read`) plus `openid`, `profile`, `offline_access`.
- Dynamic client registration is enabled, including unauthenticated registration (public clients such as Claude
  register themselves). Registered clients have no owner, so `oauth_clients.user_id` is nullable. Registration
  alone grants nothing: tokens still need the owner to sign in and consent.
- PKCE (S256) is required by the provider for public clients.
- Login and consent pages are web routes `/sign-in` and `/consent` in the Expo web app (M4). The consent screen
  lists the requested scopes.
- `/mcp` verifies OAuth JWTs locally with `jose` against `auth.api.getJwks()` (issuer `${PUBLIC_URL}/api/auth`,
  audience `${PUBLIC_URL}/mcp`), avoiding an HTTP round-trip to ourselves, and also accepts personal access tokens.
  `jose` is already a transitive dependency of `@better-auth/mcp`.
- Client ID Metadata Documents (`@better-auth/cimd`) are not enabled yet; DCR is what the spec asks for and what
  Claude supports. Revisit if Claude drops DCR.

## Alternatives considered

- `oauthProvider()` directly: `mcp()` is a thin, MCP-specific configuration of it; using it directly would mean
  re-implementing resource binding and protected-resource metadata.
- `requireMcpAuth()`: fetches the JWKS over HTTP from our own base URL and does not accept PATs.
