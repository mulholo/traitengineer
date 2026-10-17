# Scratchpad (agent working notes)

Read SPEC.md + this file + `human tasks.md` (local only, gitignored — never commit it) at the start of every turn; pick up the next unimplemented milestone.

## Milestone status
- [x] M0 Scaffold (local; CI green pending GitHub remote H2)
- [x] M1 Domain and database
- [x] M2 API and auth (PR #1 merged, main CI green)
- [x] M3 MCP (PR #2 merged after CI green)
- [x] M4 Mobile and web (PR #3; iOS 27 simulator verified in M5)
- [x] M5 Notifications (PR #4; real-device push = human H15)
- [~] M6 Deploy: LIVE at https://traitengineer.com (deploy + smoke green, run 39028743154); TestFlight/OTA wait on H7/H8
- [~] M7 Resilience: merged (PR #6); first real archive commit needs H13
- [~] M8 Preview environments: workflow on feat/m8-previews; needs Neon API key + Fly

## Environment notes
- Node v22.17.1, pnpm 10.24.0. Sandbox blocks writes to ~/.npm → use `npm_config_cache=$TMPDIR/npm-cache` for `npm view`.
- gh re-authed by human (H1). origin = https://github.com/mulholo/traitengineer.git; push blocked until gh token has `workflow` scope (H2b). gh/git push need dangerouslyDisableSandbox (keyring).
- Sandbox blocks `.git/hooks` writes: `lefthook install` needed dangerouslyDisableSandbox once (done).
- Export `TURBO_TELEMETRY_DISABLED=1` and `npm_config_store_dir=$TMPDIR/pnpm-store` before turbo/pnpm in sandbox.
- TypeScript pinned to 6.0.x (TS 7 has no JS API; depcruise refuses) — ADR 0020.
- Node 22.17 locally: TS in workspace deps needs `--experimental-strip-types`; Node 24 in CI/Docker — ADR 0022.
- No flyctl / eas CLI installed globally.
- Spec says "Biome" in two places but the stack table + user say oxlint → oxlint is used (ADR 0015, 0021).

- Workflow from M2 on: branch per milestone (`feat/mN-...`), PR, `gh pr merge --squash --auto` after CI green (main ruleset, H2c).
- CI run 38621192188 on main: green (M0 accepted). pnpm/action-setup@v4 warns about Node 20 — bump when v5 exists.

## Log

### 2026-10-14 M0
- Scaffold done, `pnpm check` green (10 tasks), boundaries verified with deliberate violations, commit-msg hook verified.
- 4 commits on main. Next: M1 Domain and database.

### 2026-10-14 M1
- contracts/core/db done; 43 tests. `pnpm db:migrate` / `pnpm db:seed` verified against local PGlite (`.pglite/`).
- TODO in M2: seed must also create a Better Auth credential account with a dev-only password (printed).
- Next: M2 API and auth.

### 2026-10-14 M2
- Merged as PR #1. API 27 tests; live server verified with curl (needs dangerouslyDisableSandbox to bind ports).
- `human tasks.md` untracked + gitignored per user request (local only).
- Ruleset on main lacks required status check → PR #1 merged before CI finished (CI passed). Asked human to fix (H2c).
- Local dev: `.env` (gitignored) has random BETTER_AUTH_SECRET; `pnpm db:seed` prints demo password.
- Next: M3 MCP on branch feat/m3-mcp.

### 2026-10-14 M3
- MCP tools/prompts + OAuth (jwt + mcp plugins), Inspector CLI verified with PAT. PR #2 merged after waiting for CI.
- Ruleset still lacks required status check (H2c follow-up) → I wait for `gh pr checks --watch` before merging.
- Lost `human tasks.md` once via git pull after untracking; restored. Back it up before checkouts of old commits.
- Next: M4 mobile + web on feat/m4-mobile-web.

### 2026-10-15 M4/M5
- M4 merged (PR #3). iOS 27 crashed at launch: no UIScene adoption → local config plugin with-scene-lifecycle (ADR 0030). Simulator verified.
- M5 merged (PR #4): compare-and-set dispatch, pg-boss on PGlite, Expo push sender, native notifications.
- Gotchas: pnpm overrides pin react/react-native (server peer deps pulled React 19.3.1); jest needs TanStack timers unref'd;
  sandbox: port binding / Xcode / expo install need dangerouslyDisableSandbox; pnpm store /tmp/claude-501/pnpm-store.
- Simulator: API on :3000 + Metro on :8081 started in background this session (kill when done).
- Next: M6 artifacts (Dockerfile, fly.toml, deploy.yml verified via CI docker job), then M7 (export done; archive job + restore).

### 2026-10-15 M6–M8
- M6 merged (#5) with CI docker build+boot; M7 merged (#6); Sentry merged (#7); M8 workflow prepared.
- Everything left needs human accounts: H3–H13 (Neon, Fly, DNS, secrets, EAS, Apple, Sentry, archive token), H15 device push.

### 2026-10-15 wrap-up of agent-side work
- All milestone code merged to main (PRs #1–#9). Sentry (#7) and Maestro flow (#9) close remaining spec items.
- Remaining acceptance items are human-gated: see `human tasks.md` H2c follow-up (required status check),
  H3–H13 (accounts/secrets for M6–M8), H15 (device push), H16 (optional Maestro).
- When the human provides values: deploy (docs/deploy.md), create owner, set CI_PERSONAL_ACCESS_TOKEN, verify
  smoke tests, TestFlight, OTA, Claude connector + weekly_review on real entries, first archive commit, preview PR.

### 2026-10-17
- Ruleset fixed via API (required checks: check + docker, strict; squash only) with the human's OK.
- Maestro installed (~/.maestro, Java via brew); flow passes on iOS 27 Release build; fixed 3 native bugs (PR #11).
- H3 (Neon) + H4 (Fly) done by human → PR #11 merge auto-deployed to Fly; prod healthy on traitengineer.fly.dev.
- Blocked on H5 (DNS for traitengineer.com, GitHub var PUBLIC_URL), then H10 owner, CI PAT, H7/H8 EAS+Apple, H13 archive token.

### 2026-10-17 (later)
- DNS propagated; Let's Encrypt cert issued; deploy + smoke tests green on https://traitengineer.com.
- Waiting on human: H10 owner, CI_PERSONAL_ACCESS_TOKEN, H11 connector, H7/H8 Expo+Apple, H13 archive token,
  NEON_PROJECT_ID secret (previews). `gh run view --log` hangs on big logs: use the jobs API instead.
