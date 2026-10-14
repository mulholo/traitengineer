# 0018. Hosting: Fly.io, Neon, EAS, static web from the API

- Status: accepted
- Date: 2026-10-14

## Context

Cheap, simple hosting for a single-user app with background jobs.

## Decision

One Docker image on Fly (ROLE=all) serving API, MCP, worker and the Expo web export; Neon for Postgres; EAS for native builds, submit and OTA updates.

## Alternatives considered

Vercel (no long-running worker); Render/Railway (similar; Fly chosen in spec); separate static host (cross-origin cookies).
