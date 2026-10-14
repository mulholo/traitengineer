# 0011. rrule with IANA time zones

- Status: accepted
- Date: 2026-10-14

## Context

Reminders recur (daily, weekdays, every N hours) and must be correct across DST.

## Decision

Store RFC 5545 rrules with an IANA zone per reminder; compute `next_fire_at` with `rrule` in the reminder's zone. UI exposes presets only.

## Alternatives considered

Cron strings (no time-zone semantics); hand-rolled recurrence (bug-prone).
