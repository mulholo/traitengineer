import { describe, expect, test } from "vitest";
import { renderExportMarkdown } from "@te/core";
import { randomUUID } from "node:crypto";
import { useHarness } from "./harness.ts";

const h = useHarness();
const TOKEN = (n: number) => `ExponentPushToken[device-${n}-${randomUUID()}]`;

describe("reminders", () => {
  test("create compiles the preset, defaults the zone to the user's and computes nextFireAt", async () => {
    h.clock.now = new Date("2026-10-14T06:00:00Z");
    const u = await h.newUser({ timezone: "Europe/London" });
    const r = await h.services.reminders.create(u, { schedule: { type: "daily", time: "08:30" } });
    expect(r).toMatchObject({
      rrule: "FREQ=DAILY;BYHOUR=8;BYMINUTE=30;BYSECOND=0",
      schedule: { type: "daily", time: "08:30" },
      timezone: "Europe/London",
      enabled: true,
      nextFireAt: "2026-10-14T07:30:00.000Z",
      title: "Time to log some evidence",
    });
  });

  test("links to a tool derive its change target; foreign tools are not found", async () => {
    const u = await h.newUser();
    const other = await h.newUser();
    const t = await h.services.changeTargets.create(u, { title: "T" });
    const tool = await h.services.tools.create(u, { changeTargetId: t.id, type: "evidence_log" });
    const r = await h.services.reminders.create(u, {
      toolId: tool.id,
      schedule: { type: "weekdays", time: "18:00" },
    });
    expect(r.changeTargetId).toBe(t.id);
    await expect(
      h.services.reminders.create(other, { toolId: tool.id, schedule: { type: "daily", time: "08:00" } }),
    ).rejects.toMatchObject({
      code: "not_found",
    });
  });

  test("update recomputes nextFireAt; disabling clears it; delete removes", async () => {
    h.clock.now = new Date("2026-10-14T06:00:00Z");
    const u = await h.newUser({ timezone: "America/New_York" });
    const r = await h.services.reminders.create(u, { schedule: { type: "daily", time: "08:30" } });
    expect(r.nextFireAt).toBe("2026-10-14T12:30:00.000Z");
    const moved = await h.services.reminders.update(u, r.id, {
      schedule: { type: "every_n_hours", everyHours: 2, start: "09:00", end: "13:00" },
      timezone: "Europe/London",
    });
    expect(moved.nextFireAt).toBe("2026-10-14T08:00:00.000Z");
    expect(moved.schedule).toEqual({ type: "every_n_hours", everyHours: 2, start: "09:00", end: "13:00" });
    const off = await h.services.reminders.update(u, r.id, { enabled: false });
    expect(off.nextFireAt).toBeNull();
    await h.services.reminders.remove(u, r.id);
    expect(await h.services.reminders.list(u)).toEqual([]);
  });

  test("sendTest pushes to active devices only, with a deep link to quick log", async () => {
    const u = await h.newUser();
    const t = await h.services.changeTargets.create(u, { title: "T" });
    const tool = await h.services.tools.create(u, { changeTargetId: t.id, type: "evidence_log" });
    const r = await h.services.reminders.create(u, {
      toolId: tool.id,
      title: "Log it",
      schedule: { type: "daily", time: "08:00" },
    });
    const a = await h.services.devices.register(u, { expoPushToken: TOKEN(1), platform: "ios" });
    await h.services.devices.register(u, { expoPushToken: TOKEN(2), platform: "ios" });
    await h.services.devices.remove(u, a.id);
    const before = h.pushed.length;
    expect(await h.services.reminders.sendTest(u, r.id)).toEqual({ devices: 1 });
    const sent = h.pushed.slice(before);
    expect(sent).toHaveLength(1);
    expect(sent[0]).toMatchObject({
      title: "Log it",
      data: { url: `traitengineer://log/${tool.id}` },
      categoryId: "log_evidence",
    });
  });
});

describe("devices", () => {
  test("register upserts by token, re-enables, never returns the token, and can move between users", async () => {
    const u = await h.newUser();
    const v = await h.newUser();
    const token = TOKEN(3);
    const d1 = await h.services.devices.register(u, {
      expoPushToken: token,
      platform: "ios",
      deviceName: "iPhone",
    });
    expect(d1).not.toHaveProperty("expoPushToken");
    await h.services.devices.remove(u, d1.id);
    const d2 = await h.services.devices.register(u, {
      expoPushToken: token,
      platform: "ios",
      deviceName: "iPhone 2",
    });
    expect(d2).toMatchObject({ id: d1.id, disabledAt: null, deviceName: "iPhone 2" });
    await h.services.devices.register(v, { expoPushToken: token, platform: "ios" });
    expect(await h.services.devices.list(u)).toEqual([]);
    expect(await h.services.devices.list(v)).toHaveLength(1);
    await expect(
      h.services.devices.register(u, { expoPushToken: "nope", platform: "ios" }),
    ).rejects.toMatchObject({ code: "validation_failed" });
  });
});

describe("personal access tokens", () => {
  test("plaintext shown once, hash verifies, scopes expand, revoke stops it", async () => {
    const u = await h.newUser();
    const created = await h.services.tokens.create(u, { name: "Claude Code", scope: "write" });
    expect(created.token).toMatch(/^te_pat_[A-Za-z0-9_-]{43}$/);
    expect(created.scopes).toEqual(["read", "write"]);
    const listed = await h.services.tokens.list(u);
    expect(listed).toHaveLength(1);
    expect(JSON.stringify(listed)).not.toContain(created.token);

    const verified = await h.services.tokens.verify(created.token);
    expect(verified).toEqual({ userId: u, scopes: ["read", "write"], tokenId: created.id });
    expect((await h.services.tokens.list(u))[0]?.lastUsedAt).not.toBeNull();
    expect(await h.services.tokens.verify(`${created.token}x`)).toBeNull();
    expect(await h.services.tokens.verify("not-a-pat")).toBeNull();

    const read = await h.services.tokens.create(u, { name: "read only", scope: "read" });
    expect(read.scopes).toEqual(["read"]);

    await h.services.tokens.revoke(u, created.id);
    expect(await h.services.tokens.verify(created.token)).toBeNull();
    await expect(h.services.tokens.revoke(u, created.id)).rejects.toMatchObject({ code: "not_found" });
  });

  test("another user cannot revoke my token", async () => {
    const u = await h.newUser();
    const v = await h.newUser();
    const t = await h.services.tokens.create(u, { name: "mine", scope: "read" });
    await expect(h.services.tokens.revoke(v, t.id)).rejects.toMatchObject({ code: "not_found" });
    expect(await h.services.tokens.verify(t.token)).not.toBeNull();
  });
});

describe("login throttle", () => {
  test("locks after 5 failures for 15 minutes, doubles on further failures, resets on success", async () => {
    const throttle = h.services.loginThrottle;
    const keys = [`email:${randomUUID()}`, `ip:10.0.0.${Math.floor(Math.random() * 200)}`];
    h.clock.now = new Date("2026-10-14T12:00:00Z");
    for (let i = 0; i < 4; i++) await throttle.recordFailure(keys);
    expect(await throttle.retryAfter(keys)).toBe(0);
    await throttle.recordFailure(keys);
    expect(await throttle.retryAfter(keys)).toBe(15 * 60);

    h.clock.now = new Date("2026-10-14T12:15:01Z");
    expect(await throttle.retryAfter(keys)).toBe(0);
    await throttle.recordFailure(keys); // 6th → 30 min
    expect(await throttle.retryAfter(keys)).toBe(30 * 60);

    // A quiet window after the lock expires resets the count.
    h.clock.now = new Date("2026-10-14T13:20:00Z");
    await throttle.recordFailure(keys);
    expect(await throttle.retryAfter(keys)).toBe(0);

    await throttle.recordSuccess(keys);
    for (let i = 0; i < 4; i++) await throttle.recordFailure(keys);
    expect(await throttle.retryAfter(keys)).toBe(0);
  });
});

describe("export", () => {
  test("includes targets, tools, entries and reminders but no email or secrets; renders markdown", async () => {
    const u = await h.newUser({ timezone: "Europe/London" });
    const t = await h.services.changeTargets.create(u, { title: "Default to action", why: "Momentum" });
    const tool = await h.services.tools.create(u, { changeTargetId: t.id, type: "evidence_log" });
    await h.services.entries.create(u, {
      toolId: tool.id,
      clientId: randomUUID(),
      occurredAt: "2026-10-13T23:30:00Z",
      payload: { summary: "Shipped it", happened: "Fine", difficulty: 2, tags: ["work"] },
    });
    await h.services.reminders.create(u, { schedule: { type: "daily", time: "08:00" } });
    await h.services.tokens.create(u, { name: "x", scope: "read" });

    const data = await h.services.exports.exportAll(u);
    expect(data.changeTargets).toHaveLength(1);
    expect(data.tools).toHaveLength(1);
    expect(data.entries).toHaveLength(1);
    expect(data.reminders).toHaveLength(1);
    const json = JSON.stringify(data);
    expect(json).not.toContain("@example.test");
    expect(json).not.toContain("te_pat_");

    const md = renderExportMarkdown(data);
    expect(md).toContain("## Default to action");
    expect(md).toContain("- 2026-10-14 — Shipped it"); // local date in London
    expect(md).toContain("**Difficulty:** 2/5");
  });
});
