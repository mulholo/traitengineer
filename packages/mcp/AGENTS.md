# @te/mcp

MCP tool and prompt definitions (official TypeScript SDK). Calls `@te/core` services directly, so agents get the
same validation and rules as the app.

- **Imports:** `@te/contracts`, `@te/core`, `@modelcontextprotocol/sdk`, `zod`. Never `@te/db` or `hono`
  (tests may use `@te/db` to wire services to PGlite).
- **Public surface:** `createMcpServer({ services, principal, now? })` → an SDK `McpServer` bound to one caller.
  The API builds one per request (stateless). `SERVER_INSTRUCTIONS` is the domain primer sent to clients.
- **Tools:** read — `list_change_targets`, `get_change_target`, `list_entries`, `summarise_progress`;
  write (need `write` scope) — `log_entry` (sets `source=mcp`, server-generated `clientId`),
  `create_change_target` (also attaches an evidence log), `update_change_target`.
  **Prompts:** `weekly_review` (last 7 days of progress), `define_change_target` (interview).
- **Conventions:** tools are task-shaped, not CRUD mirrors; descriptions are written for an LLM; every tool returns
  `structuredContent` plus a short text rendering; domain errors become `isError` results with field paths. When
  adding a tool type, update tool descriptions here (they embed each type's `description` from the registry).
- **Test alone:** `pnpm --filter @te/mcp test` (SDK `InMemoryTransport` client against PGlite-wired services:
  every tool, scopes, validation errors, cross-user isolation, prompts).
