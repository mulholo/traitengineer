# 0034. Remove export and restore

- Status: accepted (supersedes the export and restore parts of 0032 and 0033)
- Date: 2026-11-20

## Context

0033 kept `GET /v1/export` (JSON or Markdown), the Settings → Export section (share sheet on native, download
on web), `restoreExport()` and `pnpm db:restore`. The owner no longer wants the export feature. Restore exists
only to load an export back in, so it has no input once export is gone.

## Decision

- Remove `GET /v1/export`, the `Export` contract, the core export service and Markdown renderer, the Settings
  → Export section and the mobile share/download helpers.
- Remove `restoreExport()`, the `db:restore` CLI and scripts, and the round-trip test.
- No schema change: export only read existing tables, so there is no migration.

## Consequences

Backups are Neon point-in-time recovery only; there is no provider-independent restore path. Export files already downloaded can no longer be loaded
by the app's tooling; `restoreExport()` remains in git history if it is ever needed.
