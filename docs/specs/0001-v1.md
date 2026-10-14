# Trait Engineer — Initial build spec

## 0. Agent operating instructions

Build the whole project from an empty GitHub repo by working through the milestones in section 15 in order, without asking questions unless a stop condition below applies.

- **Name:** Trait Engineer, abbreviated **TE**. Repo `traitengineer`, package scope `@te/*`, URL scheme `traitengineer://`. Use "Trait Engineer" in user-facing text and `te` only where a short identifier is needed.
- **Work order:** one milestone at a time. Each milestone ends with `pnpm check` green, a commit series with conventional commits, and an entry in `docs/progress.md` (date, milestone, what shipped, anything deferred).
- **Versions:** use the latest stable release of every dependency at build time. Check official docs for current APIs before writing code against Expo, Better Auth, the MCP TypeScript SDK, Hono, Drizzle and pg-boss. Do not rely on remembered APIs; they move.
- **Ambiguity:** choose the simplest option consistent with this spec, write a short ADR in `docs/adr/` (context, decision, alternatives), and continue.
- **New dependencies:** anything not named in this spec needs an ADR explaining why an existing choice was insufficient.
- **Definition of done (every change):**
  - `pnpm check` passes (typecheck, lint, unit and integration tests, boundary rules).
  - New behaviour has a test at the lowest layer that can prove it.
  - Public API changes are reflected in `packages/contracts` and the generated client.
  - `AGENTS.md` files are updated when conventions or commands change.
- **Stop conditions (hand back to the human):**
  - Anything needing an account, payment, secret, DNS change or App Store action (see section 16). Prepare everything, document the exact steps in `docs/setup.md`, use placeholders in `.env.example`, and never invent secrets.
  - A decision that is irreversible or destroys data (dropping tables, rewriting history on `main`).
  - Tests that cannot be made to pass after three distinct approaches; record what was tried.
- **Never:** commit secrets, hand-edit generated files (OpenAPI client, Drizzle snapshots), edit an already-applied migration, disable a failing test to get green, or add `any` / `@ts-ignore` without a comment explaining why.

## 1. Product summary and v1 scope

A personal app for tracking psychological change targets and logging evidence against them, usable from a phone, the web and AI agents via MCP.

- **Change target:** a behaviour the user wants to shift, e.g. "default to action rather than over-planning". Has a title, the old pattern, the desired default, and why it matters.
- **Tool:** an instrument attached to a change target. v1 ships one tool type, the **evidence log**. The system must make adding further tool types cheap (see section 4).
- **Entry:** one record produced by a tool, e.g. "Sent the proposal without a third rewrite".
- **v1 must deliver:**
  - Create, edit, and archive change targets.
  - Simple evidence log tool. Log an entry quickly. Log should have: 
    - What I expected
    - What I did - e.g. send a specific proposal
    - What happened
    - What this supports
    - What remains uncertain
  - Scheduled reminders for the evidence log. simple notification configuration setting page.
  - Works on iOS (primary) and web from one Expo codebase.
- **Multi-user readiness:** every table carries `user_id` and every query is scoped by it, but v1 runs single-user: exactly one owner account exists, and no further users can be created (see section 6).

## 2. Stack

TypeScript everywhere, strict mode, Node LTS, pnpm. These choices are fixed; deviations need an ADR.

| Layer | Choice |
| --- | --- |
| Monorepo | pnpm workspaces + Turborepo |
| Validation / contracts | Zod |
| API server | Hono on Node (`@hono/node-server`), `@hono/zod-openapi`, Scalar for `/docs` |
| API client | Generated from OpenAPI (`openapi-typescript` + `openapi-fetch`) |
| MCP | Official MCP TypeScript SDK, Streamable HTTP transport |
| Auth | Better Auth: email + password, passkeys, bearer, Expo plugin, OAuth provider for MCP |
| Database | Postgres on Neon; Drizzle ORM + drizzle-kit migrations |
| Test database | PGlite (in-process Postgres), same migrations |
| Jobs | pg-boss (Postgres-backed queue and cron) |
| Push | Expo push service via `expo-server-sdk` |
| Recurrence | `rrule` with IANA time zones |
| Mobile + web | Expo (latest SDK), Expo Router, TanStack Query (+ persisted queries and mutations), NativeWind, React Hook Form + Zod resolver, `expo-notifications`, `expo-secure-store`, `expo-quick-actions`, `expo-haptics` |
| Logging / errors | pino; Sentry (API + mobile), enabled only when DSN is set |
| Env validation | Zod schema per app, fail fast at boot |
| Lint / format | oxlint |
| Tests | Vitest (packages + API) |
| Boundaries | dependency-cruiser |
| Hosting | Fly.io (API + worker, Docker), Neon (DB), EAS Build / Submit / Update (mobile), web build served as static files (see section 10) |
| CI | GitHub Actions; Renovate for dependency updates |

## 3. Repo layout and package boundaries

One monorepo; business logic lives in `packages/core` and every surface (REST, MCP, jobs) is a thin adapter over it.

```
traitengineer/
  apps/
    api/            Hono server: /v1 REST, /mcp, /api/auth, serves web build, pg-boss worker
      src/routes/   one file per resource
      src/mcp/      mounts @te/mcp on /mcp
      src/jobs/     pg-boss job handlers
      src/main.ts   HTTP entrypoint (ROLE=web|worker|all)
    mobile/         Expo app (iOS, Android, web)
      app/          Expo Router routes
      src/features/ one folder per feature (targets, entries, reminders, settings)
      src/tools/    UI per tool type (form + entry renderer)
  packages/
    contracts/      Zod schemas + inferred types; tool-type registry; OpenAPI fragments
    core/           domain services and rules; depends on contracts + repository interfaces only
    db/             Drizzle schema, migrations, repository implementations
    mcp/            MCP tool/prompt definitions; calls core services
    client/         generated OpenAPI client (do not hand-edit)
    config/         shared tsconfig, Biome, Vitest presets
  docs/
    specs/          0001-v1.md (this spec), one file per later feature
    adr/            architecture decision records
    setup.md        human setup steps
    deploy.md       runbook
    progress.md     milestone log
  AGENTS.md         root agent guide
```

- **Dependency rules (enforced by dependency-cruiser in `pnpm check`):**
  - `contracts` imports only `zod`.
  - `core` imports `contracts` and its own repository interfaces; never `db`, `hono`, `drizzle-orm` or anything under `apps/`.
  - `db` imports `contracts` and `core` (to implement its interfaces).
  - `mcp` imports `contracts` and `core`; never `db` or `hono`.
  - `apps/mobile` imports `contracts` and `client` only.
  - No app imports another app.
- **Composition root:** `apps/api` wires `db` repositories into `core` services and hands them to routes, MCP and jobs. Tests wire the same services to PGlite.

## 4. Domain model

Four core tables plus support tables; tool-specific data lives in validated JSONB so new tool types need no migration.

- **Conventions:** UUIDv7 primary keys generated in the app; `timestamptz` everywhere, stored UTC; `created_at` / `updated_at` on every table; soft delete via `deleted_at` where noted; every table has `user_id` with a foreign key and an index.
- **`users`** (owned by Better Auth, extended): `email` (unique, stored lower-cased), `timezone` (IANA, default `Europe/London`), `display_name`. The password hash lives in Better Auth's `account` table for the user's credential account (see section 6); it is never returned by any API, MCP tool, export or log line.
- **`change_targets`:** `title` (≤ 120 chars), `old_pattern` (text), `desired_default` (text), `why` (text), `status` (`active` | `paused` | `achieved` | `archived`), `sort_order`, `archived_at`.
- **`tools`:** `change_target_id`, `type` (from the registry), `name`, `config` (JSONB, validated by the type's config schema), `sort_order`, `deleted_at`.
- **`entries`:** `tool_id`, `change_target_id` (denormalised for querying), `tool_type`, `payload` (JSONB, validated by the type's payload schema), `occurred_at` (when it happened; defaults to now, user-editable), `source` (`mobile` | `web` | `mcp` | `api`), `client_id` (UUID from the client, unique per user, makes creates idempotent), `deleted_at`. Index on `(user_id, change_target_id, occurred_at desc)`.
- **`reminders`:** `tool_id` (nullable), `change_target_id` (nullable), `rrule` (RFC 5545 string), `timezone`, `title`, `body`, `enabled`, `next_fire_at` (computed), `last_fired_at`.
- **`push_devices`:** `expo_push_token` (unique), `platform`, `device_name`, `last_seen_at`, `disabled_at`.
- **`personal_access_tokens`:** `name`, `token_hash` (SHA-256; plaintext shown once), `scopes` (`read` | `write`), `last_used_at`, `revoked_at`.
- **Tool-type registry** (`packages/contracts/src/tool-types/`):
  - Each type exports `{ type, displayName, configSchema, payloadSchema, summarise(entries) }`; the registry is a typed map keyed by `type`.
  - Server validates `config` and `payload` against the registry on every write; unknown types are rejected.
  - Mobile has a matching map in `apps/mobile/src/tools/<type>/` with `QuickLogForm` and `EntryCard` components; a type-level test fails if a registry type has no UI.
- **Evidence-log tool type (`evidence_log`):**
  - `config`: `prompt` (string shown on the quick-log form, default "What did you do?"), `askDifficulty` (boolean, default true).
  - `payload`: `summary` (required, 1–280 chars), `details` (optional text), `difficulty` (optional integer 1–5), `tags` (string array, max 10).
  - `summarise`: count per ISO week, current streak in days (user time zone), days since last entry.
- **Adding a tool type** (document this as a checklist in `AGENTS.md`): schema in contracts, registry entry, UI pair in mobile, MCP description update, tests at each layer. No migration.

## 5. API

A versioned REST API under `/v1`, defined with `@hono/zod-openapi` so `/openapi.json` is the contract every client is generated from.

- **Conventions:**
  - JSON, camelCase fields, ISO 8601 UTC timestamps.
  - Errors are RFC 9457 `application/problem+json` with a stable `code` field.
  - Lists use cursor pagination: `?limit` (default 50, max 200) and `?cursor`, response `{ items, nextCursor }`.
  - `PATCH` is partial update. `DELETE` soft-deletes or archives.
  - Every route requires auth except `/health`, `/openapi.json`, `/docs`, `/api/auth/*` and `/.well-known/*`.
  - Request ID header propagated to logs.
- **Endpoints:**
  - `GET /health` returns status and DB reachability.
  - `GET|POST /v1/change-targets` (list filterable by `status`); `GET|PATCH|DELETE /v1/change-targets/:id`.
  - `GET /v1/change-targets/:id/summary` returns tool summaries from the registry plus totals.
  - `GET|POST /v1/tools` (filter by `changeTargetId`); `GET|PATCH|DELETE /v1/tools/:id`.
  - `GET /v1/entries` with filters `changeTargetId`, `toolId`, `since`, `until`, `tag`; `POST /v1/entries` (idempotent on `clientId`: a repeat returns the existing entry with 200); `GET|PATCH|DELETE /v1/entries/:id`.
  - `GET|POST /v1/reminders`; `PATCH|DELETE /v1/reminders/:id`; `POST /v1/reminders/:id/test` sends one immediately.
  - `POST /v1/devices` (upsert by push token); `DELETE /v1/devices/:id`.
  - `GET|POST /v1/tokens` (personal access tokens); `DELETE /v1/tokens/:id`.
  - `GET /v1/me`; `PATCH /v1/me` (timezone, display name).
  - `GET /v1/export?format=json|markdown` returns everything for the user.
- **Rate limiting:** a simple in-memory per-user limit (e.g. 120 writes per minute) to catch runaway agents.
- **Client generation:** `pnpm gen:client` builds `/openapi.json` from the app without a server and regenerates `packages/client`. CI fails if the generated output differs from what is committed.

## 6. Auth

Better Auth, mounted at `/api/auth/*`, is the only identity system: it issues app sessions, and it acts as the OAuth 2.1 authorisation server for MCP clients.

- **Principle:** knowing the owner's email address must never be enough to get in, create an account, or learn anything about the account. The email is an identifier, not a credential.
- **Sign-in:** email + password. Passkeys can be registered from `/settings` once signed in and then used instead of the password. No magic links and no other email-only sign-in or recovery path.
- **Password storage:** Better Auth's email-and-password credential account. Store only a salted, slow hash (Better Auth's default scrypt, or argon2id if configured; record the choice in an ADR). Never store, log or return the plaintext or the hash. Minimum length 12 characters.
- **Single owner, no sign-up:**
  - Public sign-up is disabled (`disableSignUp`) and every sign-up route returns `403`, in every environment except `NODE_ENV=test`.
  - The one owner account is created by a server-side CLI, `pnpm user:create-owner`, which reads `OWNER_EMAIL` from env and prompts for the password on the TTY (never as an argument or env var). It refuses to run if any user already exists.
  - Password changes happen in `/settings` (current password required, all other sessions revoked) or with `pnpm user:set-password` on the server. There is no "forgot password" email.
- **Brute-force and enumeration protection:**
  - Failed sign-ins are rate limited per IP and per email (e.g. 5 attempts per 15 minutes, then exponential backoff), using Better Auth's rate limiter with database storage so limits survive restarts.
  - Unknown email and wrong password return the same error, status and response time (hash a dummy password when the email is unknown).
  - The owner's email never appears in public responses, page HTML, OpenAPI examples, logs (log the user ID instead) or committed files; `OWNER_EMAIL` is a secret.
- **Sessions:** `httpOnly`, `Secure`, `SameSite=Lax` cookies on web; sessions expire after 30 days and are revoked on password change. `/settings` lists active sessions and can revoke them.
- **Mobile:** Better Auth Expo plugin; session token stored in `expo-secure-store`; requests use bearer auth. Deep links use the `traitengineer://` scheme and a universal link.
- **Web:** cookie session; same origin as the API (see section 10), so no CORS or cross-site cookie issues.
- **Personal access tokens:** for scripts and local agents (e.g. Claude Code with an `Authorization: Bearer` header). Scopes `read` or `write`. Hash stored, plaintext shown once.
- **MCP OAuth:**
  - Use Better Auth's OAuth/OIDC provider (or its MCP plugin, whichever the current docs recommend) with dynamic client registration and PKCE.
  - Serve `/.well-known/oauth-authorization-server` and `/.well-known/oauth-protected-resource`.
  - `/mcp` returns `401` with a `WWW-Authenticate` header pointing at the resource metadata when unauthenticated.
  - Scopes `read` and `write`; the consent screen states which.
  - Verify end to end by adding the server as a custom connector in Claude (human step, section 16).
- **Test mode:** when `NODE_ENV=test`, a test-only route `POST /api/test/session` returns a session for a seeded user. It must not exist in production builds; a test asserts that.
- **Auth tests:** sign-up is refused; a second user cannot be created through any route; unknown email and wrong password are indistinguishable; the rate limit triggers and resets; the password hash never appears in any API, MCP or export response; password change revokes other sessions.
- **Authorisation:** every core service method takes a `userId` and every repository query filters by it. An integration test proves user A cannot read or change user B's rows through REST or MCP.

## 7. MCP server

A remote MCP server at `/mcp` over Streamable HTTP, defined in `packages/mcp` and calling `core` directly, so agents get the same rules and validation as the app.

- **Transport:** stateless Streamable HTTP. No server-side session state required.
- **Auth:** OAuth bearer tokens (section 6) or personal access tokens. Write tools require the `write` scope.
- **Tool design:** task-shaped, not CRUD mirrors. Descriptions are written for an LLM reader: what it does, when to use it, what it returns. Every tool returns `structuredContent` plus a short text rendering. Inputs reuse contracts schemas.
- **Read tools:**
  - `list_change_targets(status?)`: targets with tool list and last-entry date.
  - `get_change_target(id)`: full target, its tools, summary, and the 20 most recent entries.
  - `list_entries(changeTargetId?, toolId?, since?, until?, tag?, limit?)`.
  - `summarise_progress(changeTargetId?, since?)`: per-target weekly counts, streaks, days since last entry, and the user's own words from recent entries. Default is all active targets over the last 28 days.
- **Write tools:**
  - `log_entry(toolId, payload, occurredAt?)`: sets `source=mcp` and generates `clientId` server-side.
  - `create_change_target(title, oldPattern, desiredDefault, why)`.
  - `update_change_target(id, fields)`.
- **Prompts:**
  - `weekly_review`: pulls `summarise_progress` for the last 7 days and asks the model to reflect on patterns, wins and one experiment for next week.
  - `define_change_target`: guides an interview that ends in `create_change_target`.
- **Server instructions:** a short description of the domain (targets, tools, entries) and the guidance that agents should read before writing and should never fabricate entries the user did not describe.
- **Tests:** an in-memory MCP client from the SDK calls every tool against PGlite. Covers scope enforcement, validation errors and cross-user isolation.
- **Local use:** document in `docs/setup.md` how to add the server to Claude Code over HTTP with a personal access token, and how to run the MCP Inspector against local dev.

## 8. Notifications and background jobs

Reminders are scheduled server-side with pg-boss and delivered through Expo's push service, so they keep working across devices and survive a lost phone.

- **Process model:** one Docker image; `ROLE=all` runs HTTP and worker in one process (v1 default on Fly); `ROLE=web` and `ROLE=worker` allow splitting later.
- **Jobs:**
  - `reminders.dispatch` runs every minute. It selects reminders with `enabled` and `next_fire_at <= now()`, sends to all active devices, sets `last_fired_at`, recomputes `next_fire_at` from the `rrule` in the reminder's time zone. It is idempotent: a reminder fires at most once per occurrence even if the job overlaps or retries.
  - `push.receipts` runs every 15 minutes. It checks Expo push receipts and sets `disabled_at` on devices that return `DeviceNotRegistered`.
  - `archive.nightly` runs at 03:00 Europe/London (section 11).
- **Payload:** title and body from the reminder; `data.url` is a deep link such as `traitengineer://log/<toolId>`. The iOS notification category includes a "Log now" action that opens the quick-log sheet.
- **Mobile side:** request permission after first sign-in with a short explanation screen. Register or refresh the Expo push token on every app start via `POST /v1/devices`. Handle taps from a cold start and in the foreground.
- **Reminder UX:** presets (daily at a time, weekdays at a time, every N hours between two times) that compile to `rrule`; raw `rrule` is not exposed in the UI.
- **Tests:** unit tests for next-fire computation across DST changes (last Sunday of March and October in Europe/London); integration test for dispatch with a stubbed Expo client asserting exactly-once delivery.

## 9. Mobile app

One Expo Router app for iOS, Android and web, built around logging an entry in three taps or fewer.

- **Screens (Expo Router):**
  - `/sign-in`: email and password fields, passkey button. No sign-up link and no "forgot password" link.
  - `/` Today: active targets as cards, each with a one-tap "Log" button per tool, days since last entry, and today's entries below.
  - `/log/[toolId]`: quick-log sheet (modal presentation). The first field is autofocused, "Save" is reachable without scrolling, a haptic plays on save, and the sheet dismisses on save.
  - `/targets`: list with status filter; `/targets/new`; `/targets/[id]` showing what/why, tools, weekly-count bar chart for the last 12 weeks, and the entry timeline; `/targets/[id]/edit`.
  - `/entries/[id]`: view, edit, delete.
  - `/reminders`: list, create from presets, enable toggle, "send test".
  - `/settings`: account, change password, passkeys, active sessions, time zone, devices, personal access tokens, export (share sheet), sign out.
- **Data layer:**
  - TanStack Query using the generated client.
  - The query cache is persisted (MMKV on native, `localStorage` on web) so the app opens instantly with last-known data.
  - Mutations are persisted and resumed: `POST /v1/entries` carries a client-generated `clientId`, so retries after reconnect are safe.
  - A small banner shows "n entries waiting to sync" while offline.
- **Forms:** React Hook Form with Zod resolvers from `contracts`; tool forms come from the tool UI map.
- **Quick capture:** a home-screen quick action ("Log evidence") via `expo-quick-actions`, opening the quick log for the most recently used tool.
- **Design:** NativeWind with a small token set (colours, spacing, radius, type scale) in one theme file; light and dark mode; Dynamic Type respected; every tappable element at least 44pt; screen-reader labels on all controls.
- **Platform code:** isolated in `*.native.tsx` / `*.web.tsx` files. Every screen must render on the web target, because agents verify UI there.
- **EAS:**
  - `eas.json` profiles: `development` (dev client), `preview` (internal distribution, `preview` update channel), `production` (store, `production` channel).
  - Bundle ID placeholder `com.example.traitengineer`.
  - `runtimeVersion` uses the fingerprint policy so OTA updates never reach an incompatible binary.
- **Tests:** jest-expo unit tests for tool forms and the offline queue; Playwright e2e on the web build (section 12); Maestro flows for sign-in → create target → log entry, runnable on EAS (optional in CI).

## 10. Web client

The web client is the Expo app's web export, served by the API server from the same origin; there is no separate web app in v1.

- `apps/mobile` builds with `expo export --platform web` (single-page output) into `dist/web`. The API Docker build copies it in and serves it as static files with an SPA fallback to `index.html`.
- The API reserves `/v1`, `/mcp`, `/api`, `/.well-known`, `/health`, `/openapi.json` and `/docs`. Everything else falls through to the web app.
- One origin means cookie auth with no CORS. The API sets CORS only for `localhost` origins in development.
- Layout adapts at a 768px breakpoint: tab bar on narrow screens, sidebar on wide ones.
- Push notifications are not supported on web in v1.
- A dedicated web app (Vite or Next.js) is out of scope until the Expo web build proves insufficient. That decision requires an ADR.

## 11. Persistence, migrations, backups and export

Neon Postgres is the system of record. Point-in-time recovery plus a nightly human-readable archive in a separate GitHub repo protect against losing either the phone or the provider.

- **Schema:** Drizzle schema in `packages/db/src/schema/`. Migrations are generated with `drizzle-kit generate`, committed, and never edited after merge.
- **Migrations run** as a Fly release command before new machines start. A failed migration aborts the deploy.
- **Connections:** Neon pooled connection string for the app and direct connection string for migrations, both from env.
- **Seed:** `pnpm db:seed` creates a demo user (with a dev-only password printed to the console; refuses to run when `NODE_ENV=production`), two change targets, evidence-log tools and about 40 entries over 8 weeks, for local dev, previews and screenshots.

## 12. Quality gates, testing and tooling

`pnpm check` is the single definition of "works". It must run in under three minutes on a laptop with no Docker and no network beyond the package registry.

- **Root scripts:**
  - `pnpm dev` runs API and Expo together.
  - `pnpm check` runs Turborepo `typecheck`, `lint`, `test` and `boundaries`.
  - `pnpm check:full` runs `check`, then `build`, then Playwright e2e.
  - Also: `pnpm gen:client`, `pnpm db:generate`, `pnpm db:migrate`, `pnpm db:seed`, `pnpm user:create-owner`, `pnpm user:set-password`.
- **TypeScript:** `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, project references; no default exports outside Expo Router routes.
- **oxlint:** lint and format, run on commit via `lefthook`.
- **Test layers:**
  - Unit (Vitest) for `contracts` and `core`: tool-type schemas, summaries, streak and time-zone logic, rrule computation.
  - MCP (Vitest): SDK in-memory client against the same wiring.
- **Testing principles:** test behaviour through public interfaces; no mocking of `core` in API tests; the only stubs are Expo push and GitHub archive clients, behind interfaces.
- **Boundaries:** dependency-cruiser config implementing section 3; it is part of `check`.
- **Observability:** pino JSON logs with request ID and user ID; Sentry for API and mobile when `SENTRY_DSN` is set.

## 13. CI/CD and environments

GitHub Actions gates every PR on `check:full`. Merges to `main` deploy the API and ship an over-the-air mobile update automatically; native builds happen only when the native fingerprint changes.

- **Environments:** `local` (Postgres via PGlite or a Neon dev branch), `preview` (per PR, milestone M8), `production`.
- **PR workflow (`ci.yml`):** install with pnpm cache; `pnpm check`; `pnpm gen:client` and fail on diff; `pnpm check:full`; upload Playwright report and screenshots.
- **Main workflow (`deploy.yml`):**
  - `flyctl deploy` (the release command runs migrations).
  - Smoke test `GET /health` and an authenticated `GET /v1/me` using a CI personal access token.
  - `eas update --channel production` for JS-only changes.
  - If `expo fingerprint` changed, trigger `eas build --profile production` and `eas submit` to TestFlight instead.
- **Preview workflow (M8):** create a Neon branch per PR; deploy a Fly preview app; run `eas update --channel preview`; post links in a PR comment; tear down on close.
- **Secrets:** GitHub Actions secrets only; listed with descriptions in `docs/setup.md`; all runtime config read through each app's Zod env schema.
- **Repo settings (documented for the human):** branch protection on `main` requiring the CI check, squash merge, Renovate enabled with grouped weekly updates.
- **Agents in CI:** add the Claude Code GitHub Action so issues labelled `agent` can be picked up. The workflow passes `AGENTS.md` context and must run `pnpm check` before opening a PR.

## 14. Agent-facing docs in the repo

The repo must be self-explaining to a fresh agent with no chat history. These files are deliverables, not afterthoughts.

- **Root `AGENTS.md`** (under about 200 lines):
  - What the product is (one paragraph).
  - Commands.
  - Architecture and dependency rules.
  - Definition of done.
  - The "never" list from section 0.
  - The checklist for adding a tool type.
  - The checklist for adding an API endpoint (contract → core → db → route → regenerate client → MCP if relevant → tests).
  - Where specs and ADRs live.
- **Per-package `AGENTS.md`:** purpose, public surface, local conventions, how to test that package alone.
- **`docs/specs/0001-v1.md`:** this spec, verbatim. Later features each get a numbered spec written before code.
- **`docs/adr/`:** one ADR per row of the stack table in section 2 (short), plus any made during the build.
- **`docs/setup.md`, `docs/deploy.md`, `docs/progress.md`:** as described in sections 0, 11 and 16.
- **`.github/ISSUE_TEMPLATE/feature.md`:** sections for problem, acceptance criteria, affected layers, and out of scope. These issues are what future agents will be handed.

## 15. Milestones

Nine milestones, built in order. M0–M5 run fully locally with no accounts; M6 is the first point that needs the human.

1. **M0 Scaffold.** Monorepo, config package, Biome, TypeScript project references, Turborepo pipeline, dependency-cruiser, lefthook, CI running `pnpm check`, `AGENTS.md` files, ADRs, `docs/` skeleton.
   - Accept: fresh clone → `pnpm i && pnpm check` passes; CI green.
2. **M1 Domain and database.** Contracts (including the tool-type registry and `evidence_log`), core services, Drizzle schema, migrations, repositories, seed, PGlite test harness.
   - Accept: unit and integration tests cover create/list/update/archive for targets, tools and entries; idempotent entry creation; cross-user isolation; summaries and streaks across a DST boundary.
3. **M2 API and auth.** Hono app, all section 5 routes, OpenAPI and Scalar docs, generated client, Better Auth with email + password, passkeys, sign-up disabled, owner bootstrap CLI, sign-in rate limiting, bearer for mobile, personal access tokens, test session route.
   - Accept: integration tests for every route, including auth failures and the auth tests in section 6; client regenerates with no diff.
4. **M3 MCP.** `packages/mcp` tools and prompts, `/mcp` mount, OAuth provider and well-known endpoints, scope enforcement.
   - Accept: in-memory MCP tests pass; MCP Inspector can list and call tools locally with a personal access token; the OAuth discovery flow completes in a scripted test.
5. **M4 Mobile and web.** All section 9 screens, persisted queries and mutations, offline banner, quick action, web export served by the API.
   - Accept: Playwright e2e passes; screenshots of every screen at 390px and 1280px widths are committed under `docs/screenshots/`; the app runs in an iOS simulator via a dev build.
6. **M5 Notifications.** Devices endpoint, reminders UI and presets, pg-boss jobs, deep links, "Log now" action.
   - Accept: DST and exactly-once tests pass; a reminder fires to a dev build locally with a real Expo push token (human verifies on device).
7. **M6 Deploy.** Dockerfile (multi-stage, builds the web export), `fly.toml` with release command, Neon wiring, EAS config, deploy workflow, `docs/deploy.md`.
   - Accept: production is reachable; smoke tests pass; a TestFlight build is installable; an OTA update reaches it.
8. **M7 Resilience.** Export endpoint and share sheet, nightly archive job, restore script and its CI test.
   - Accept: the archive repo receives a commit; restore round trip passes in CI.
9. **M8 Preview environments (optional).** Neon branch, Fly preview app and EAS preview channel per PR, with teardown.
   - Accept: a PR shows working preview links; closing it deletes the resources.

**Done for v1:** the human can sign in on iPhone and web, create a change target, log evidence offline and see it sync, receive a reminder that opens quick log, and ask Claude (via the custom connector) for a weekly review that reflects real entries.

## 16. Human-only setup steps

The agent prepares config and writes exact instructions in `docs/setup.md`. The human does these steps, ideally all before M6 so the build is not blocked.

| Step | Produces (env / secret) | Needed by |
| --- | --- | --- |
| Create GitHub repo `traitengineer` and private repo `traitengineer-archive` | `ARCHIVE_REPO`, fine-grained `ARCHIVE_GITHUB_TOKEN` | M0, M7 |
| Neon project with `main` branch | `DATABASE_URL` (pooled), `DATABASE_URL_DIRECT`; `NEON_API_KEY` for M8 | M6 |
| Fly.io account and app | `FLY_API_TOKEN` | M6 |
| Domain and DNS (e.g. `traitengineer.<your-domain>`) pointed at Fly | `PUBLIC_URL` | M6 |
| Generate auth secret; choose owner email | `BETTER_AUTH_SECRET`, `OWNER_EMAIL` | M2 (prod), M6 |
| Create the owner account in production with `pnpm user:create-owner` (password typed at the prompt, stored in a password manager) | none | M6 |
| Expo account and EAS project | `EXPO_TOKEN`, EAS project ID | M4, M6 |
| Apple Developer Program membership; App Store Connect app record | Bundle ID, push key handled by EAS credentials | M5, M6 |
| Sentry projects (optional) | `SENTRY_DSN` (API and mobile) | M6 |
| Add `/mcp` as a custom connector in Claude and approve OAuth | none | M3 verification in prod |
| Install TestFlight build and allow notifications | none | M5, M6 |

Local development through M5 needs none of these: PGlite replaces Neon, the seed creates a local user with a dev-only password, and push uses an Expo dev build.
