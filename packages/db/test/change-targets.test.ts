import { describe, expect, test } from "vitest";
import { useHarness } from "./harness.ts";

const h = useHarness();

describe("change targets", () => {
  test("create applies defaults and sort order", async () => {
    const u = await h.newUser();
    const a = await h.services.changeTargets.create(u, { title: "  Default to action  " });
    const b = await h.services.changeTargets.create(u, {
      title: "Speak up early",
      why: "Ideas die in my head",
    });
    expect(a).toMatchObject({
      title: "Default to action",
      status: "active",
      oldPattern: "",
      sortOrder: 0,
      archivedAt: null,
    });
    expect(b.sortOrder).toBe(1);
    expect(a.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7/); // UUIDv7
  });

  test("create validates input", async () => {
    const u = await h.newUser();
    await expect(h.services.changeTargets.create(u, { title: "" })).rejects.toMatchObject({
      code: "validation_failed",
    });
    await expect(h.services.changeTargets.create(u, { title: "x".repeat(121) })).rejects.toMatchObject({
      code: "validation_failed",
      issues: [expect.objectContaining({ path: "title" })],
    });
  });

  test("list filters by status and paginates with a cursor", async () => {
    const u = await h.newUser();
    for (let i = 0; i < 5; i++) await h.services.changeTargets.create(u, { title: `T${i}` });
    const paused = await h.services.changeTargets.create(u, { title: "Paused", status: "paused" });

    const page1 = await h.services.changeTargets.list(u, { limit: 2 });
    expect(page1.items.map((t) => t.title)).toEqual(["T0", "T1"]);
    expect(page1.nextCursor).not.toBeNull();
    const page2 = await h.services.changeTargets.list(u, { limit: 2, cursor: page1.nextCursor ?? "" });
    expect(page2.items.map((t) => t.title)).toEqual(["T2", "T3"]);
    const rest = await h.services.changeTargets.list(u, { limit: 10, cursor: page2.nextCursor ?? "" });
    expect(rest.items.map((t) => t.title)).toEqual(["T4", "Paused"]);
    expect(rest.nextCursor).toBeNull();

    const onlyPaused = await h.services.changeTargets.list(u, { status: "paused" });
    expect(onlyPaused.items.map((t) => t.id)).toEqual([paused.id]);

    await expect(h.services.changeTargets.list(u, { cursor: "not-a-cursor" })).rejects.toMatchObject({
      code: "validation_failed",
    });
  });

  test("update is partial; archive sets archivedAt and is idempotent; unarchive clears it", async () => {
    const u = await h.newUser();
    const t = await h.services.changeTargets.create(u, { title: "Old", why: "Because" });
    const updated = await h.services.changeTargets.update(u, t.id, { title: "New" });
    expect(updated).toMatchObject({ title: "New", why: "Because" });

    const archived = await h.services.changeTargets.archive(u, t.id);
    expect(archived.status).toBe("archived");
    expect(archived.archivedAt).toBe("2026-10-14T12:00:00.000Z");
    expect((await h.services.changeTargets.archive(u, t.id)).archivedAt).toBe(archived.archivedAt);

    const restored = await h.services.changeTargets.update(u, t.id, { status: "active" });
    expect(restored.archivedAt).toBeNull();
  });

  test("unknown ids are not found", async () => {
    const u = await h.newUser();
    const missing = "01927a4e-6f0b-7160-bcce-23cb1342b381";
    await expect(h.services.changeTargets.get(u, missing)).rejects.toMatchObject({ code: "not_found" });
    await expect(h.services.changeTargets.update(u, missing, { title: "x" })).rejects.toMatchObject({
      code: "not_found",
    });
    await expect(h.services.changeTargets.archive(u, missing)).rejects.toMatchObject({ code: "not_found" });
  });
});
