# @te/db

Drizzle schema, migrations and repository implementations of `@te/core` interfaces.

- **Imports:** `@te/contracts`, `@te/core`, `drizzle-orm`, Postgres drivers.
- **Public surface:** `createPostgresDb(url)`, `createPgliteDb(dir?)`, `connectFromEnv()`, `migrateDb()`,
  `createTestDb()` (in-memory PGlite + migrations), `createRepositories(db)`, `seedDemo(db)`, `insertUser()`, schema.
- **Integration tests:** `test/harness.ts` → `useHarness()` gives one migrated PGlite per file plus a controllable
  clock; isolate tests by creating a fresh user with `h.newUser()`.
- **Defence in depth:** child tables use composite FKs `(user_id, parent_id) → parent(user_id, id)`, so a row can
  never reference another user's parent even if a query forgets to scope.
- **Conventions:** schema in `src/schema/`; migrations generated with `pnpm db:generate` into `migrations/` and
  never edited after merge; every query filters by `user_id`.
- **Test alone:** `pnpm --filter @te/db test` (PGlite in-process, no Docker or network).
