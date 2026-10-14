# 0014. Zod env validation per app

- Status: accepted
- Date: 2026-10-14

## Context

Misconfiguration should fail at boot, not at first request.

## Decision

Each app parses `process.env` with a Zod schema in `src/env.ts` and exits on failure.

## Alternatives considered

envalid / t3-env (extra dependency for the same thing).
