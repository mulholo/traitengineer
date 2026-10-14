import { randomUUID } from "node:crypto";
import { describe, expect, test } from "vitest";
import { changeTargets, entries, tools } from "../src/index.ts";
import { useHarness } from "./harness.ts";

const h = useHarness();

describe("cross-user isolation", () => {
  test("user B cannot read, change or attach to user A's rows through core services", async () => {
    const a = await h.newUser();
    const b = await h.newUser();
    const target = await h.services.changeTargets.create(a, { title: "A's target" });
    const tool = await h.services.tools.create(a, { changeTargetId: target.id, type: "evidence_log" });
    const { entry } = await h.services.entries.create(a, {
      toolId: tool.id,
      clientId: randomUUID(),
      payload: { summary: "A's entry" },
    });

    const s = h.services;
    const notFound = { code: "not_found" };
    // Reads
    await expect(s.changeTargets.get(b, target.id)).rejects.toMatchObject(notFound);
    await expect(s.tools.get(b, tool.id)).rejects.toMatchObject(notFound);
    await expect(s.entries.get(b, entry.id)).rejects.toMatchObject(notFound);
    await expect(s.summaries.forChangeTarget(b, target.id)).rejects.toMatchObject(notFound);
    expect((await s.changeTargets.list(b)).items).toEqual([]);
    expect((await s.tools.list(b, { changeTargetId: target.id })).items).toEqual([]);
    expect((await s.entries.list(b, { changeTargetId: target.id })).items).toEqual([]);
    expect((await s.entries.list(b, { toolId: tool.id })).items).toEqual([]);
    // Writes
    await expect(s.changeTargets.update(b, target.id, { title: "hijacked" })).rejects.toMatchObject(notFound);
    await expect(s.changeTargets.archive(b, target.id)).rejects.toMatchObject(notFound);
    await expect(s.tools.update(b, tool.id, { name: "hijacked" })).rejects.toMatchObject(notFound);
    await expect(s.tools.remove(b, tool.id)).rejects.toMatchObject(notFound);
    await expect(s.entries.update(b, entry.id, { payload: { summary: "hijacked" } })).rejects.toMatchObject(
      notFound,
    );
    await expect(s.entries.remove(b, entry.id)).rejects.toMatchObject(notFound);
    await expect(
      s.tools.create(b, { changeTargetId: target.id, type: "evidence_log" }),
    ).rejects.toMatchObject(notFound);
    await expect(
      s.entries.create(b, { toolId: tool.id, clientId: randomUUID(), payload: { summary: "x" } }),
    ).rejects.toMatchObject(notFound);

    // A's data is untouched.
    expect((await s.changeTargets.get(a, target.id)).title).toBe("A's target");
    expect((await s.entries.get(a, entry.id)).payload["summary"]).toBe("A's entry");
  });

  test("the same clientId may be used by two users independently", async () => {
    const a = await h.newUser();
    const b = await h.newUser();
    const clientId = randomUUID();
    const mk = async (u: string) => {
      const t = await h.services.changeTargets.create(u, { title: "T" });
      const tool = await h.services.tools.create(u, { changeTargetId: t.id, type: "evidence_log" });
      return h.services.entries.create(u, { toolId: tool.id, clientId, payload: { summary: u } });
    };
    const ra = await mk(a);
    const rb = await mk(b);
    expect(ra.created && rb.created).toBe(true);
    expect(ra.entry.id).not.toBe(rb.entry.id);
  });

  test("composite foreign keys stop rows pointing at another user's parent, even bypassing core", async () => {
    const a = await h.newUser();
    const b = await h.newUser();
    const target = await h.services.changeTargets.create(a, { title: "A's" });
    const tool = await h.services.tools.create(a, { changeTargetId: target.id, type: "evidence_log" });
    const { db } = h.handle;
    await expect(
      db.insert(tools).values({ userId: b, changeTargetId: target.id, type: "evidence_log", name: "x" }),
    ).rejects.toMatchObject({ cause: expect.objectContaining({ code: "23503" }) }); // foreign_key_violation
    await expect(
      db.insert(entries).values({
        userId: b,
        toolId: tool.id,
        changeTargetId: target.id,
        toolType: "evidence_log",
        payload: { summary: "x" },
        source: "api",
        clientId: randomUUID(),
      }),
    ).rejects.toMatchObject({ cause: expect.objectContaining({ code: "23503" }) }); // foreign_key_violation
    // Sanity: B can still create its own rows.
    await expect(db.insert(changeTargets).values({ userId: b, title: "B's" })).resolves.toBeDefined();
  });
});
