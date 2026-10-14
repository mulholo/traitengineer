# 0016. Vitest

- Status: accepted
- Date: 2026-10-14

## Context

Fast TypeScript-native tests for packages and the API.

## Decision

Vitest with a shared preset in `packages/config`. Mobile component tests use jest-expo (Expo's supported runner).

## Alternatives considered

Jest everywhere (slower TS transform); node:test (thin ecosystem).
