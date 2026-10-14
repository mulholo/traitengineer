import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import { drizzle as drizzleNodePg } from "drizzle-orm/node-postgres";
import { migrate as migrateNodePg } from "drizzle-orm/node-postgres/migrator";
import { drizzle as drizzlePglite } from "drizzle-orm/pglite";
import { migrate as migratePglite } from "drizzle-orm/pglite/migrator";
import { Pool } from "pg";
import * as schema from "./schema/index.ts";

export type Schema = typeof schema;
/** Driver-agnostic Drizzle database (node-postgres in prod, PGlite in tests and local dev). */
export type Database = PgDatabase<PgQueryResultHKT, Schema>;

export const migrationsFolder = fileURLToPath(new URL("../migrations", import.meta.url));

export interface DbHandle {
  db: Database;
  /** The underlying driver (pg Pool or PGlite) for libraries that need raw SQL, e.g. pg-boss. */
  kind: "postgres" | "pglite";
  pool?: Pool;
  pglite?: PGlite;
  close(): Promise<void>;
}

/** Connect to Postgres (Neon pooled URL in production). */
export function createPostgresDb(url: string, opts: { max?: number } = {}): DbHandle {
  const pool = new Pool({ connectionString: url, max: opts.max ?? 10 });
  const db = drizzleNodePg({ client: pool, schema, casing: "snake_case" }) as unknown as Database;
  return { db, kind: "postgres", pool, close: () => pool.end() };
}

/** In-process Postgres. `dataDir` undefined → in-memory. */
export async function createPgliteDb(dataDir?: string): Promise<DbHandle> {
  const client = dataDir === undefined ? new PGlite() : new PGlite(dataDir);
  await client.waitReady;
  const db = drizzlePglite({ client, schema, casing: "snake_case" }) as unknown as Database;
  return { db, kind: "pglite", pglite: client, close: () => client.close() };
}

export async function migrateDb(handle: DbHandle): Promise<void> {
  if (handle.kind === "pglite") {
    // Cast: the migrators are typed per driver but share the same runtime shape.
    await migratePglite(handle.db as unknown as Parameters<typeof migratePglite>[0], { migrationsFolder });
  } else {
    await migrateNodePg(handle.db as unknown as Parameters<typeof migrateNodePg>[0], { migrationsFolder });
  }
}

/** Fresh in-memory PGlite with all migrations applied. Used by every integration test. */
export async function createTestDb(): Promise<DbHandle> {
  const handle = await createPgliteDb();
  await migrateDb(handle);
  return handle;
}
