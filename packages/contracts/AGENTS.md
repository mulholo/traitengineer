# @te/contracts

Zod schemas and inferred types shared by every surface, plus the **tool-type registry**.

- **Imports:** `zod` only (enforced by dependency-cruiser).
- **Public surface:** `src/index.ts` re-exports domain schemas (`changeTarget`, `tool`, `entry`, `reminder`, ...),
  API request/response schemas, problem codes and `toolTypes` (the registry).
- **Conventions:** schema names are `camelCase` + `Schema` suffix; types are `PascalCase` inferred with `z.infer`.
  Tool types live in `src/tool-types/<type>.ts` and export `{ type, displayName, configSchema, payloadSchema, summarise }`.
- **Test alone:** `pnpm --filter @te/contracts test`.
