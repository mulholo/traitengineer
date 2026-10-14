# @te/api

Hono server and composition root: `/v1` REST, `/mcp`, `/api/auth` (Better Auth), `/openapi.json`, `/docs`,
`/health`, `/.well-known/*`, static web build with SPA fallback, and the pg-boss worker.

- **Entrypoint:** `src/main.ts`; `ROLE=web|worker|all` (default `all`). `pnpm --filter @te/api dev` runs it with
  `--watch`, reading the repo-root `.env`. Local DB is PGlite in `.pglite/` unless `DATABASE_URL` is set.
- **Composition:** `src/container.ts` (`createContainerFromHandle`) wires db → core services → Better Auth → app.
- **Auth:** `src/auth/better-auth.ts` (config), `src/auth/routes.ts` (sign-up block, sign-in throttle, forced
  session revocation on password change, test-only session route), `src/auth/owner.ts` (owner bootstrap).
  `src/http/middleware.ts` resolves the caller from a PAT (`te_pat_...`), a session bearer token or a cookie,
  then enforces scopes (GET → `read`, writes → `write`) and the per-user write rate limit.
- **CLIs (`src/cli/`):** `create-owner`, `set-password` (TTY password prompt), `seed` (dev-only password printed),
  `gen-openapi` (writes `packages/client/openapi.json` without a server). `pnpm --filter @te/api dev` runs it with
  `--watch`, reading the repo-root `.env`. Local DB is PGlite in `.pglite/` unless `DATABASE_URL` is set.
- **Composition:** `src/container.ts` (`createContainerFromHandle`) wires db → core services → Better Auth → app.
- **Auth:** `src/auth/better-auth.ts` (config), `src/auth/routes.ts` (sign-up block, sign-in throttle, forced
  session revocation on password change, test-only session route), `src/auth/owner.ts` (owner bootstrap).
  `src/http/middleware.ts` resolves the caller from a PAT (`te_pat_...`), a session bearer token or a cookie,
  then enforces scopes (GET → `read`, writes → `write`) and the per-user write rate limit.
- **CLIs (`src/cli/`):** `create-owner`, `set-password` (TTY password prompt), `seed` (dev-only password printed),
  `gen-openapi` (writes `packages/client/openapi.json` without a server).
- **Layout:** `src/routes/` one file per resource; `src/mcp/` mounts `@te/mcp`; `src/jobs/` pg-boss handlers;
  `src/env.ts` Zod env schema (fail fast at boot).
- **Conventions:** routes are thin: parse with contracts schemas, call a core service, map errors to
  problem+json. No business logic here.
- **Adding a route:** define it with `route(tag, {...})` from `src/http/openapi.ts` so it gets security + problem
  responses, then `pnpm gen:client`. The 401 test walks every documented `/v1` operation automatically.
- **Adding a route:** define it with `route(tag, {...})` from `src/http/openapi.ts` so it gets security + problem
  responses, then `pnpm gen:client`. The 401 test walks every documented `/v1` operation automatically.
- **Test alone:** `pnpm --filter @te/api test` (PGlite; no network). `test/harness.ts` → `useApi()` gives an
  in-process app, a controllable clock, recorded pushes and `h.session()` (test-only session route). `test/harness.ts` → `useApi()` gives an
  in-process app, a controllable clock, recorded pushes and `h.session()` (test-only session route).
