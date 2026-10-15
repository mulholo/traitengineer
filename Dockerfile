# syntax=docker/dockerfile:1.7
# One image for API + MCP + worker + the Expo web build (ROLE=web|worker|all). See docs/deploy.md.

ARG NODE_VERSION=24
FROM node:${NODE_VERSION}-slim AS base
ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH CI=1 TURBO_TELEMETRY_DISABLED=1 EXPO_NO_TELEMETRY=1
RUN corepack enable
WORKDIR /app

# ---- Build the Expo web export (needs the full workspace incl. dev deps) ----
FROM base AS web
COPY . .
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile
RUN pnpm --filter @te/mobile build

# ---- Production dependencies for the API and its workspace packages only ----
FROM base AS prod-deps
COPY . .
# The API runs its TypeScript directly with Node's type stripping, which only works outside node_modules,
# so keep the workspace layout (@te/* are symlinks into packages/) instead of `pnpm deploy` (ADR 0022).
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm install --frozen-lockfile --prod --filter "@te/api..." --config.ignore-scripts=true

# ---- Runtime ----
FROM node:${NODE_VERSION}-slim AS runtime
ENV NODE_ENV=production ROLE=all PORT=8080 WEB_DIST_DIR=/app/web
WORKDIR /app
COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=prod-deps /app/package.json /app/pnpm-workspace.yaml ./
COPY --from=prod-deps /app/packages ./packages
COPY --from=prod-deps /app/apps/api ./apps/api
COPY --from=web /app/apps/mobile/dist/web ./web
RUN rm -rf packages/*/test apps/api/test && chown -R node:node /app
USER node
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s CMD node -e "fetch('http://127.0.0.1:'+process.env.PORT+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "apps/api/src/main.ts"]
