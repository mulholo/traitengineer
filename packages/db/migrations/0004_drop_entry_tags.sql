-- Evidence-log tags are retired (ADR 0036). They lived in the entries.payload jsonb, not in a column, so this
-- strips the key from every stored payload, soft-deleted rows included. Idempotent; no schema change.
UPDATE "entries" SET "payload" = "payload" - 'tags' WHERE "payload" ? 'tags';
