# @te/core

Domain services and rules. Pure logic: no I/O except through repository interfaces it defines.

- **Imports:** `@te/contracts`, `rrule`, and its own files. Never `@te/db`, `hono`, `drizzle-orm` or `apps/`.
- **Public surface:** service factories (`createChangeTargetService`, ...), repository interfaces
  (`ChangeTargetRepository`, ...), domain errors (`NotFoundError`, `ValidationError`, ...), time helpers.
- **Conventions:** every service method takes `userId` first; services validate tool config/payload against the
  registry; errors are typed `DomainError`s mapped to problem+json by the API.
- **Test alone:** `pnpm --filter @te/core test` (uses in-memory fakes of the repositories only where no DB is needed;
  integration tests that need Postgres live in `@te/db`).
