# 0001. Monorepo with pnpm workspaces and Turborepo

- Status: accepted
- Date: 2026-10-14

## Context

Several surfaces (API, MCP, mobile, jobs) share one domain and contracts.

## Decision

pnpm workspaces for packages, Turborepo for task orchestration and caching. Workspace packages export TypeScript source directly (see ADR 0024).

## Alternatives considered

Nx (heavier, more opinionated); separate repos (contract drift); npm/yarn workspaces (slower, weaker strictness).
