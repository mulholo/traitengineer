# 0015. oxlint for linting

- Status: accepted
- Date: 2026-10-14

## Context

Linting must be fast enough to run on every commit and in `pnpm check`.

## Decision

oxlint with correctness + suspicious categories as errors and `--deny-warnings`. Formatting is ADR 0023.

## Alternatives considered

ESLint (slow, heavy config); Biome (the spec mentions it in passing, but the stack table and the owner chose oxlint).
