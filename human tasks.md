# Human tasks

Things only you (the human) can do: accounts, secrets, DNS, App Store, dashboards.
Add your notes under each task (e.g. "DONE — value is in 1Password as X", or "blocked because ...").
The agent re-reads this file at the start of every turn.

Status legend: `[ ]` todo · `[x]` done · `[~]` in progress / partial

---

## Needed now (non-blocking for M0–M5, but useful early)

### [x] H1. Re-authenticate the GitHub CLI
`gh auth status` reports the keyring token for `mulholo` is invalid.
- Run: `! gh auth login -h github.com` (in Claude Code, the `!` prefix runs it in this session).
- Notes (agent): DONE 2026-10-14 — logged in as mulholo.
- Notes:

### [ ] H2. Create the GitHub repos and add the remote
- [x] Create `traitengineer` (this repo) on GitHub, and a **private** repo `traitengineer-archive` (used in M7).
- Then: `git remote add origin git@github.com:<you>/traitengineer.git && git push -u origin main`
- Tell me the owner/org name so I can fill in docs and workflows.
- Notes: owner: mulholo. Please add origin etc yourself!

---

## Needed before M6 (deploy) — full step-by-step instructions live in `docs/setup.md`

### [ ] H3. Neon project (`DATABASE_URL` pooled, `DATABASE_URL_DIRECT`)
### [ ] H4. Fly.io account + app (`FLY_API_TOKEN`)
### [ ] H5. Domain + DNS pointed at Fly (`PUBLIC_URL`)
### [ ] H6. Generate `BETTER_AUTH_SECRET`; choose `OWNER_EMAIL` (keep both secret)
### [ ] H7. Expo account + EAS project (`EXPO_TOKEN`, EAS project ID)
### [ ] H8. Apple Developer Program + App Store Connect app record (bundle ID)
### [ ] H9. (Optional) Sentry projects (`SENTRY_DSN` for API and mobile)
### [ ] H10. Create the owner account in prod with `pnpm user:create-owner`
### [ ] H11. Add `/mcp` as a custom connector in Claude and approve OAuth
### [ ] H12. Install TestFlight build, allow notifications
### [ ] H13. Fine-grained GitHub token for the archive repo (`ARCHIVE_REPO`, `ARCHIVE_GITHUB_TOKEN`)
