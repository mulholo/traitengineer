import type { Services } from "@te/core";
import type { DbHandle } from "@te/db";
import { fromPglite, PgBoss } from "pg-boss";
import type { Logger } from "../logger.ts";

export const JOBS = {
  dispatchReminders: "reminders.dispatch",
  pushReceipts: "push.receipts",
} as const;

/** Cron schedules (pg-boss evaluates them server-side, so they survive restarts and run once per tick). */
export const SCHEDULES = [
  { name: JOBS.dispatchReminders, cron: "* * * * *", tz: "UTC" },
  { name: JOBS.pushReceipts, cron: "*/15 * * * *", tz: "UTC" },
] as const;

export interface WorkerOptions {
  handle: DbHandle;
  services: Services;
  logger: Logger;
  /** Postgres URL for pg-boss. Must be a direct (unpooled) connection: pg-boss needs session features. */
  connectionString?: string | undefined;
  /** false in tests: register handlers without cron (call `boss.send` to trigger). */
  schedule?: boolean;
}

/** Start pg-boss on the app database (Postgres in production, PGlite locally/tests) and register job handlers. */
export async function startWorker(opts: WorkerOptions) {
  const { handle, services, logger } = opts;
  const schedule = opts.schedule ?? true;
  const boss =
    handle.kind === "pglite" && handle.pglite
      ? new PgBoss({ db: fromPglite(handle.pglite), backend: "pglite", schedule })
      : new PgBoss({ connectionString: opts.connectionString ?? "", schedule });
  boss.on("error", (err) => logger.error({ err }, "pg-boss error"));
  await boss.start();

  for (const name of Object.values(JOBS)) await boss.createQueue(name);

  await boss.work(JOBS.dispatchReminders, async () => {
    const result = await services.notifications.dispatchDue();
    if (result.fired > 0) logger.info(result, "reminders dispatched");
    return result;
  });
  await boss.work(JOBS.pushReceipts, async () => {
    const result = await services.notifications.checkReceipts();
    if (result.checked > 0) logger.info(result, "push receipts checked");
    return result;
  });

  if (schedule) {
    for (const s of SCHEDULES) await boss.schedule(s.name, s.cron, null, { tz: s.tz });
  }
  logger.info({ jobs: Object.values(JOBS) }, "worker started");
  return boss;
}
