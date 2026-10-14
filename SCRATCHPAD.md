# Scratchpad (agent working notes)

Read SPEC.md + this file + `human tasks.md` at the start of every turn; pick up the next unimplemented milestone.

## Milestone status
- [ ] M0 Scaffold
- [ ] M1 Domain and database
- [ ] M2 API and auth
- [ ] M3 MCP
- [ ] M4 Mobile and web
- [ ] M5 Notifications
- [ ] M6 Deploy (needs human: Neon, Fly, DNS, EAS, Apple)
- [ ] M7 Resilience (needs human: archive repo + token)
- [ ] M8 Preview environments (optional)

## Environment notes
- Node v22.17.1, pnpm 10.24.0. Sandbox blocks writes to ~/.npm → use `npm_config_cache=$TMPDIR/npm-cache` for `npm view`.
- `gh` token invalid; no git remote yet (see human tasks H1/H2).
- No flyctl / eas CLI installed globally.
- Spec says "Biome" in two places but the stack table + user say oxlint → oxlint is used (ADR 0015, 0021).

## Log
