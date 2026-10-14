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
