import { createAuth } from "../auth/better-auth.ts";
import { createOwner } from "../auth/owner.ts";
import { loadEnv } from "../env.ts";
import { connectFromEnv } from "@te/db";
import { promptNewPassword } from "./prompt.ts";

// Usage: OWNER_EMAIL=... pnpm user:create-owner   (password is prompted on the TTY, never an argument)
const env = loadEnv();
if (!env.OWNER_EMAIL) {
  console.error("Set OWNER_EMAIL in the environment.");
  process.exit(1);
}
const handle = await connectFromEnv({ url: env.DATABASE_URL, pgliteDir: env.PGLITE_DIR });
try {
  const auth = createAuth(handle.db, env);
  const password = await promptNewPassword();
  const { userId } = await createOwner(auth, { email: env.OWNER_EMAIL, password });
  console.log(`Owner created (user ${userId}). Store the password in your password manager.`);
} catch (e) {
  console.error((e as Error).message);
  process.exitCode = 1;
} finally {
  await handle.close();
}
