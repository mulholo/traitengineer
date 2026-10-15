# @te/api

Hono server and composition root: `/v1` REST, `/mcp`, `/api/auth` (Better Auth), `/openapi.json`, `/docs`,
`/health`, `/.well-known/*`, static web build with SPA fallback (M4), and the pg-boss worker (M5).

- **Entrypoint:** `src/main.ts`; `ROLE=web|worker|all` (default `all`). `pnpm --filter @te/api dev` runs it with
  `--watch`, reading the repo-root `.env`. Local DB is PGlite in `.pglite/` unless `DATABASE_URL` is set.
- **Composition:** `src/container.ts` (`createContainerFromHandle`) wires db → core services → Better Auth → app.
- **Auth:** `src/auth/better-auth.ts` (config incl. passkeys, bearer, Expo, `jwt()` + `mcp()` OAuth provider),
  `src/auth/routes.ts` (sign-up block, sign-in throttle, forced session revocation on password change, test-only
  session route), `src/auth/owner.ts` (owner bootstrap). `src/http/middleware.ts` resolves REST callers from a
  PAT (`te_pat_...`), a session bearer token or a cookie, then enforces scopes (GET → `read`, writes → `write`)
  and the per-user write rate limit.
- **MCP:** `src/mcp/mount.ts` mounts `@te/mcp` on `/mcp` (stateless Streamable HTTP, JSON responses, one server
  per request) and the `/.well-known/*` OAuth discovery routes. Callers authenticate with a PAT or an OAuth
  access token verified locally against our JWKS (issuer `${PUBLIC_URL}/api/auth`, audience `${PUBLIC_URL}/mcp`).
- **Jobs:** `src/jobs/worker.ts` starts pg-boss (Postgres via `DATABASE_URL_DIRECT` in production, PGlite
  locally) when `ROLE=worker|all`, and schedules `reminders.dispatch` (every minute) and `push.receipts` (every
  15 minutes). Handlers only call `services.notifications`; delivery rules live in core (ADR 0030).
- **Push:** `src/push/expo.ts` implements the core `PushSender` with `expo-server-sdk`.
- **CLIs (`src/cli/`):** `create-owner`, `set-password` (TTY password prompt), `seed` (dev-only password printed),
  `gen-openapi` (writes `packages/client/openapi.json` without a server).
- **Layout:** `src/routes/` one file per resource; `src/env.ts` Zod env schema (fail fast at boot).
- **Conventions:** routes are thin: parse with contracts schemas, call a core service, map errors to
  problem+json. No business logic here.
- **Adding a route:** define it with `route(tag, {...})` from `src/http/openapi.ts` so it gets security + problem
  responses, then `pnpm gen:client`. The 401 test walks every documented `/v1` operation automatically.
- **Test alone:** `pnpm --filter @te/api test` (PGlite; no network). `test/harness.ts` → `useApi()` gives an
  in-process app, a controllable clock, recorded pushes and `h.session()` (test-only session route).
  `test/mcp.test.ts` scripts the full OAuth flow (discovery → DCR → PKCE authorize → consent → token → /mcp).
