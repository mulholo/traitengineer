# 0002. Zod for validation and contracts

- Status: accepted
- Date: 2026-10-14

## Context

Requests, MCP inputs, env, forms and JSONB tool payloads all need runtime validation with inferred types.

## Decision

Zod 4 schemas in `packages/contracts` are the single source of truth; types are inferred with `z.infer`.

## Alternatives considered

Valibot, ArkType (smaller ecosystems for OpenAPI and form resolvers); hand-written types (no runtime checks).
