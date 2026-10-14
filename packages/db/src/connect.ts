import { fileURLToPath } from "node:url";
import { createPgliteDb, createPostgresDb, migrateDb, type DbHandle } from "./client.ts";

/** Repo-root `.pglite/` directory used for local development when no DATABASE_URL is set. */
export const defaultPgliteDir = fileURLToPath(new URL("../../../.pglite", import.meta.url));

/**
 * Connect using env: Postgres when `url` is set, otherwise a persistent PGlite directory (local dev).
 * PGlite databases are migrated on open since there is no separate release step locally.
 */
export async function connectFromEnv(env: {
  url?: string | undefined;
  pgliteDir?: string | undefined;
}): Promise<DbHandle> {
  if (env.url) return createPostgresDb(env.url);
  const handle = await createPgliteDb(env.pgliteDir || defaultPgliteDir);
  await migrateDb(handle);
  return handle;
}
