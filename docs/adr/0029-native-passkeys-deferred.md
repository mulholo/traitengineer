# 0029. Passkeys on the web app first; native passkeys deferred

- Status: accepted
- Date: 2026-10-14

## Context

Section 6 says passkeys can be registered from settings and used instead of the password. On the web,
Better Auth's passkey client uses the browser's WebAuthn API. On iOS, passkeys need a native WebAuthn module
plus an Associated Domains entitlement (`webcredentials:<host>`) and an `apple-app-site-association` file on
the production domain, none of which exist before M6 (domain, Apple account).

## Decision

- v1 supports passkey registration, listing, deletion and sign-in in the web app (`/sign-in`, `/settings`).
- On native the passkey button is hidden and Settings explains that passkeys live in the web app.
- Revisit after M6: add a native passkey module (new dependency, new ADR), `webcredentials` in
  `ios.associatedDomains`, and serve `/.well-known/apple-app-site-association` from the API.

## Alternatives considered

- Ship native passkeys now: cannot be verified without the production domain and Apple team ID.
