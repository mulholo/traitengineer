# 0003. Hono API server with zod-openapi and Scalar

- Status: accepted
- Date: 2026-10-14

## Context

We need a small, fast HTTP server whose routes produce an OpenAPI document.

## Decision

Hono on Node via `@hono/node-server`; routes declared with `@hono/zod-openapi`; Scalar serves `/docs`.

## Alternatives considered

Fastify + plugins (more ceremony); Express (no first-class OpenAPI); tRPC (not REST/OpenAPI-native).
