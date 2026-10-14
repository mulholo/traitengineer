# @te/db

Drizzle schema, migrations and repository implementations of `@te/core` interfaces.

- **Imports:** `@te/contracts`, `@te/core`, `drizzle-orm`, Postgres drivers.
- **Public surface:** `createDb(url)`, `createTestDb()` (PGlite + migrations), `createRepositories(db)`, schema.
- **Conventions:** schema in `src/schema/`; migrations generated with `pnpm db:generate` into `migrations/` and
  never edited after merge; every query filters by `user_id`.
- **Test alone:** `pnpm --filter @te/db test` (PGlite in-process, no Docker or network).
