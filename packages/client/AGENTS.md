# @te/client

Typed API client generated from `/openapi.json` with `openapi-typescript` + `openapi-fetch`.

- **Do not hand-edit** `src/generated/`. Regenerate with `pnpm gen:client` from the repo root; CI fails on diff.
- **Public surface:** `createApiClient({ baseUrl, getToken })` and the generated `paths` types.
- **Test alone:** `pnpm --filter @te/client test`.
