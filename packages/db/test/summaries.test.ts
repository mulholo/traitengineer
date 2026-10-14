import { randomUUID } from "node:crypto";
import { describe, expect, test } from "vitest";
import { useHarness } from "./harness.ts";

const h = useHarness();

describe("change target summary", () => {
  test("per-tool summaries and totals in the user's time zone, across the October DST change", async () => {
    const u = await h.newUser({ timezone: "Europe/London" });
    const target = await h.services.changeTargets.create(u, { title: "Default to action" });
    const tool = await h.services.tools.create(u, { changeTargetId: target.id, type: "evidence_log" });
    const second = await h.services.tools.create(u, {
      changeTargetId: target.id,
      type: "evidence_log",
      name: "Second",
    });
    // London clocks go back at 02:00 BST on Sun 25 Oct 2026.
    for (const occurredAt of ["2026-10-24T22:30:00Z", "2026-10-25T23:30:00Z", "2026-10-26T23:30:00Z"]) {
      await h.services.entries.create(u, {
        toolId: tool.id,
        clientId: randomUUID(),
        occurredAt,
        payload: { summary: occurredAt },
      });
    }
    // A deleted entry must not count.
    const { entry } = await h.services.entries.create(u, {
      toolId: tool.id,
      clientId: randomUUID(),
      occurredAt: "2026-10-20T09:00:00Z",
      payload: { summary: "gone" },
    });
    await h.services.entries.remove(u, entry.id);

    h.clock.now = new Date("2026-10-26T23:45:00Z"); // 23:45 GMT on Mon 26 Oct
    const s = await h.services.summaries.forChangeTarget(u, target.id, { weeks: 2 });

    expect(s.timeZone).toBe("Europe/London");
    expect(s.totals).toEqual({
      entries: 3,
      tools: 2,
      lastEntryAt: "2026-10-26T23:30:00.000Z",
      daysSinceLastEntry: 0,
    });
    expect(s.tools).toHaveLength(2);
    const first = s.tools.find((t) => t.toolId === tool.id);
    expect(first?.summary).toEqual({
      totalEntries: 3,
      weeklyCounts: [
        { week: "2026-W43", count: 2 },
        { week: "2026-W44", count: 1 },
      ],
      currentStreakDays: 3,
      daysSinceLastEntry: 0,
      lastEntryAt: "2026-10-26T23:30:00.000Z",
    });
    expect(s.tools.find((t) => t.toolId === second.id)?.summary).toMatchObject({
      totalEntries: 0,
      currentStreakDays: 0,
      daysSinceLastEntry: null,
    });
  });

  test("the same entries give a different streak for a user in another zone", async () => {
    const u = await h.newUser({ timezone: "Asia/Tokyo" });
    const target = await h.services.changeTargets.create(u, { title: "T" });
    const tool = await h.services.tools.create(u, { changeTargetId: target.id, type: "evidence_log" });
    // 23:30Z and 00:30Z the next day are both on the same Tokyo calendar day (08:30 and 09:30).
    for (const occurredAt of ["2026-10-24T23:30:00Z", "2026-10-25T00:30:00Z"]) {
      await h.services.entries.create(u, {
        toolId: tool.id,
        clientId: randomUUID(),
        occurredAt,
        payload: { summary: "x" },
      });
    }
    h.clock.now = new Date("2026-10-25T03:00:00Z");
    const s = await h.services.summaries.forChangeTarget(u, target.id);
    expect(s.tools[0]?.summary.currentStreakDays).toBe(1);
  });
});
