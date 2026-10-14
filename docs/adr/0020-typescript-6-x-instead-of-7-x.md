# 0020. TypeScript 6.x instead of 7.x

- Status: accepted
- Date: 2026-10-14

## Context

The spec says use the latest stable release. TypeScript 7.0 (the native Go port) is latest, but it does not yet publish a stable JS compiler API. dependency-cruiser refuses it (`typescript >=2 <7`), and openapi-typescript and Expo tooling also load the TS API.

## Decision

Pin `typescript@~6.0` (latest 6.x). Revisit when dependency-cruiser and openapi-typescript support 7.x; Renovate will raise it.

## Alternatives considered

Install both 6 and 7 (two compilers, confusing); drop dependency-cruiser (spec requires it).
