import { createRecordingPushSender, createServices } from "@te/core";
import { createRepositories, createTestDb, type DbHandle } from "@te/db";
import type { PgBoss } from "pg-boss";
import { afterAll, beforeAll, expect, test } from "vitest";
import { createLogger } from "../src/logger.ts";
import { JOBS, startWorker } from "../src/jobs/worker.ts";

let handle: DbHandle;
let boss: PgBoss;
const push = createRecordingPushSender();
const clock = { now: new Date("2026-10-14T06:00:00Z") };
const services = () => createServices({ repos: createRepositories(handle.db), now: () => clock.now, push });

beforeAll(async () => {
  handle = await createTestDb();
  boss = await startWorker({
    handle,
    services: services(),
    logger: createLogger({ LOG_LEVEL: "silent", NODE_ENV: "test" }),
    schedule: false,
  });
});
afterAll(async () => {
  await boss.stop({ graceful: false, close: false });
  await handle.close();
});

test("pg-boss runs reminders.dispatch on PGlite and the reminder reaches the device", async () => {
  const s = services();
  const { insertUser } = await import("@te/db");
  const { id: userId } = await insertUser(handle.db);
  await s.devices.register(userId, { expoPushToken: "ExponentPushToken[worker-test]", platform: "ios" });
  await s.reminders.create(userId, { title: "From the worker", schedule: { type: "daily", time: "08:30" } });

  clock.now = new Date("2026-10-14T07:31:00Z");
  await boss.send(JOBS.dispatchReminders, {});
  await expect
    .poll(() => push.sent.map((m) => m.title), { timeout: 15_000, interval: 250 })
    .toEqual(["From the worker"]);

  const receiptsJob = await boss.send(JOBS.pushReceipts, {});
  await expect
    .poll(async () => (await boss.getJobById(JOBS.pushReceipts, receiptsJob ?? ""))?.state, {
      timeout: 15_000,
      interval: 250,
    })
    .toBe("completed");
}, 30_000);

test("archive.nightly runs on the worker and writes a snapshot when an archive store is configured", async () => {
  const { createRecordingArchiveStore } = await import("@te/core");
  // Only the archive-configured worker should handle this job.
  await boss.offWork(JOBS.archiveNightly);
  const archive = createRecordingArchiveStore();
  const archived = createServices({
    repos: createRepositories(handle.db),
    now: () => clock.now,
    push,
    archive,
  });
  const archiveBoss = await startWorker({
    handle,
    services: archived,
    logger: createLogger({ LOG_LEVEL: "silent", NODE_ENV: "test" }),
    schedule: false,
  });
  try {
    const id = await archiveBoss.send(JOBS.archiveNightly, {});
    await expect
      .poll(async () => (await archiveBoss.getJobById(JOBS.archiveNightly, id ?? ""))?.state, {
        timeout: 15_000,
        interval: 250,
      })
      .toBe("completed");
    expect(archive.snapshots).toHaveLength(1);
    expect(archive.snapshots[0]?.files.some((f) => f.path.endsWith("traitengineer.md"))).toBe(true);
  } finally {
    await archiveBoss.stop({ graceful: false, close: false });
  }
}, 30_000);
