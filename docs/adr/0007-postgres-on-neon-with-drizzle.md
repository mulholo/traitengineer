# 0007. Postgres on Neon with Drizzle

- Status: accepted
- Date: 2026-10-14

## Context

We need a managed relational DB with point-in-time recovery and branching for previews.

## Decision

Neon Postgres; Drizzle ORM for typed queries; `drizzle-kit generate` for committed SQL migrations.

## Alternatives considered

Prisma (heavier runtime, codegen); Supabase (more than we need); SQLite (no PITR/branching).
