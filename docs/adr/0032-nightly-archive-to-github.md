# 0032. Nightly archive to a private GitHub repo, restore from export JSON

- Status: accepted
- Date: 2026-10-15

## Context

Section 11: point-in-time recovery plus a nightly human-readable archive in a separate GitHub repo, so losing
either the phone or the database provider never loses the data; M7 asks for a restore script and a CI test.

## Decision

- `archive.nightly` (pg-boss cron, 03:00 Europe/London) writes, per user, the same export the API serves:
  Markdown for reading and JSON for restoring, plus a README, as **one commit** via the Git Data API
  (base tree + new tree + commit + ref update). Git history is the version history. Exports never contain
  emails, credentials, tokens or devices.
- The archive store is a core port (`ArchiveStore`); production uses `createGitHubArchiveStore` with a
  fine-grained token limited to the archive repo; tests use a recording store and a fake `fetch`.
- `restoreExport()` (in `@te/db`) loads an export into a user's account, keeping IDs and timestamps, inside
  one transaction, with `ON CONFLICT DO NOTHING` so it is idempotent. Entries whose tool was deleted before
  the export get a deleted placeholder tool, so evidence is never dropped. `pnpm db:restore <file>` wraps it.
- The round trip (seed → export → JSON → restore into a fresh database → export → equal) is a test in
  `pnpm check`, so it runs in CI on every PR.

## Alternatives considered

- `pg_dump` to object storage: not human-readable and needs another account; Neon PITR already covers
  provider-level recovery.
- Contents API (one request per file): one commit per file and per night is noisy and not atomic.
