# 0005. Official MCP TypeScript SDK over Streamable HTTP

- Status: accepted
- Date: 2026-10-14

## Context

Agents (Claude etc.) should read and write data with the same rules as the app.

## Decision

`@modelcontextprotocol/sdk` with stateless Streamable HTTP mounted at `/mcp`.

## Alternatives considered

SSE transport (deprecated); a separate MCP process (duplicated wiring).
