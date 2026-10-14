import { connectFromEnv } from "../connect.ts";
import { seedDemo } from "../seed.ts";

if (process.env["NODE_ENV"] === "production") {
  console.error("Refusing to seed: NODE_ENV=production.");
  process.exit(1);
}

const handle = await connectFromEnv({
  url: process.env["DATABASE_URL"],
  pgliteDir: process.env["PGLITE_DIR"],
});
try {
  const result = await seedDemo(handle.db);
  if (!result.created) {
    console.log("Demo user already exists; nothing to do.");
  } else {
    console.log(
      `Seeded demo user ${result.userId}: ${result.changeTargetIds.length} change targets, ${result.entryCount} entries.`,
    );
  }
} finally {
  await handle.close();
}
