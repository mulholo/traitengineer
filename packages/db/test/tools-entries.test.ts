import { randomUUID } from "node:crypto";
import { describe, expect, test } from "vitest";
import { useHarness } from "./harness.ts";

const h = useHarness();

async function setup() {
  const u = await h.newUser();
  const target = await h.services.changeTargets.create(u, { title: "Default to action" });
  const tool = await h.services.tools.create(u, { changeTargetId: target.id, type: "evidence_log" });
  return { u, target, tool };
}

describe("tools", () => {
  test("create fills config defaults and name from the registry", async () => {
    const { tool } = await setup();
    expect(tool).toMatchObject({ type: "evidence_log", name: "Evidence log", sortOrder: 0 });
    expect(tool.config).toEqual({ prompt: "What did you do?", askDifficulty: true });
  });

  test("unknown types and invalid config are rejected", async () => {
    const { u, target } = await setup();
    await expect(
      // @ts-expect-error -- deliberately passing a type that is not in the registry
      h.services.tools.create(u, { changeTargetId: target.id, type: "mood_tracker" }),
    ).rejects.toMatchObject({ code: "validation_failed" });
    await expect(
      h.services.tools.create(u, {
        changeTargetId: target.id,
        type: "evidence_log",
        config: { askDifficulty: "yes" },
      }),
    ).rejects.toMatchObject({
      code: "validation_failed",
      issues: [expect.objectContaining({ path: "config.askDifficulty" })],
    });
  });

  test("update merges and revalidates config; delete is soft", async () => {
    const { u, target, tool } = await setup();
    const updated = await h.services.tools.update(u, tool.id, {
      config: { askDifficulty: false },
      name: "Wins",
    });
    expect(updated.config).toEqual({ prompt: "What did you do?", askDifficulty: false });
    expect(updated.name).toBe("Wins");
    await expect(h.services.tools.update(u, tool.id, { config: { prompt: "" } })).rejects.toMatchObject({
      code: "validation_failed",
    });

    await h.services.tools.remove(u, tool.id);
    await expect(h.services.tools.get(u, tool.id)).rejects.toMatchObject({ code: "not_found" });
    expect((await h.services.tools.list(u, { changeTargetId: target.id })).items).toEqual([]);
    await expect(h.services.tools.remove(u, tool.id)).rejects.toMatchObject({ code: "not_found" });
  });
});

describe("entries", () => {
  test("create validates the payload against the tool type and denormalises target + type", async () => {
    const { u, target, tool } = await setup();
    await expect(
      h.services.entries.create(u, { toolId: tool.id, clientId: randomUUID(), payload: { summary: "" } }),
    ).rejects.toMatchObject({
      code: "validation_failed",
      issues: [expect.objectContaining({ path: "payload.summary" })],
    });

    const { entry, created } = await h.services.entries.create(u, {
      toolId: tool.id,
      clientId: randomUUID(),
      source: "mobile",
      payload: {
        summary: "Sent the proposal without a third rewrite",
        happened: "Signed same day",
        difficulty: 3,
      },
    });
    expect(created).toBe(true);
    expect(entry).toMatchObject({
      changeTargetId: target.id,
      toolType: "evidence_log",
      source: "mobile",
      occurredAt: "2026-10-14T12:00:00.000Z",
      payload: {
        summary: "Sent the proposal without a third rewrite",
        happened: "Signed same day",
        difficulty: 3,
        tags: [],
      },
    });
  });

  test("create is idempotent on clientId", async () => {
    const { u, tool } = await setup();
    const clientId = randomUUID();
    const first = await h.services.entries.create(u, {
      toolId: tool.id,
      clientId,
      payload: { summary: "Once" },
    });
    const again = await h.services.entries.create(u, {
      toolId: tool.id,
      clientId,
      payload: { summary: "Twice?" },
    });
    expect(again.created).toBe(false);
    expect(again.entry.id).toBe(first.entry.id);
    expect(again.entry.payload["summary"]).toBe("Once");
    expect((await h.services.entries.list(u, { toolId: tool.id })).items).toHaveLength(1);
  });

  test("concurrent creates with the same clientId store one entry", async () => {
    const { u, tool } = await setup();
    const clientId = randomUUID();
    const results = await Promise.all(
      Array.from({ length: 5 }, () =>
        h.services.entries.create(u, { toolId: tool.id, clientId, payload: { summary: "Race" } }),
      ),
    );
    expect(new Set(results.map((r) => r.entry.id)).size).toBe(1);
    expect(results.filter((r) => r.created)).toHaveLength(1);
  });

  test("list filters by target, tool, time range and tag, newest first, with cursor pagination", async () => {
    const { u, target, tool } = await setup();
    const other = await h.services.changeTargets.create(u, { title: "Other" });
    const otherTool = await h.services.tools.create(u, { changeTargetId: other.id, type: "evidence_log" });
    const log = (toolId: string, occurredAt: string, tags: string[] = []) =>
      h.services.entries.create(u, {
        toolId,
        clientId: randomUUID(),
        occurredAt,
        payload: { summary: occurredAt, tags },
      });
    await log(tool.id, "2026-10-01T09:00:00Z", ["work"]);
    await log(tool.id, "2026-10-05T09:00:00+01:00");
    await log(tool.id, "2026-10-10T09:00:00Z", ["work", "home"]);
    await log(otherTool.id, "2026-10-11T09:00:00Z", ["work"]);

    const all = await h.services.entries.list(u, {});
    expect(all.items.map((e) => e.occurredAt)).toEqual([
      "2026-10-11T09:00:00.000Z",
      "2026-10-10T09:00:00.000Z",
      "2026-10-05T08:00:00.000Z",
      "2026-10-01T09:00:00.000Z",
    ]);
    expect((await h.services.entries.list(u, { changeTargetId: target.id })).items).toHaveLength(3);
    expect((await h.services.entries.list(u, { toolId: otherTool.id })).items).toHaveLength(1);
    const ranged = await h.services.entries.list(u, {
      since: "2026-10-02T00:00:00Z",
      until: "2026-10-10T09:00:00Z",
    });
    expect(ranged.items).toHaveLength(2);
    const tagged = await h.services.entries.list(u, { tag: "work", changeTargetId: target.id });
    expect(tagged.items.map((e) => e.occurredAt)).toEqual([
      "2026-10-10T09:00:00.000Z",
      "2026-10-01T09:00:00.000Z",
    ]);

    const p1 = await h.services.entries.list(u, { limit: 3 });
    const p2 = await h.services.entries.list(u, { limit: 3, cursor: p1.nextCursor ?? "" });
    expect(p1.items).toHaveLength(3);
    expect(p2.items.map((e) => e.occurredAt)).toEqual(["2026-10-01T09:00:00.000Z"]);
    expect(p2.nextCursor).toBeNull();
  });

  test("entries with identical occurredAt paginate without skipping or repeating", async () => {
    const { u, tool } = await setup();
    for (let i = 0; i < 5; i++) {
      await h.services.entries.create(u, {
        toolId: tool.id,
        clientId: randomUUID(),
        occurredAt: "2026-10-01T09:00:00Z",
        payload: { summary: `s${i}` },
      });
    }
    const seen: string[] = [];
    let cursor: string | undefined;
    do {
      const page = await h.services.entries.list(u, {
        toolId: tool.id,
        limit: 2,
        ...(cursor ? { cursor } : {}),
      });
      seen.push(...page.items.map((e) => e.id));
      cursor = page.nextCursor ?? undefined;
    } while (cursor);
    expect(seen).toHaveLength(5);
    expect(new Set(seen).size).toBe(5);
  });

  test("update merges payload and revalidates; delete is soft", async () => {
    const { u, tool } = await setup();
    const { entry } = await h.services.entries.create(u, {
      toolId: tool.id,
      clientId: randomUUID(),
      payload: { summary: "A", tags: ["x"] },
    });
    const updated = await h.services.entries.update(u, entry.id, {
      payload: { uncertain: "Does it last?" },
      occurredAt: "2026-10-13T08:00:00+01:00",
    });
    expect(updated.payload).toEqual({ summary: "A", tags: ["x"], uncertain: "Does it last?" });
    expect(updated.occurredAt).toBe("2026-10-13T07:00:00.000Z");
    await expect(
      h.services.entries.update(u, entry.id, { payload: { difficulty: 9 } }),
    ).rejects.toMatchObject({ code: "validation_failed" });

    await h.services.entries.remove(u, entry.id);
    await expect(h.services.entries.get(u, entry.id)).rejects.toMatchObject({ code: "not_found" });
    expect((await h.services.entries.list(u, { toolId: tool.id })).items).toEqual([]);
  });

  test("cannot log against a deleted tool", async () => {
    const { u, tool } = await setup();
    await h.services.tools.remove(u, tool.id);
    await expect(
      h.services.entries.create(u, { toolId: tool.id, clientId: randomUUID(), payload: { summary: "x" } }),
    ).rejects.toMatchObject({ code: "not_found" });
  });
});
