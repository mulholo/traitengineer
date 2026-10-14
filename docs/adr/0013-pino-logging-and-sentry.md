# 0013. pino logging and Sentry

- Status: accepted
- Date: 2026-10-14

## Context

Structured logs with request and user IDs; error reporting in production.

## Decision

pino JSON logs; Sentry for API and mobile, enabled only when `SENTRY_DSN` is set.

## Alternatives considered

console logging (unstructured); Datadog (cost).
