# 0008. PGlite as the test database

- Status: accepted
- Date: 2026-10-14

## Context

`pnpm check` must run without Docker or network.

## Decision

PGlite (in-process WASM Postgres) runs the same migrations in tests.

## Alternatives considered

Docker Postgres (violates the no-Docker rule); SQLite (dialect drift).
