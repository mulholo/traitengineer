# 0026. node-postgres driver and the uuid package

- Status: accepted
- Date: 2026-10-14

## Context

The spec names Drizzle and Neon but not a driver or a UUIDv7 generator.

## Decision

- `pg` (node-postgres) with Drizzle's `node-postgres` driver for Neon's pooled connection string. pg-boss
  also uses `pg`, so there is one Postgres client library.
- `uuid` (`v7()`) for app-generated UUIDv7 primary keys and Better Auth IDs. Node's `crypto.randomUUID()` only
  produces v4.

## Alternatives considered

- `@neondatabase/serverless`: designed for edge runtimes; Fly runs long-lived Node processes, where TCP + pg is simpler.
- `postgres` (postgres.js): fine, but pg-boss needs `pg` anyway.
