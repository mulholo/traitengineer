# @te/mcp

MCP tool and prompt definitions (official TypeScript SDK). Calls `@te/core` services directly.

- **Imports:** `@te/contracts`, `@te/core`, `@modelcontextprotocol/sdk`. Never `@te/db` or `hono`.
- **Public surface:** `createMcpServer({ services, auth })` returning an SDK `McpServer`.
- **Conventions:** tools are task-shaped (not CRUD mirrors); descriptions are written for an LLM; every tool
  returns `structuredContent` plus a short text rendering; write tools require the `write` scope.
- **Test alone:** `pnpm --filter @te/mcp test` (SDK in-memory client against PGlite-wired services).
