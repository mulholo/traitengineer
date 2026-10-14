# 0017. dependency-cruiser for boundaries

- Status: accepted
- Date: 2026-10-14

## Context

Package boundaries in the spec must be machine-enforced.

## Decision

`.dependency-cruiser.cjs` encodes section 3's rules; `pnpm boundaries` runs in `pnpm check`.

## Alternatives considered

ESLint import rules (we do not use ESLint); TS project references alone (do not express 'only zod').
