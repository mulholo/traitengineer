import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { createTestDb } from "@te/db";
import { buildOpenApiDocument } from "../app.ts";
import { createContainerFromHandle } from "../container.ts";
import { loadEnv } from "../env.ts";

// Build /openapi.json from the app in-process (no server, no real DB) for client generation.
const out = fileURLToPath(new URL("../../../../packages/client/openapi.json", import.meta.url));
const env = loadEnv({
  NODE_ENV: "test",
  LOG_LEVEL: "silent",
  BETTER_AUTH_SECRET: "openapi-generation-only-openapi-generation-only",
});
// Migrated in-memory DB so Better Auth's async init (which seeds OAuth resources) has its tables.
const handle = await createTestDb();
try {
  const { app, auth } = createContainerFromHandle(env, handle);
  await auth.$context;
  const doc = buildOpenApiDocument(app);
  writeFileSync(out, `${JSON.stringify(doc, null, 2)}\n`);
  console.log(`Wrote ${out} (${Object.keys(doc.paths ?? {}).length} paths)`);
} finally {
  await handle.close();
}
