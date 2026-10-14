# 0024. Auth tables and sign-in throttling

- Status: accepted
- Date: 2026-10-14

## Context

The spec requires every table to carry `user_id`, Better Auth to own identity, and failed sign-ins to be rate
limited per IP **and per email** (5 per 15 minutes, then exponential backoff) with storage that survives
restarts. Better Auth's built-in limiter keys only on IP + path and has no backoff.

## Decision

- Better Auth tables live in `packages/db/src/schema/auth.ts` with UUIDv7 IDs (Better Auth's `generateId`).
  `sessions`, `accounts` and `passkeys` carry `user_id`. `verifications` and `rate_limits` are Better Auth
  bookkeeping keyed by identifier/IP, not user data, so they have no `user_id`.
- A `login_attempts` table (keys `email:<sha256>` and `ip:<address>`, never a plaintext email) backs a core
  `LoginThrottle`: 5 failures in the window lock the key for 15 minutes; each further failure doubles the lock;
  a quiet window after the lock resets it; success clears it. The API wraps `POST /api/auth/sign-in/email` to
  check before and record after. Unknown and known emails are treated identically.
- Better Auth's own limiter (database storage) stays on in production as a general backstop.
- The client IP comes only from `CLIENT_IP_HEADER` (default `Fly-Client-IP`, which Fly sets and clients cannot
  spoof through the proxy); `X-Forwarded-For` is never trusted.

## Alternatives considered

- Better Auth `customStorage`: cannot see the email, and the key format is internal.
- In-memory limiter: lost on restart/deploy, which the spec forbids.
