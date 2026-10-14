# Scratchpad (agent working notes)

Read SPEC.md + this file + `human tasks.md` at the start of every turn; pick up the next unimplemented milestone.

## Milestone status
- [x] M0 Scaffold (local; CI green pending GitHub remote H2)
- [x] M1 Domain and database
- [ ] M2 API and auth
- [ ] M3 MCP
- [ ] M4 Mobile and web
- [ ] M5 Notifications
- [ ] M6 Deploy (needs human: Neon, Fly, DNS, EAS, Apple)
- [ ] M7 Resilience (needs human: archive repo + token)
- [ ] M8 Preview environments (optional)

## Environment notes
- Node v22.17.1, pnpm 10.24.0. Sandbox blocks writes to ~/.npm → use `npm_config_cache=$TMPDIR/npm-cache` for `npm view`.
- gh re-authed by human (H1). origin = https://github.com/mulholo/traitengineer.git; push blocked until gh token has `workflow` scope (H2b). gh/git push need dangerouslyDisableSandbox (keyring).
- Sandbox blocks `.git/hooks` writes: `lefthook install` needed dangerouslyDisableSandbox once (done).
- Export `TURBO_TELEMETRY_DISABLED=1` and `npm_config_store_dir=$TMPDIR/pnpm-store` before turbo/pnpm in sandbox.
- TypeScript pinned to 6.0.x (TS 7 has no JS API; depcruise refuses) — ADR 0020.
- Node 22.17 locally: TS in workspace deps needs `--experimental-strip-types`; Node 24 in CI/Docker — ADR 0022.
- No flyctl / eas CLI installed globally.
- Spec says "Biome" in two places but the stack table + user say oxlint → oxlint is used (ADR 0015, 0021).

## Log

### 2026-10-14 M0
- Scaffold done, `pnpm check` green (10 tasks), boundaries verified with deliberate violations, commit-msg hook verified.
- 4 commits on main. Next: M1 Domain and database.

### 2026-10-14 M1
- contracts/core/db done; 43 tests. `pnpm db:migrate` / `pnpm db:seed` verified against local PGlite (`.pglite/`).
- TODO in M2: seed must also create a Better Auth credential account with a dev-only password (printed).
- Next: M2 API and auth.
