# 0035. Remove evidence-log tags

- Status: accepted (amends 0023)
- Date: 2026-11-20

## Context

0023 gave evidence-log entries a `tags` field (≤ 10 strings, default `[]`), and `GET /v1/entries` and the MCP
`list_entries` tool could filter by `tag`. The owner no longer wants tags.

## Decision

- Remove `tags` from `evidenceLogPayloadSchema`, the `tag` filter from `listEntriesQuerySchema`, `EntryFilter`,
  the entry repository, the REST route and the MCP `list_entries` tool, and the Tags field and labels from the
  mobile quick-log form, entry row and entry detail.
- Tags lived inside `entries.payload` (jsonb), not in their own column or table, so there is no DDL. Migration
  `0004_drop_entry_tags` strips the `tags` key from every stored payload, soft-deleted rows included.
- Older clients that still send `tags` keep working: the payload schema strips unknown keys, so the field is
  dropped on write, and an unknown `tag` query parameter is ignored.

## Consequences

Existing tag values are deleted by the migration and are not recoverable from the app; Neon point-in-time
recovery (0034) is the only way back to them.
