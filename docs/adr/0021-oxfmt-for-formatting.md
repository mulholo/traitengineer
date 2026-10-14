# 0021. oxfmt for formatting

- Status: accepted
- Date: 2026-10-14

## Context

The spec says 'oxlint: lint and format' (and mentions Biome in passing). oxlint itself does not format; the oxc project ships a separate formatter, `oxfmt`.

## Decision

Use `oxfmt` (same toolchain, Prettier-compatible output). `pnpm check` runs `oxfmt --check`; lefthook formats staged files.

## Alternatives considered

Biome (second toolchain); Prettier (slower, another config).
