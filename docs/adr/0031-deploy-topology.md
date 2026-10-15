# 0031. Deploy topology: one image, workspace layout, always-on machine

- Status: accepted
- Date: 2026-10-15

## Context

Section 10 and M6 require one Docker image (multi-stage, building the web export) on Fly with migrations as
the release command. The API runs TypeScript with Node's type stripping (ADR 0022), and Node refuses to strip
types in files under `node_modules`.

## Decision

- Multi-stage `Dockerfile`: stage `web` installs the full workspace and runs `expo export`; stage `prod-deps`
  installs production dependencies for `@te/api` and its workspace packages only
  (`pnpm install --prod --filter "@te/api..."`); the runtime stage copies `node_modules`, `packages/`,
  `apps/api` and the web export, and runs as the unprivileged `node` user. `pnpm deploy` is not used
  because it copies `@te/*` into `node_modules`, which breaks type stripping.
- `fly.toml`: `ROLE=all`, release command `node packages/db/src/cli/migrate.ts`, `/health` check,
  `auto_stop_machines = "off"` and `min_machines_running = 1` so the pg-boss cron always runs.
- CI builds and boots the image on every PR (migrate, `/health`, web shell, SPA fallback, 401s, OAuth
  metadata, worker started), so deploy breakage surfaces before merge without a Fly account.
- `deploy.yml` deploys on merge to `main`, smoke-tests, then ships the app with Expo's fingerprint-based
  continuous deploy (OTA update when the native fingerprint is unchanged, otherwise build + TestFlight submit).
  Each job skips itself until its secrets exist.

## Alternatives considered

- Bundling the API with esbuild: a build step and a new dependency for what the workspace layout already gives.
- Separate web and worker machines now: the spec makes `ROLE=all` the v1 default; `ROLE` allows splitting later.
