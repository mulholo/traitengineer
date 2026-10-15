# Trait Engineer — agent guide

Trait Engineer (TE) is a personal app for tracking psychological change targets ("default to action rather
than over-planning") and logging evidence against them. A **change target** has **tools** attached (v1 ships
one tool type, the **evidence log**); each tool produces **entries**. It is used from an iPhone, the web and AI
agents over MCP. v1 is single-owner: one account, no sign-up. The full v1 spec is `docs/specs/0001-v1.md`.

## Commands

| Command                  | What it does                                                                                       |
| ------------------------ | -------------------------------------------------------------------------------------------------- |
| `pnpm i`                 | Install (also installs lefthook git hooks)                                                         |
| `pnpm dev`               | API + Expo together                                                                                |
| `pnpm check`             | **The definition of "works"**: typecheck, lint, format check, unit + integration tests, boundaries |
| `pnpm check:full`        | `check`, then `build`, then Playwright e2e                                                         |
| `pnpm format`            | Format everything with oxfmt                                                                       |
| `pnpm gen:client`        | Build `/openapi.json` from the app (no server) and regenerate `packages/client`                    |
| `pnpm db:generate`       | `drizzle-kit generate` a migration from schema changes                                             |
| `pnpm db:migrate`        | Apply migrations to `DATABASE_URL_DIRECT`                                                          |
| `pnpm db:seed`           | Seed a demo user + data, printing a dev-only password (refuses in production)                      |
| `pnpm user:create-owner` | Create the single owner account (password prompted on TTY)                                         |
| `pnpm user:set-password` | Reset the owner password on the server                                                             |
| `pnpm db:restore <file>` | Load an export JSON (API or nightly archive) into `OWNER_EMAIL`\'s account (idempotent)            |

Test one package: `pnpm --filter @te/core test` (or `pnpm vitest run` inside the package).

## Architecture

```
apps/api       Hono: /v1 REST, /mcp, /api/auth, static web build, pg-boss worker (composition root)
apps/mobile    Expo Router app (iOS, Android, web)
packages/contracts  Zod schemas, inferred types, tool-type registry
packages/core       domain services + repository interfaces (pure logic)
packages/db         Drizzle schema, migrations, repository implementations
packages/mcp        MCP tools/prompts calling core
packages/client     generated OpenAPI client (never hand-edit)
packages/config     tsconfig + vitest presets
```

Business logic lives in `core`; REST, MCP and jobs are thin adapters. `apps/api` wires `db` repositories into
`core` services. Tests wire the same services to PGlite.

### Dependency rules (dependency-cruiser enforces these in `pnpm check`)

- `contracts` imports only `zod`.
- `core` imports `contracts` and its own repository interfaces; never `db`, `hono`, `drizzle-orm` or `apps/`.
- `db` imports `contracts` and `core`.
- `mcp` imports `contracts` and `core`; never `db` or `hono`.
- `apps/mobile` imports `contracts` and `client` only.
- No app imports another app; packages never import apps.

### Conventions

- TypeScript strict + `noUncheckedIndexedAccess` + `exactOptionalPropertyTypes` + `erasableSyntaxOnly`.
  Relative imports use the `.ts` extension. No enums, namespaces or parameter properties.
- Workspace packages export their `src/index.ts` directly; there is no package build step. Node runs the TS
  with native type stripping (Node 24 LTS; `--experimental-strip-types` on 22.x).
- No default exports except Expo Router routes and tool config files.
- Every table has `user_id`; every core method takes `userId`; every repository query filters by it.
- UUIDv7 IDs generated in the app. Timestamps are `timestamptz`, ISO 8601 UTC on the wire, camelCase JSON.
- Errors on the API are RFC 9457 `application/problem+json` with a stable `code`.
- Commits: Conventional Commits (`feat(api): ...`), enforced by a commit-msg hook.

## Definition of done (every change)

- `pnpm check` passes.
- New behaviour has a test at the lowest layer that can prove it.
- Public API changes are reflected in `packages/contracts` and the regenerated client (`pnpm gen:client`).
- `AGENTS.md` files are updated when conventions or commands change.
- Milestones add an entry to `docs/progress.md`.

## Never

- Commit secrets (use `.env`, which is gitignored; placeholders go in `.env.example`).
- Hand-edit generated files (OpenAPI client, Drizzle snapshots).
- Edit an already-applied migration; add a new one instead.
- Disable or skip a failing test to get green.
- Add `any` or `@ts-ignore` / `@ts-expect-error` without a comment explaining why.
- Log, return or commit the owner's email or any password/hash. Log the user ID instead.

## Checklist: adding a tool type

No migration is needed: tool config and entry payloads are validated JSONB.

1. `packages/contracts/src/tool-types/<type>.ts`: `configSchema`, `payloadSchema`, `summarise(entries)`.
2. Register it in `packages/contracts/src/tool-types/registry.ts`.
3. Unit tests for the schemas and `summarise` next to it.
4. Mobile UI pair in `apps/mobile/src/tools/<type>/`: `QuickLogForm` and `EntryCard`; add to the mobile map.
   (A type-level test fails if a registry type has no UI.)
5. Update tool descriptions in `packages/mcp` so agents know the payload shape.
6. Integration tests: create a tool of the new type and log an entry via REST and MCP.

## Checklist: adding an API endpoint

1. **Contract**: request/response Zod schemas in `packages/contracts`.
2. **Core**: service method (takes `userId`) + repository interface change; unit test.
3. **DB**: repository implementation (+ migration via `pnpm db:generate` if the schema changed); integration test on PGlite.
4. **Route**: `apps/api/src/routes/<resource>.ts` with `@hono/zod-openapi`; integration test incl. auth failure.
5. **Client**: `pnpm gen:client` and commit the result.
6. **MCP**: add or update a task-shaped tool in `packages/mcp` if agents need it; in-memory MCP test.
7. Docs: update the relevant `AGENTS.md`.

## Where things live

- Specs: `docs/specs/NNNN-name.md` (write one before building a sizeable feature).
- ADRs: `docs/adr/NNNN-title.md` (context, decision, alternatives). Any new dependency not named in the
  spec needs one.
- Human setup steps: `docs/setup.md`. Deploy runbook: `docs/deploy.md`. Milestone log: `docs/progress.md`.
- Each package has its own `AGENTS.md` with its purpose, public surface and how to test it alone.
