# @te/api

Hono server and composition root: `/v1` REST, `/mcp`, `/api/auth` (Better Auth), `/openapi.json`, `/docs`,
`/health`, `/.well-known/*`, static web build with SPA fallback, and the pg-boss worker.

- **Entrypoint:** `src/main.ts`; `ROLE=web|worker|all` (default `all`).
- **Layout:** `src/routes/` one file per resource; `src/mcp/` mounts `@te/mcp`; `src/jobs/` pg-boss handlers;
  `src/env.ts` Zod env schema (fail fast at boot).
- **Conventions:** routes are thin: parse with contracts schemas, call a core service, map errors to
  problem+json. No business logic here.
- **Test alone:** `pnpm --filter @te/api test` (PGlite; no network).
