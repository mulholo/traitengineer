# Progress

Milestone log: date, milestone, what shipped, anything deferred.

## 2026-10-14 — M0 Scaffold

- **Shipped:** pnpm + Turborepo monorepo (`apps/api`, `packages/{config,contracts,core,db,mcp,client}`),
  shared strict tsconfig with project references (`tsc -b`), Vitest preset, oxlint + oxfmt, dependency-cruiser
  boundary rules (verified to fail on forbidden imports), lefthook (format, lint, conventional commits),
  GitHub Actions CI (`ci.yml`) and Claude agent workflow, Renovate config, issue template, root and
  per-package `AGENTS.md`, ADRs 0001–0022, docs skeleton.
- **Deferred:** `apps/mobile` is scaffolded in M4 (boundary rules for it already exist). CI has not run yet
  because the GitHub remote does not exist (human task H2).
- **Decisions:** TypeScript 6.x not 7.x (ADR 0020), oxfmt (ADR 0021), Node type stripping instead of builds (ADR 0022).

## 2026-10-14 — M1 Domain and database

- **Shipped:** `@te/contracts` (common/pagination/problem schemas, change target, tool, entry, summary contracts,
  time-zone calendar helpers, tool-type registry with `evidence_log`), `@te/core` (services for users, change
  targets, tools, entries, summaries; repository ports; domain errors; keyset cursors), `@te/db` (Drizzle schema
  for all section 4 tables incl. reminders/devices/tokens, initial migration, repositories, PGlite harness,
  `db:migrate` and `db:seed`).
- **Tests:** contracts 16 unit (ISO weeks, DST-safe local dates, schemas, streaks across March/October DST);
  core 6 unit; db 21 integration on PGlite (CRUD/archive for targets, tools, entries; idempotent + concurrent
  entry creation; filters + cursor pagination; cross-user isolation via services and composite FKs; summaries
  across DST; seed).
- **Deferred:** the seed's dev-only password needs Better Auth's `accounts` table (M2). Reminder/device/token
  services land with their endpoints (M2/M5).
- **Decisions:** ADR 0023 (evidence-log payload fields).

## 2026-10-14 — M2 API and auth

- **Shipped:** Hono app with every section 5 route via `@hono/zod-openapi` (`/openapi.json`, Scalar `/docs`),
  RFC 9457 problem responses, request IDs in logs, cursor pagination, idempotent `POST /v1/entries` (201/200),
  per-user write rate limit; Better Auth (email + password, passkeys, bearer, Expo plugin) with sign-up disabled,
  durable per-email/per-IP sign-in throttle with exponential backoff, forced session revocation on password
  change, `user:create-owner` / `user:set-password` CLIs, personal access tokens (hashed, scoped), test-only
  session route; reminders (presets → RRULE, DST-safe next-fire computation), devices, export (JSON + Markdown);
  generated `@te/client` (openapi-typescript + openapi-fetch), deterministic `pnpm gen:client`.
- **Verified:** live server with curl (health, docs, 401/403 problems, sign-in → bearer, PAT scopes, summary,
  Markdown export, cookie flags `HttpOnly; SameSite=Lax; Max-Age=30d`, logs carry user ID not email).
- **Tests:** API 27 integration tests (every `/v1` operation 401s unauthenticated; section 6 auth tests;
  REST cross-user isolation; generated client against the app), plus 15 DST/recurrence unit tests in core.
- **Deferred:** passkey registration UI (M4); real Expo push sender (M5); MCP OAuth (M3).
- **Decisions:** ADRs 0024 (auth tables + throttle), 0025 (owner bootstrap), 0026 (pg + uuid).

## 2026-10-14 — M2 API and auth

- **Shipped:** Hono app with every section 5 route via `@hono/zod-openapi` (`/openapi.json`, Scalar `/docs`),
  RFC 9457 problem responses, request IDs in logs, cursor pagination, idempotent `POST /v1/entries` (201/200),
  per-user write rate limit; Better Auth (email + password, passkeys, bearer, Expo plugin) with sign-up disabled,
  durable per-email/per-IP sign-in throttle with exponential backoff, forced session revocation on password
  change, `user:create-owner` / `user:set-password` CLIs, personal access tokens (hashed, scoped), test-only
  session route; reminders (presets → RRULE, DST-safe next-fire computation), devices, export (JSON + Markdown);
  generated `@te/client` (openapi-typescript + openapi-fetch), deterministic `pnpm gen:client`.
- **Verified:** live server with curl (health, docs, 401/403 problems, sign-in → bearer, PAT scopes, summary,
  Markdown export, cookie flags `HttpOnly; SameSite=Lax; Max-Age=30d`, logs carry user ID not email).
- **Tests:** API integration tests (every `/v1` operation 401s unauthenticated; section 6 auth tests; REST
  cross-user isolation; generated client against the app), plus DST/recurrence unit tests in core.
- **Deferred:** passkey registration UI (M4); real Expo push sender (M5); MCP OAuth (M3).
- **Decisions:** ADRs 0024 (auth tables + throttle), 0025 (owner bootstrap), 0026 (pg + uuid).

## 2026-10-14 — M3 MCP

- **Shipped:** `@te/mcp` with 7 task-shaped tools (4 read, 3 write), `weekly_review` and `define_change_target`
  prompts, and server instructions; core `summaries.progress()` (per-target weekly counts, streaks, days since
  last entry, the user's own words); `/mcp` mounted as stateless Streamable HTTP; Better Auth `jwt()` + `mcp()`
  OAuth 2.1 provider with dynamic client registration and PKCE; `/.well-known/oauth-protected-resource[/mcp]`
  and `/.well-known/oauth-authorization-server[/api/auth]`; 401 + `WWW-Authenticate` with resource metadata;
  PAT or OAuth bearer on `/mcp`; scope enforcement on write tools.
- **Verified:** in-memory SDK client tests for every tool (scopes, validation errors, cross-user isolation,
  prompts); SDK Streamable HTTP client against the app with PATs; scripted OAuth flow (discovery → DCR →
  authorize with PKCE → consent → token → MCP call); **MCP Inspector CLI** against a live local server with a
  PAT (tools/list, tools/call `summarise_progress`, prompts/get `weekly_review`).
- **Deferred:** the `/sign-in` and `/consent` web screens (M4); verifying the Claude custom connector in
  production (human step after M6); CIMD (ADR 0027).

## 2026-10-14 — M4 Mobile and web

- **Shipped:** Expo SDK 57 app (`apps/mobile`): sign-in (no sign-up/forgot links), OAuth consent screen,
  Today, quick-log modal (autofocus, haptic, dismiss on save, Save always visible), targets list/new/detail
  (12-week chart, timeline)/edit, entry view/edit/delete, reminders (presets only), settings (account, time
  zone, password change, passkeys on web, sessions, devices, tokens, export via share sheet/download, sign
  out). Responsive shell (tabs < 768px, sidebar ≥ 768px), NativeWind tokens with light/dark, 44pt targets.
  Persisted query cache + persisted, resumable entry mutations; offline banner; home-screen quick action
  (`/log/recent`). The API serves the web export from the same origin with SPA fallback.
- **Tests:** jest-expo (tool UI coverage, quick-log form, offline queue incl. restart); Playwright e2e at 390px
  and 1280px (sign-in → create target → log in three taps; offline logging + sync; reload persistence; OAuth
  consent end to end; layout; 44px tap targets; every screen). Screenshots in `docs/screenshots/{narrow,wide}`.
- **Deferred:** iOS simulator dev-build check (see scratchpad / human tasks); native passkeys (ADR 0029).
- **Decisions:** ADRs 0028 (mobile implementation choices) and 0029 (passkeys on web first).

## 2026-10-15 — M5 Notifications

- **Shipped:** core `notifications.dispatchDue()` (compare-and-set, exactly once per occurrence, catch-up after
  downtime) and `checkReceipts()`; `push_tickets` table; Expo `PushSender`; pg-boss worker (`ROLE=worker|all`)
  with `reminders.dispatch` (every minute) and `push.receipts` (every 15 minutes), running on PGlite locally;
  mobile: notification permission explainer after first sign-in, push token registration on every start,
  "Log now" category action, tap routing from cold start and foreground to the quick-log deep link.
- **Tests:** DST next-fire (core, from M2) plus 8 dispatch/receipt integration tests (6 overlapping runs →
  one push per device; retry after failed send → no duplicate; downtime catch-up; disabled reminders/devices;
  08:30 local across the October change; DeviceNotRegistered via ticket and receipt); a real pg-boss job on
  PGlite delivering a reminder; deep-link mapping unit test.
- **iOS:** the M4 dev build runs on the iOS 27 simulator after adopting the UIScene life cycle (iOS 27
  terminates apps that don't): see ADR 0030.
- **Deferred:** a real push to a device needs an EAS project ID (H7) and a physical iPhone build (H8);
  the human verifies it on device (spec M5 acceptance).

## 2026-10-15 — M6 Deploy (prepared; waiting on human setup)

- **Shipped:** multi-stage `Dockerfile` (web export + API, non-root, healthcheck), `.dockerignore`, `fly.toml`
  (release command runs migrations, always-on machine for the worker), `deploy.yml` (Fly deploy, smoke tests
  incl. authenticated `/v1/me` and MCP 401, Expo fingerprint-based OTA-or-build with TestFlight auto-submit,
  each part self-skipping until configured), CI job that builds and boots the image, `docs/deploy.md`.
- **Waiting on human (human tasks H3–H8, H10):** Neon, Fly app + token, domain/DNS, secrets, Expo/EAS project,
  Apple developer account, creating the owner. Then: first deploy, smoke tests, TestFlight install, OTA check.
- **Decisions:** ADR 0031 (deploy topology).

## 2026-10-15 — M7 Resilience

- **Shipped:** nightly `archive.nightly` job (03:00 Europe/London) committing Markdown + JSON per user and a
  README to the private archive repo in one commit (GitHub Git Data API); `restoreExport()` +
  `pnpm db:restore <file>` (keeps IDs/timestamps, idempotent, transactional); export endpoint and share
  sheet were delivered in M2/M4.
- **Tests:** export → restore → export round trip into a fresh database (in `pnpm check`, so CI), re-run is
  a no-op, invalid files rejected; archive contents (no emails); GitHub store request sequence against a fake
  API; the job running on a real pg-boss worker. Restore CLI verified locally against a real API export.
- **Waiting on human:** `ARCHIVE_REPO` + `ARCHIVE_GITHUB_TOKEN` (H13) → first real archive commit.
- **Decisions:** ADR 0032.

## 2026-10-15 — Sentry (spec sections 2 and 12)

- **Shipped:** API error reporter (`apps/api/src/observability.ts`): Sentry only when `SENTRY_DSN` is set,
  unexpected (500) errors only, tagged with request ID and user ID, cookies/auth headers/bodies scrubbed.
  Mobile: `@sentry/react-native` initialised only when `EXPO_PUBLIC_SENTRY_DSN` is set at build time; the root
  layout is wrapped only when enabled. Source-map upload (Sentry's Expo config plugin) is deferred until the
  Sentry org/project exist (human task H9).
- **Tests:** 500s reported with request/user IDs and no internals in the response; domain errors not reported;
  reporter is a no-op without a DSN.

## 2026-10-15 — M8 Preview environments (prepared; optional)

- **Shipped:** `preview.yml` (Neon branch per PR, Fly preview app with per-app secrets, migrations via release
  command, health check, EAS update on the preview channel, sticky PR comment; teardown on close), docs.
- **Waiting on human:** `NEON_API_KEY`, `NEON_PROJECT_ID` (and Fly/EAS from M6). Until then the workflow skips.

## 2026-10-15 — Maestro flow (spec section 9, optional)

- Added `apps/mobile/.maestro/sign-in-create-log.yaml` (sign in → create target → log entry, using the same
  testIDs as Playwright) and an EAS workflow (`.eas/workflows/e2e.yml`, `e2e` simulator build profile) to run it
  on EAS. **Not yet executed**: Maestro isn't installed locally (optional human task H16) and EAS needs the
  project (H7).

## 2026-10-17 — Maestro flow verified on iOS 27 (native findings fixed)

- Ran `.maestro/sign-in-create-log.yaml` against a Release simulator build (iPhone 18 Pro, iOS 27) and the local
  API: sign in → create target → log entry → visible on Today. **Passes.**
- It surfaced three native-only issues, now fixed:
  1. iOS keeps keychain items across reinstalls, so a deleted-and-reinstalled app came back signed in; the
     session token is now discarded on the first launch of a fresh install (unit-tested).
  2. The keyboard covered the "Create target" button; scroll views are now keyboard-aware
     (`automaticallyAdjustKeyboardInsets`, interactive dismiss).
  3. The "Reminders" tab label wrapped on 390pt phones; tab labels are single-line and shrink to fit.
- Also: test IDs on the notifications explainer, and the flow declines iOS's "Save Password?" sheet.

## 2026-10-17 — First production deploy

- Deploy workflow (run 39024659183) deployed to Fly; the release command ran migrations against Neon
  successfully. Verified on https://traitengineer.fly.dev: `/health` → `db: ok`, web app + SPA fallback served,
  `/v1/me` and `/mcp` → 401, sign-up → 403, OAuth protected-resource metadata served.
- Smoke-test step failed only because the `PUBLIC_URL` GitHub variable is unset; the custom domain
  (`traitengineer.com`) still points at Namecheap parking (human task H5).

## 2026-10-17 — M9 Remove the nightly archive (owner request)

- **Removed:** `archive.nightly`, the `ArchiveStore` port and GitHub store, `ARCHIVE_REPO` /
  `ARCHIVE_GITHUB_TOKEN`; the worker now unschedules the job and deletes its queue in existing databases.
- **Kept:** `GET /v1/export` + share sheet, `pnpm db:restore`, and the restore round-trip test in CI.
- **Tests:** a worker test seeds the old schedule and queue and checks that starting the worker removes them.
- **Decisions:** ADR 0033 (supersedes the archive part of 0032).
