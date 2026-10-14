# 0025. Single owner bootstrap and password handling

- Status: accepted
- Date: 2026-10-14

## Context

v1 has exactly one account. Knowing the owner's email must never be enough to create an account or sign in.

## Decision

- `emailAndPassword.disableSignUp` is on outside `NODE_ENV=test`, and the API answers every
  `/api/auth/sign-up/*` route with `403` before Better Auth sees it.
- The owner is created by `pnpm user:create-owner` (`apps/api/src/cli/create-owner.ts`): it reads
  `OWNER_EMAIL` from env, prompts for the password twice on the TTY without echo (refusing non-TTY stdin),
  refuses if any user exists, and creates the user plus a `credential` account through Better Auth's internal
  adapter so the hash uses Better Auth's configured hasher (scrypt, the default; salted and memory-hard).
- `pnpm user:set-password` resets the hash and deletes every session. There is no email-based recovery.
- `POST /api/auth/change-password` is wrapped so `revokeOtherSessions` is always `true`.
- Minimum password length is 12 (Better Auth `minPasswordLength`).
- `POST /api/test/session` exists only when `NODE_ENV=test` (asserted by a test that builds the production app).

## Alternatives considered

- argon2id via `@node-rs/argon2`: a native dependency for marginal benefit over scrypt for a single account.
- Allowing sign-up until the first user exists: a race on first deploy would let anyone claim the instance.
