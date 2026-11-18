# 0033. Remove the nightly GitHub archive

- Status: accepted (supersedes the archive half of 0032)
- Date: 2026-10-17

## Context

ADR 0032 added `archive.nightly`, committing a Markdown + JSON export to a private GitHub repo every night.
For a single-owner app it needs a second repo, a fine-grained token to create and rotate, and a job to
monitor, to protect against a risk Neon point-in-time recovery and manual exports already cover. The owner
judged it overkill.

## Decision

- Remove `archive.nightly`, the `ArchiveStore` port, the GitHub archive store, `ARCHIVE_REPO` and
  `ARCHIVE_GITHUB_TOKEN`.
- On start, the worker unschedules `archive.nightly` and deletes its queue, because pg-boss keeps cron
  schedules in the database and the production database already has one.
- Keep everything else from 0032: `GET /v1/export` (JSON or Markdown, also the share sheet), `restoreExport()`
  and `pnpm db:restore`, and the round-trip test in CI.

## Consequences

Backups are Neon point-in-time recovery plus whatever exports the owner takes by hand. Restoring is
unchanged: `pnpm db:restore <export.json>`.
