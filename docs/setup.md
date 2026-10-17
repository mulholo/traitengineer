# Setup

Local development through M5 needs no accounts: PGlite replaces Neon, `pnpm db:seed` creates a local user
with a dev-only password, and push uses an Expo dev build. The human-only steps below are needed for deploy
(M6) and later. Status is tracked locally in `human tasks.md` at the repo root (gitignored, not committed).

## Local development

1. Install Node 24 LTS (`nvm install 24 && nvm use`; `.nvmrc` pins it). Node 22.17+ also works.
2. `corepack enable` (pnpm version comes from `packageManager` in `package.json`).
3. `pnpm i` (installs lefthook git hooks too).
4. `cp .env.example .env` and leave the defaults for local use.
5. `pnpm check` should be green.

## Human-only steps

Do these in order; each lists what it produces and where it goes. **Never commit any value below.** Runtime
values go into Fly secrets (`fly secrets set`), CI values into GitHub Actions secrets.

### 1. GitHub repos (M0, M7)

1. Create the repo `traitengineer` and push this repo to it (`git remote add origin ... && git push -u origin main`).
2. Create a **private** repo `traitengineer-archive` with an initial commit (e.g. a README).
3. Create a fine-grained personal access token limited to `traitengineer-archive` with **Contents: read and write**.
4. Produces: `ARCHIVE_REPO=<owner>/traitengineer-archive`, `ARCHIVE_GITHUB_TOKEN` → Fly secrets.
5. Repo settings for `traitengineer`: protect `main` (require the `CI / check` status), allow squash merge
   only, install the Renovate GitHub app for this repo.

### 2. Neon (M6)

1. Create a Neon project (region near your Fly region, e.g. `aws-eu-west-2` for `lhr`) with the default `main` branch.
2. From "Connection details": copy the **pooled** connection string → `DATABASE_URL`, and the **direct**
   (unpooled) string → `DATABASE_URL_DIRECT`. Both must include `sslmode=require`.
3. Enable point-in-time restore (on by default; check the history retention window).
4. For M8 only: create an API key → `NEON_API_KEY` (GitHub secret) and note the project ID → `NEON_PROJECT_ID`.

### 3. Fly.io (M6)

1. Create an account, **add a payment method** (trial machines are stopped after 5 minutes, which kills the
   reminder worker and makes `fly ssh console` fail with "no started VMs"), and install `flyctl`.
2. `fly apps create traitengineer` (or another name; tell the agent).
3. `fly tokens create deploy -a traitengineer` → `FLY_API_TOKEN` (GitHub secret).

### 4. Domain and DNS (M6)

1. Choose a hostname, e.g. `traitengineer.<your-domain>`.
2. `fly certs add traitengineer.<your-domain> -a traitengineer` and create the DNS records it prints
   (A/AAAA or CNAME to `traitengineer.fly.dev`).
3. Produces: `PUBLIC_URL=https://traitengineer.<your-domain>` (Fly secret + GitHub variable).

### 5. Auth secret and owner email (M2 prod, M6)

1. `openssl rand -base64 32` → `BETTER_AUTH_SECRET` (Fly secret).
2. Choose the owner email → `OWNER_EMAIL` (Fly secret). Treat it as a secret: it must not appear in commits,
   issues or logs.

### 6. Owner account (M6)

After the first deploy: `fly ssh console -a traitengineer -C "pnpm user:create-owner"` and type the password
(12+ characters) at the prompt. Store it in a password manager. There is no "forgot password" email; to reset,
run `pnpm user:set-password` the same way.

### 7. Expo / EAS (M4, M6)

1. Create an Expo account; `npx eas-cli login`; in `apps/mobile` run `npx eas-cli init` to create the project.
2. Produces: EAS project ID (written into `app.config.ts` via `EAS_PROJECT_ID`), and an access token
   `EXPO_TOKEN` (expo.dev → Account settings → Access tokens) → GitHub secret.

### 8. Apple (M5, M6)

1. Enrol in the Apple Developer Program.
2. Choose the bundle ID (placeholder `com.example.traitengineer`; tell the agent the real one).
3. Create the App Store Connect app record. Let EAS manage certificates and the APNs push key
   (`npx eas-cli credentials`).

### 9. Sentry (optional, M6)

Create two projects (Node, React Native) → `SENTRY_DSN` (Fly secret) and `EXPO_PUBLIC_SENTRY_DSN` (EAS env).

### 10. Claude connector (M3 verification in prod)

In Claude: Settings → Connectors → Add custom connector → URL `https://<PUBLIC_URL host>/mcp`. Sign in as the
owner and approve the requested scopes on the consent screen.

### 11. TestFlight (M5, M6)

Install the TestFlight build on your iPhone, sign in, and allow notifications when asked.

## GitHub Actions secrets and variables

Settings → Secrets and variables → Actions. The deploy workflow skips each part until its values exist.

| Name                              | Kind     | Purpose                                                                             |
| --------------------------------- | -------- | ----------------------------------------------------------------------------------- |
| `FLY_API_TOKEN`                   | secret   | `flyctl deploy` in `deploy.yml`                                                     |
| `CI_PERSONAL_ACCESS_TOKEN`        | secret   | Smoke test `GET /v1/me` after deploy (a `read`-scoped TE token)                     |
| `EXPO_TOKEN`                      | secret   | EAS update / build / submit                                                         |
| `CLAUDE_CODE_OAUTH_TOKEN`         | secret   | Claude Code GitHub Action for issues labelled `agent`                               |
| `NEON_API_KEY`, `NEON_PROJECT_ID` | secret   | M8 preview branches                                                                 |
| `FLY_APP`                         | variable | Fly app name (default `traitengineer`); previews are `<FLY_APP>-pr-<n>`             |
| `FLY_ORG`                         | variable | Fly org for preview apps (default `personal`)                                       |
| `PUBLIC_URL`                      | variable | `https://…` production origin, for smoke tests and the app build                    |
| `EAS_PROJECT_ID`                  | variable | From `npx eas-cli init` in `apps/mobile`                                            |
| `IOS_BUNDLE_ID`                   | variable | e.g. `com.yourname.traitengineer` (default placeholder `com.example.traitengineer`) |

## Using the MCP server locally

1. Start the API: `pnpm db:seed` (note the printed dev password) then `pnpm --filter @te/api dev`.
2. Create a personal access token: sign in to the web app and use Settings → Tokens (M4), or with curl:

   ```sh
   TOKEN=$(curl -s -X POST localhost:3000/api/auth/sign-in/email -H 'content-type: application/json' \
     -d '{"email":"demo@traitengineer.local","password":"<dev password>"}' | jq -r .token)
   curl -s -X POST localhost:3000/v1/tokens -H "authorization: Bearer $TOKEN" \
     -H 'content-type: application/json' -d '{"name":"claude code","scope":"write"}' | jq -r .token
   ```

3. **Claude Code:** `claude mcp add --transport http traitengineer http://localhost:3000/mcp --header "Authorization: Bearer te_pat_..."`
   (for production use your `PUBLIC_URL` instead of localhost).
4. **MCP Inspector (UI):** `npx @modelcontextprotocol/inspector`, choose transport "Streamable HTTP", URL
   `http://localhost:3000/mcp`, and add the header `Authorization: Bearer te_pat_...`.
   **CLI:** `npx @modelcontextprotocol/inspector --cli http://localhost:3000/mcp --transport http --header "Authorization: Bearer te_pat_..." --method tools/list`
   (needs Node ≥ 22.19).

OAuth (used by Claude custom connectors) needs no token: the client discovers
`/.well-known/oauth-protected-resource/mcp`, registers itself, and sends you to `/sign-in` and `/consent`.
