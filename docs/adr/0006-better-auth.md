# 0006. Better Auth

- Status: accepted
- Date: 2026-10-14

## Context

One identity system for app sessions, mobile bearer tokens, passkeys and MCP OAuth.

## Decision

Better Auth with email+password (sign-up disabled), passkeys, bearer, Expo plugin and an OAuth provider for MCP. Password hashing uses Better Auth's default scrypt (salted, memory-hard); no plaintext or hash is ever returned or logged.

## Alternatives considered

Auth.js (weaker OAuth-provider story); Clerk/Auth0 (hosted, cost, less control); argon2id (needs a native module; scrypt is adequate and built in).
