# 0035. Remove display name

- Status: accepted
- Date: 2026-11-20

## Context

The owner's display name (`users.display_name`, Better Auth's `name` field) was returned by `GET /v1/me`,
editable through `PATCH /v1/me` and Settings → Account, and defaulted to `Owner` when `pnpm user:create-owner`
made the account. Trait Engineer has exactly one owner, the name was shown nowhere else, and the owner no
longer wants it.

## Decision

- Remove `displayName` from the `Me` and `UpdateMe` contracts, the core `User` port, the DB mapper, the
  `/v1/me` route, the Settings field and the seed/test helpers. `PATCH /v1/me` now only takes `timezone`;
  an unknown `displayName` key is ignored like any other unknown key.
- **Keep the `users.display_name` column.** Better Auth's core user model declares `name` as a required
  string field (`@better-auth/core` `getAuthTables`), and its adapter writes it on every user create. Dropping
  the column would break `createOwner`, sign-up in tests and Better Auth's own schema expectations, and
  plugins (no option removes a core field). The column stays `text NOT NULL DEFAULT ''`, `createOwner` writes
  the constant `Owner`, and the Drizzle key and `user.fields.name` mapping are unchanged.
- No migration: the schema is unchanged, so `drizzle-kit generate` produces nothing and deploys run no DDL.

## Consequences

The value is still stored and Better Auth still exposes it to OAuth clients granted the `profile` scope
(OIDC `name` claim) and in its own `/api/auth/get-session` response; the consent screen now describes that
scope as "basic account profile". The change is fully reversible by reverting the commit, since no data was
touched. If Better Auth ever makes `name` optional, a later migration can drop the column.
