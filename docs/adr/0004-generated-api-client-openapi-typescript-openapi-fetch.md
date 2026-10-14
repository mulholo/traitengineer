# 0004. Generated API client (openapi-typescript + openapi-fetch)

- Status: accepted
- Date: 2026-10-14

## Context

Mobile/web and scripts must call the API with types that match the server exactly.

## Decision

`pnpm gen:client` builds `/openapi.json` in-process and generates types with `openapi-typescript`; calls go through `openapi-fetch`. CI fails on diff.

## Alternatives considered

Orval / openapi-generator (heavier output); importing server types directly (breaks boundaries).
