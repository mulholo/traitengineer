# 0019. GitHub Actions and Renovate

- Status: accepted
- Date: 2026-10-14

## Context

Every PR is gated; main deploys automatically; dependencies stay current.

## Decision

GitHub Actions for CI/deploy/preview; Renovate with grouped weekly updates.

## Alternatives considered

CircleCI (another account); Dependabot (weaker grouping).
