import { connectFromEnv } from "../connect.ts";
import { migrateDb } from "../client.ts";

// Uses the direct (unpooled) connection: migrations need a session, not a transaction pooler.
const url = process.env["DATABASE_URL_DIRECT"] || process.env["DATABASE_URL"];
const handle = await connectFromEnv({ url, pgliteDir: process.env["PGLITE_DIR"] });
try {
  await migrateDb(handle);
  console.log(`Migrations applied (${handle.kind}).`);
} finally {
  await handle.close();
}
