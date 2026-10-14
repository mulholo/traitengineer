import { describe, expect, test } from "vitest";
import { createServices } from "@te/core";
import { createRepositories, createTestDb, seedDemo } from "../src/index.ts";

describe("seedDemo", () => {
  test("creates two targets with evidence logs and ~40 entries over 8 weeks, once", async () => {
    const handle = await createTestDb();
    try {
      const now = new Date("2026-10-14T12:00:00Z");
      const first = await seedDemo(handle.db, { now });
      expect(first.created).toBe(true);
      expect(first.changeTargetIds).toHaveLength(2);
      expect(first.entryCount).toBe(40);

      const services = createServices({ repos: createRepositories(handle.db), now: () => now });
      const entries = await services.entries.list(first.userId, { limit: 200 });
      expect(entries.items).toHaveLength(40);
      const oldest = entries.items.at(-1)?.occurredAt ?? "";
      expect(now.getTime() - Date.parse(oldest)).toBeLessThan(57 * 86_400_000);

      const again = await seedDemo(handle.db, { now });
      expect(again).toMatchObject({ created: false, userId: first.userId });
    } finally {
      await handle.close();
    }
  });
});
