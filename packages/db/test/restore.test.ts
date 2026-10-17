import { randomUUID } from "node:crypto";
import { createServices, type Services } from "@te/core";
import { describe, expect, test } from "vitest";
import {
  createRepositories,
  createTestDb,
  insertUser,
  restoreExport,
  seedDemo,
  type DbHandle,
} from "../src/index.ts";

const now = new Date("2026-10-14T12:00:00Z");
const servicesFor = (h: DbHandle) => createServices({ repos: createRepositories(h.db), now: () => now });

/** Exports compared without the parts that legitimately differ between databases. */
function comparable(data: Awaited<ReturnType<Services["exports"]["exportAll"]>>) {
  const { exportedAt: _a, user: _u, ...rest } = data;
  return rest;
}

describe("export → restore round trip", () => {
  test("restoring an export into a fresh database reproduces it exactly, and re-running is a no-op", async () => {
    const source = await createTestDb();
    const target = await createTestDb();
    try {
      const { userId } = await seedDemo(source.db, { now });
      const s = servicesFor(source);
      // Exercise edge cases: an archived target, an edited entry, an entry whose tool was later deleted, a reminder.
      const extra = await s.changeTargets.create(userId, { title: "Will be archived" });
      const extraTool = await s.tools.create(userId, { changeTargetId: extra.id, type: "evidence_log" });
      await s.entries.create(userId, {
        toolId: extraTool.id,
        clientId: randomUUID(),
        payload: { summary: "Orphan after delete", tags: ["x"] },
      });
      await s.tools.remove(userId, extraTool.id);
      await s.changeTargets.archive(userId, extra.id);
      await s.reminders.create(userId, { schedule: { type: "weekdays", time: "18:00" }, title: "Evening" });
      const before = await s.exports.exportAll(userId);
      // Through JSON, exactly as the archive stores it.
      const file = JSON.parse(JSON.stringify(before));

      const { id: newOwner } = await insertUser(target.db, { email: "restored@example.test" });
      const result = await restoreExport(target.db, newOwner, file);
      expect(result).toEqual({ changeTargets: 3, tools: 3, entries: 41, reminders: 1 });

      const after = await servicesFor(target).exports.exportAll(newOwner);
      expect(comparable(after)).toEqual(comparable(before));

      expect(await restoreExport(target.db, newOwner, file)).toEqual({
        changeTargets: 0,
        tools: 0,
        entries: 0,
        reminders: 0,
      });
    } finally {
      await source.close();
      await target.close();
    }
  });

  test("rejects files that are not exports", async () => {
    const db = await createTestDb();
    try {
      const { id } = await insertUser(db.db);
      await expect(restoreExport(db.db, id, { version: 2 })).rejects.toThrow(/version|expected/i);
    } finally {
      await db.close();
    }
  });
});
