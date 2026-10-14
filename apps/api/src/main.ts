import { serve } from "@hono/node-server";
import { createContainer } from "./container.ts";
import { loadEnv } from "./env.ts";

const env = loadEnv();
const container = await createContainer(env);
const { logger } = container;

if (env.ROLE === "web" || env.ROLE === "all") {
  const server = serve({ fetch: container.app.fetch, port: env.PORT }, (info) => {
    logger.info({ port: info.port, role: env.ROLE }, "Trait Engineer API listening");
  });
  const shutdown = (signal: string) => {
    logger.info({ signal }, "shutting down");
    server.close(() => void container.close().then(() => process.exit(0)));
  };
  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}
