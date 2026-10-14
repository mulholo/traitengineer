// Package boundary rules from SPEC section 3. Part of `pnpm check`.
/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: "contracts-only-zod",
      comment: "packages/contracts may import only zod (and its own files).",
      severity: "error",
      from: { path: "^packages/contracts/src" },
      to: {
        dependencyTypesNot: ["local"],
        pathNot: ["^packages/contracts/", "node_modules/zod/", "node_modules/\\.pnpm/zod@"],
        path: ".+",
      },
    },
    {
      name: "core-no-infrastructure",
      comment: "packages/core may import contracts and its own files only (no db, hono, drizzle, apps).",
      severity: "error",
      from: { path: "^packages/core/src" },
      to: {
        pathNot: [
          "^packages/core/",
          "^packages/contracts/",
          "node_modules/(\\.pnpm/)?(rrule|zod|uuid)",
          "^node:",
        ],
        path: ".+",
        dependencyTypesNot: ["core"],
      },
    },
    {
      name: "db-imports",
      comment: "packages/db may import contracts and core, never mcp, client or apps.",
      severity: "error",
      from: { path: "^packages/db/src" },
      to: { path: "^(packages/(mcp|client)|apps)/" },
    },
    {
      name: "mcp-no-db-or-hono",
      comment: "packages/mcp may import contracts and core; never db or hono.",
      severity: "error",
      from: { path: "^packages/mcp/src" },
      to: { path: ["^packages/(db|client)/", "^apps/", "node_modules/(\\.pnpm/)?(hono|@hono|drizzle-orm)"] },
    },
    {
      name: "mobile-only-contracts-and-client",
      comment: "apps/mobile may import @te/contracts and @te/client only from the workspace.",
      severity: "error",
      from: { path: "^apps/mobile/" },
      to: { path: ["^packages/(core|db|mcp)/", "^apps/api/"] },
    },
    {
      name: "no-app-to-app",
      comment: "No app imports another app.",
      severity: "error",
      from: { path: "^apps/([^/]+)/" },
      to: { path: "^apps/([^/]+)/", pathNot: "^apps/$1/" },
    },
    {
      name: "packages-never-import-apps",
      severity: "error",
      from: { path: "^packages/" },
      to: { path: "^apps/" },
    },
    {
      name: "no-circular",
      severity: "error",
      from: {},
      to: { circular: true },
    },
  ],
  options: {
    doNotFollow: { path: "node_modules" },
    exclude: { path: ["/dist/", "/\\.tsbuild/", "/\\.expo/", "node_modules", "/ios/", "/android/"] },
    tsPreCompilationDeps: true,
    combinedDependencies: true,
    enhancedResolveOptions: {
      exportsFields: ["exports"],
      conditionNames: ["import", "require", "node", "default", "types"],
      extensions: [".ts", ".tsx", ".js", ".mjs", ".cjs", ".json"],
    },
    preserveSymlinks: false,
  },
};
