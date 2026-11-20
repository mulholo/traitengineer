# syntax=docker/dockerfile:1.7
# One image for API + MCP + worker + the Expo web build (ROLE=web|worker|all). See docs/deploy.md.

ARG NODE_VERSION=24
FROM node:${NODE_VERSION}-slim AS base
ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH CI=1 TURBO_TELEMETRY_DISABLED=1 EXPO_NO_TELEMETRY=1
RUN corepack enable
WORKDIR /app

# ---- Download every package in the lockfile into a store kept in this layer ----
# Only the lockfile, workspace file and root package.json (for its packageManager pin) go in, so the layer (and the CI layer cache) survives source changes and
# the installs below are offline links instead of downloads.
FROM base AS store
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm fetch --store-dir /pnpm/store

# ---- Build the Expo web export (needs the full workspace incl. dev deps) ----
FROM store AS web
COPY . .
RUN pnpm install --frozen-lockfile --offline --store-dir /pnpm/store
RUN pnpm --filter @te/mobile build

# ---- Production dependencies for the API and its workspace packages only ----
FROM store AS prod-deps
COPY . .
# The API runs its TypeScript directly with Node's type stripping, which only works outside node_modules,
# so keep the workspace layout (@te/* are symlinks into packages/) instead of `pnpm deploy` (ADR 0022).
RUN pnpm install --frozen-lockfile --offline --store-dir /pnpm/store --prod --filter "@te/api..." \
      --config.ignore-scripts=true --config.package-import-method=copy \
    && rm -rf packages/*/test apps/api/test

# ---- Runtime ----
FROM node:${NODE_VERSION}-slim AS runtime
ENV NODE_ENV=production ROLE=all PORT=8080 WEB_DIST_DIR=/app/web
WORKDIR /app
# --chown on each COPY instead of a `chown -R` layer, which duplicated all of node_modules in the image.
RUN chown node:node /app
COPY --chown=node:node --from=prod-deps /app/node_modules ./node_modules
COPY --chown=node:node --from=prod-deps /app/package.json /app/pnpm-workspace.yaml ./
COPY --chown=node:node --from=prod-deps /app/packages ./packages
COPY --chown=node:node --from=prod-deps /app/apps/api ./apps/api
COPY --chown=node:node --from=web /app/apps/mobile/dist/web ./web
USER node
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s CMD node -e "fetch('http://127.0.0.1:'+process.env.PORT+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "apps/api/src/main.ts"]
