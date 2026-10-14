# @te/config

Shared tooling presets. No runtime code.

- `tsconfig.base.json`: strict TS settings every package extends (`strict`, `noUncheckedIndexedAccess`,
  `exactOptionalPropertyTypes`, `erasableSyntaxOnly`, `.ts` import extensions, project references via `composite`).
- `vitest.preset.ts`: `vitestPreset`, merged into each package's `vitest.config.ts` with `mergeConfig`.

Conventions: changing a preset affects every package; run `pnpm check` from the root afterwards.
