import { serve } from "@hono/node-server";
import { createContainer } from "./container.ts";
import { loadEnv } from "./env.ts";
import { startWorker } from "./jobs/worker.ts";

const env = loadEnv();
const container = await createContainer(env);
const { logger } = container;
const stops: (() => Promise<void>)[] = [];

if (env.ROLE === "worker" || env.ROLE === "all") {
  const boss = await startWorker({
    handle: container.handle,
    services: container.services,
    logger,
    connectionString: env.DATABASE_URL_DIRECT ?? env.DATABASE_URL,
  });
  stops.push(() => boss.stop({ graceful: true }));
}

if (env.ROLE === "web" || env.ROLE === "all") {
  const server = serve({ fetch: container.app.fetch, port: env.PORT }, (info) => {
    logger.info({ port: info.port, role: env.ROLE }, "Trait Engineer API listening");
  });
  stops.unshift(() => new Promise<void>((resolve) => server.close(() => resolve())));
}

const shutdown = async (signal: string) => {
  logger.info({ signal }, "shutting down");
  for (const stop of stops)
    await stop().catch((err: unknown) => logger.error({ err }, "shutdown step failed"));
  await container.close();
  process.exit(0);
};
process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));
