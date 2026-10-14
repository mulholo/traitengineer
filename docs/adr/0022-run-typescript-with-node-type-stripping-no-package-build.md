# 0022. Run TypeScript with Node type stripping, no package build

- Status: accepted
- Date: 2026-10-14

## Context

Internal packages need to be consumable by the API at runtime, by Vitest, drizzle-kit and Metro, without a build step per package.

## Decision

Packages export `src/index.ts`. Code is limited to erasable syntax (`erasableSyntaxOnly`) and uses `.ts` import extensions so Node runs it directly (native in Node 24 LTS; `--experimental-strip-types` on 22.x). `tsc -b` is used only for typechecking (declarations go to gitignored `.tsbuild/`). Shared JS config (the Vitest preset) is plain JS so Node can load it from config files.

## Alternatives considered

tsx/esbuild bundling (extra dependency and build step); compiling every package to `dist/` (slower inner loop, stale-build bugs).
