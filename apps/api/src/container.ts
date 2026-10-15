import { createRecordingPushSender, createServices, type ArchiveStore, type PushSender } from "@te/core";
import { connectFromEnv, createRepositories, pingDb, type DbHandle } from "@te/db";
import { createApp } from "./app.ts";
import { createAuth } from "./auth/better-auth.ts";
import type { Env } from "./env.ts";
import { createLogger } from "./logger.ts";
import { createErrorReporter, type ErrorReporter } from "./observability.ts";
import { createGitHubArchiveStore } from "./archive/github.ts";
import { createExpoPushSender } from "./push/expo.ts";

/** Composition root: wire db repositories into core services, auth and the HTTP app. */
export function createContainerFromHandle(
  env: Env,
  handle: DbHandle,
  opts: { push?: PushSender; archive?: ArchiveStore; now?: () => Date; reportError?: ErrorReporter } = {},
) {
  const logger = createLogger(env);
  const services = createServices({
    repos: createRepositories(handle.db),
    ...(opts.now ? { now: opts.now } : {}),
    ...(opts.push ? { push: opts.push } : {}),
    ...(opts.archive ? { archive: opts.archive } : {}),
  });
  const auth = createAuth(handle.db, env);
  const checkDb = () => pingDb(handle);
  const app = createApp({
    env,
    services,
    auth,
    logger,
    checkDb,
    reportError: opts.reportError ?? createErrorReporter(env),
    ...(opts.now ? { now: () => opts.now!().getTime(), nowDate: opts.now } : {}),
  });
  return { env, logger, handle, services, auth, app, close: () => handle.close() };
}

export async function createContainer(env: Env) {
  const handle = await connectFromEnv({ url: env.DATABASE_URL, pgliteDir: env.PGLITE_DIR });
  // Real pushes go through Expo; tests inject a recording sender via createContainerFromHandle.
  const push =
    env.NODE_ENV === "test"
      ? createRecordingPushSender()
      : createExpoPushSender({ accessToken: env.EXPO_ACCESS_TOKEN });
  const archive =
    env.ARCHIVE_REPO && env.ARCHIVE_GITHUB_TOKEN
      ? createGitHubArchiveStore({ repo: env.ARCHIVE_REPO, token: env.ARCHIVE_GITHUB_TOKEN })
      : undefined;
  return createContainerFromHandle(env, handle, { push, ...(archive ? { archive } : {}) });
}

export type Container = ReturnType<typeof createContainerFromHandle>;
