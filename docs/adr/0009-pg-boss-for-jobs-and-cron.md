# 0009. pg-boss for jobs and cron

- Status: accepted
- Date: 2026-10-14

## Context

Reminders need a reliable scheduler that survives restarts without new infrastructure.

## Decision

pg-boss uses the existing Postgres for queues and cron schedules.

## Alternatives considered

BullMQ (needs Redis); Fly scheduled machines (coarse, no retries); node-cron (not durable).
