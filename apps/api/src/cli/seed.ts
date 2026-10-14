import { randomBytes } from "node:crypto";
import { connectFromEnv, DEMO_EMAIL, seedDemo } from "@te/db";
import { createAuth } from "../auth/better-auth.ts";
import { loadEnv } from "../env.ts";

// Local dev / previews only: demo user with a random dev-only password printed once.
const env = loadEnv({ BETTER_AUTH_SECRET: "dev-only-seed-secret-dev-only-seed-secret", ...process.env });
if (env.NODE_ENV === "production") {
  console.error("Refusing to seed: NODE_ENV=production.");
  process.exit(1);
}
const handle = await connectFromEnv({ url: env.DATABASE_URL, pgliteDir: env.PGLITE_DIR });
try {
  const password = `dev-${randomBytes(9).toString("base64url")}`;
  const ctx = await createAuth(handle.db, env).$context;
  const result = await seedDemo(handle.db, { passwordHash: await ctx.password.hash(password) });
  if (!result.created) {
    console.log("Demo user already exists; nothing to do. Delete .pglite/ (or the user) to reseed.");
  } else {
    console.log(`Seeded ${result.changeTargetIds.length} change targets and ${result.entryCount} entries.`);
    console.log(`Sign in as ${DEMO_EMAIL} with dev-only password: ${password}`);
  }
} finally {
  await handle.close();
}
