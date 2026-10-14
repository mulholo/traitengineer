import { createServices, type PushSender } from "@te/core";
import { connectFromEnv, createRepositories, pingDb, type DbHandle } from "@te/db";
import { createApp } from "./app.ts";
import { createAuth } from "./auth/better-auth.ts";
import type { Env } from "./env.ts";
import { createLogger } from "./logger.ts";

/** Composition root: wire db repositories into core services, auth and the HTTP app. */
export function createContainerFromHandle(
  env: Env,
  handle: DbHandle,
  opts: { push?: PushSender; now?: () => Date } = {},
) {
  const logger = createLogger(env);
  const services = createServices({
    repos: createRepositories(handle.db),
    ...(opts.now ? { now: opts.now } : {}),
    ...(opts.push ? { push: opts.push } : {}),
  });
  const auth = createAuth(handle.db, env);
  const checkDb = () => pingDb(handle);
  const app = createApp({
    env,
    services,
    auth,
    logger,
    checkDb,
    ...(opts.now ? { now: () => opts.now!().getTime(), nowDate: opts.now } : {}),
  });
  return { env, logger, handle, services, auth, app, close: () => handle.close() };
}

export async function createContainer(env: Env) {
  const handle = await connectFromEnv({ url: env.DATABASE_URL, pgliteDir: env.PGLITE_DIR });
  return createContainerFromHandle(env, handle);
}

export type Container = ReturnType<typeof createContainerFromHandle>;
