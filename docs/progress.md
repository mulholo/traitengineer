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
