import { createAuth } from "../auth/better-auth.ts";
import { setOwnerPassword } from "../auth/owner.ts";
import { loadEnv } from "../env.ts";
import { connectFromEnv } from "@te/db";
import { promptNewPassword } from "./prompt.ts";

// Usage: OWNER_EMAIL=... pnpm user:set-password   (revokes every session)
const env = loadEnv();
if (!env.OWNER_EMAIL) {
  console.error("Set OWNER_EMAIL in the environment.");
  process.exit(1);
}
const handle = await connectFromEnv({ url: env.DATABASE_URL, pgliteDir: env.PGLITE_DIR });
try {
  const auth = createAuth(handle.db, env);
  const password = await promptNewPassword();
  const { userId } = await setOwnerPassword(auth, { email: env.OWNER_EMAIL, password });
  console.log(`Password updated for user ${userId}; all sessions revoked.`);
} catch (e) {
  console.error((e as Error).message);
  process.exitCode = 1;
} finally {
  await handle.close();
}
