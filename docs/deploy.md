# Deploy runbook

Production is one Fly.io app running one Docker image (`Dockerfile`) with `ROLE=all`: the Hono API, MCP,
the pg-boss worker and the Expo web export, all on one origin. Postgres is Neon. The iOS app ships through
EAS (builds, TestFlight submit, OTA updates). Prerequisites are the human steps in `docs/setup.md`.

## How a deploy happens

Merging to `main` runs `.github/workflows/deploy.yml`:

1. **API:** `flyctl deploy --remote-only`. Fly builds the image remotely, then runs the **release command**
   `node packages/db/src/cli/migrate.ts` in a temporary machine against `DATABASE_URL_DIRECT`. If migrations
   fail, the deploy stops and the old machines keep serving.
2. **Smoke test:** waits for `GET /health` to report `db: ok`, calls `GET /v1/me` with
   `CI_PERSONAL_ACCESS_TOKEN`, and checks that `/mcp` answers 401 without credentials.
3. **Mobile:** `expo/expo-github-action/continuous-deploy-fingerprint` compares the native fingerprint
   (`runtimeVersion: { policy: "fingerprint" }`) with existing EAS builds. If the fingerprint matches, it
   publishes an **OTA update** to the `production` channel. Otherwise it starts a new **production build**
   and auto-submits it to TestFlight. OTA updates only reach binaries with the same fingerprint.

Both jobs skip themselves until their secrets exist, so the workflow stays green before setup is finished.

## First deploy (once the human steps are done)

```sh
fly apps create traitengineer                       # or your name; set the GitHub variable FLY_APP to match
fly secrets set -a traitengineer \
  DATABASE_URL='postgres://…-pooler…/neondb?sslmode=require' \
  DATABASE_URL_DIRECT='postgres://…/neondb?sslmode=require' \
  BETTER_AUTH_SECRET="$(openssl rand -base64 32)" \
  PUBLIC_URL='https://traitengineer.example.com' \
  OWNER_EMAIL='you@example.com'
fly deploy --remote-only -a traitengineer           # builds, migrates, starts one machine
fly ssh console --pty -a traitengineer -C "node /app/apps/api/src/cli/create-owner.ts"   # type the password at the prompt
```

Then create a `read`-scoped personal access token in Settings → Tokens and save it as the GitHub secret
`CI_PERSONAL_ACCESS_TOKEN` for the smoke test.

## Configuration

| Name                                                           | Where                        | Notes                                                                   |
| -------------------------------------------------------------- | ---------------------------- | ----------------------------------------------------------------------- |
| `DATABASE_URL`                                                 | Fly secret                   | Neon **pooled** URL, used by the app                                    |
| `DATABASE_URL_DIRECT`                                          | Fly secret                   | Neon **direct** URL, used by migrations and pg-boss (session features)  |
| `BETTER_AUTH_SECRET`                                           | Fly secret                   | 32+ random bytes; rotating it signs everyone out                        |
| `PUBLIC_URL`                                                   | Fly secret + GitHub variable | `https://…`, no trailing slash; also the MCP resource and passkey RP ID |
| `OWNER_EMAIL`                                                  | Fly secret                   | Only read by `user:create-owner` / `user:set-password`                  |
| `EXPO_ACCESS_TOKEN`                                            | Fly secret (optional)        | Only if Expo push security is enabled for the project                   |
| `SENTRY_DSN`                                                   | Fly secret (optional)        |                                                                         |
| `NODE_ENV`, `ROLE`, `PORT`, `WEB_DIST_DIR`, `CLIENT_IP_HEADER` | `fly.toml` `[env]`           |                                                                         |
| `FLY_API_TOKEN`, `EXPO_TOKEN`, `CI_PERSONAL_ACCESS_TOKEN`      | GitHub secrets               |                                                                         |
| `FLY_APP`, `PUBLIC_URL`, `EAS_PROJECT_ID`, `IOS_BUNDLE_ID`     | GitHub variables             |                                                                         |

`auto_stop_machines` is off and `min_machines_running = 1`: the reminder worker shares the process, so a
machine must always be running for reminders to fire.

## Routine operations

- **Logs:** `fly logs -a traitengineer` (JSON lines with `requestId` and `userId`).
- **Roll back the API:** `fly releases -a traitengineer`, then `fly deploy --image <previous image ref>`.
  Migrations are forward-only and are never edited once applied. To undo a schema change, write a new
  migration.
- **Roll back the app:** `eas update:republish --channel production` with the previous update group, or
  roll back in the EAS dashboard.
- **Reset the owner password:** `fly ssh console --pty -a traitengineer -C "node /app/apps/api/src/cli/set-password.ts"`.
  This revokes every session.
- **Run a job now:** reminders dispatch every minute. To check worker health, look for `worker started`
  and `reminders dispatched` in the logs.
- **Database restore (provider-level):** Neon point-in-time restore (branch from a timestamp, then point
  `DATABASE_URL*` at it).
- **Restore from an export (provider-independent):** take an export with `GET /v1/export` or Settings →
  Export (JSON). To rebuild anywhere: deploy, create the owner (`user:create-owner`), then
  `fly ssh console -C "node /app/apps/api/src/cli/restore.ts /tmp/traitengineer.json"` after copying the JSON in
  (`fly ssh sftp shell`), or locally `OWNER_EMAIL=… DATABASE_URL_DIRECT=… pnpm db:restore traitengineer.json`.
  Restores keep IDs and timestamps and are idempotent. The round trip (export → restore → export) runs in CI
  (`packages/db/test/restore.test.ts`).

## Local production-like run

```sh
docker build -t traitengineer .
docker run --rm -p 8080:8080 -e NODE_ENV=development -e BETTER_AUTH_SECRET="$(openssl rand -base64 32)" \
  -e PUBLIC_URL=http://localhost:8080 traitengineer      # PGlite inside the container; open http://localhost:8080
```

## Preview environments (optional, M8)

`.github/workflows/preview.yml` gives each PR its own environment once `NEON_API_KEY`, `NEON_PROJECT_ID` and
`FLY_API_TOKEN` are set:

- a Neon branch `preview/pr-<n>` of `main` (so the owner signs in with their normal password),
- a Fly app `<FLY_APP>-pr-<n>` deployed from the PR (migrations run on the branch, so schema changes are tested
  against a copy of real data),
- an EAS update on the `preview` channel pointed at that API (when `EAS_PROJECT_ID` is set),
- a sticky PR comment with the links.

Closing the PR deletes the Fly app and the Neon branch. Previews use real data copied from production:
treat their URLs as private.
