import { createRecordingPushSender, createServices, type PushMessage, type Services } from "@te/core";

export type RecordingPush = ReturnType<typeof createRecordingPushSender>;
import { afterAll, beforeAll } from "vitest";
import { createRepositories, createTestDb, insertUser, type DbHandle } from "../src/index.ts";

export interface Harness {
  handle: DbHandle;
  services: Services;
  clock: { now: Date };
  pushed: PushMessage[];
  push: RecordingPush;
  newUser(opts?: { timezone?: string }): Promise<string>;
}

/** One migrated in-memory PGlite per test file; isolation between tests comes from fresh users. */
export function useHarness(): Harness {
  const h = { clock: { now: new Date("2026-10-14T12:00:00Z") } } as Harness;
  beforeAll(async () => {
    h.handle = await createTestDb();
    const push = createRecordingPushSender();
    h.pushed = push.sent;
    h.push = push;
    h.services = createServices({ repos: createRepositories(h.handle.db), now: () => h.clock.now, push });
    h.newUser = async (opts = {}) => (await insertUser(h.handle.db, opts)).id;
  });
  afterAll(async () => {
    await h.handle.close();
  });
  return h;
}
