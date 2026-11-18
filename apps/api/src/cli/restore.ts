import { readFileSync } from "node:fs";
import { connectFromEnv, restoreExport, users } from "@te/db";
import { eq } from "drizzle-orm";
import { loadEnv } from "../env.ts";

// Usage: OWNER_EMAIL=... pnpm db:restore path/to/traitengineer.json
// Loads an export (GET /v1/export or the share sheet) into the owner's account. Idempotent.
const file = process.argv[2];
if (!file) {
  console.error("Usage: pnpm db:restore <export.json>");
  process.exit(1);
}
const env = loadEnv({ BETTER_AUTH_SECRET: "restore-cli-does-not-use-auth-restore-cli", ...process.env });
if (!env.OWNER_EMAIL) {
  console.error("Set OWNER_EMAIL to the account to restore into (create it first with user:create-owner).");
  process.exit(1);
}
const handle = await connectFromEnv({
  url: env.DATABASE_URL_DIRECT ?? env.DATABASE_URL,
  pgliteDir: env.PGLITE_DIR,
});
try {
  const [owner] = await handle.db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, env.OWNER_EMAIL.toLowerCase()));
  if (!owner) throw new Error("No user with OWNER_EMAIL; create the owner first.");
  const result = await restoreExport(handle.db, owner.id, JSON.parse(readFileSync(file, "utf8")));
  console.log(`Restored into user ${owner.id}:`, result);
} catch (e) {
  console.error((e as Error).message);
  process.exitCode = 1;
} finally {
  await handle.close();
}
