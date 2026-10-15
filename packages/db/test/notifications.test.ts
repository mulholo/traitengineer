import { randomUUID } from "node:crypto";
import { describe, expect, test } from "vitest";
import { useHarness } from "./harness.ts";

const h = useHarness();
const token = () => `ExponentPushToken[${randomUUID()}]`;

async function setup(opts: { devices?: number; timezone?: string; time?: string } = {}) {
  const u = await h.newUser({ timezone: opts.timezone ?? "Europe/London" });
  const target = await h.services.changeTargets.create(u, { title: "T" });
  const tool = await h.services.tools.create(u, { changeTargetId: target.id, type: "evidence_log" });
  const tokens: string[] = [];
  for (let i = 0; i < (opts.devices ?? 1); i++) {
    const t = token();
    tokens.push(t);
    await h.services.devices.register(u, { expoPushToken: t, platform: "ios" });
  }
  const reminder = await h.services.reminders.create(u, {
    toolId: tool.id,
    title: "Log it",
    body: "What did you do?",
    schedule: { type: "daily", time: opts.time ?? "08:30" },
  });
  return { u, tool, reminder, tokens };
}

const sentTo = (tokens: string[]) => h.pushed.filter((m) => tokens.includes(m.to));

describe("reminders.dispatch", () => {
  test("fires a due reminder once to every active device with a quick-log deep link, then advances", async () => {
    h.clock.now = new Date("2026-10-14T06:00:00Z");
    const { u, tool, reminder, tokens } = await setup({ devices: 2 });
    expect(reminder.nextFireAt).toBe("2026-10-14T07:30:00.000Z");

    h.clock.now = new Date("2026-10-14T07:29:00Z");
    await h.services.notifications.dispatchDue();
    expect(sentTo(tokens)).toHaveLength(0); // not due yet

    h.clock.now = new Date("2026-10-14T07:30:20Z");
    await h.services.notifications.dispatchDue();
    const sent = sentTo(tokens);
    expect(sent).toHaveLength(2);
    expect(sent[0]).toMatchObject({
      title: "Log it",
      body: "What did you do?",
      categoryId: "log_evidence",
      data: { url: `traitengineer://log/${tool.id}` },
    });
    const after = (await h.services.reminders.list(u))[0];
    expect(after).toMatchObject({
      lastFiredAt: "2026-10-14T07:30:00.000Z",
      nextFireAt: "2026-10-15T07:30:00.000Z",
    });

    await h.services.notifications.dispatchDue();
    expect(sentTo(tokens)).toHaveLength(2); // same occurrence never fires twice
  });

  test("overlapping dispatch runs deliver each occurrence exactly once", async () => {
    h.clock.now = new Date("2026-10-14T06:00:00Z");
    const { tokens } = await setup({ devices: 3 });
    h.clock.now = new Date("2026-10-14T07:31:00Z");
    await Promise.all(Array.from({ length: 6 }, () => h.services.notifications.dispatchDue()));
    expect(sentTo(tokens)).toHaveLength(3);
    expect(new Set(sentTo(tokens).map((m) => m.to)).size).toBe(3);
  });

  test("a retry after a failed send does not deliver the occurrence again (at most once)", async () => {
    h.clock.now = new Date("2026-10-14T06:00:00Z");
    const { tokens } = await setup();
    h.clock.now = new Date("2026-10-14T07:31:00Z");
    const original = h.push.send.bind(h.push);
    h.push.send = async () => {
      throw new Error("network down");
    };
    await expect(h.services.notifications.dispatchDue()).rejects.toThrow("network down");
    h.push.send = original;
    await h.services.notifications.dispatchDue(); // the job retries
    expect(sentTo(tokens)).toHaveLength(0);
  });

  test("after downtime, missed occurrences fire once and the next one is in the future", async () => {
    h.clock.now = new Date("2026-10-10T06:00:00Z");
    const { u, tokens } = await setup();
    h.clock.now = new Date("2026-10-14T09:00:00Z"); // four days of missed 08:30s
    await h.services.notifications.dispatchDue();
    expect(sentTo(tokens)).toHaveLength(1);
    expect((await h.services.reminders.list(u))[0]?.nextFireAt).toBe("2026-10-15T07:30:00.000Z");
  });

  test("disabled reminders and disabled devices get nothing; no-device reminders still advance", async () => {
    h.clock.now = new Date("2026-10-14T06:00:00Z");
    const off = await setup();
    await h.services.reminders.update(off.u, off.reminder.id, { enabled: false });
    const noDevices = await setup({ devices: 0 });
    const removed = await setup();
    const device = (await h.services.devices.list(removed.u))[0];
    await h.services.devices.remove(removed.u, device?.id ?? "");

    h.clock.now = new Date("2026-10-14T07:31:00Z");
    await h.services.notifications.dispatchDue();
    expect(sentTo([...off.tokens, ...removed.tokens])).toHaveLength(0);
    expect((await h.services.reminders.list(noDevices.u))[0]?.nextFireAt).toBe("2026-10-15T07:30:00.000Z");
  });

  test("fires at 08:30 local on both sides of the October DST change", async () => {
    h.clock.now = new Date("2026-10-24T06:00:00Z");
    const { tokens } = await setup();
    const times: string[] = [];
    for (const at of [
      "2026-10-24T07:30:30Z",
      "2026-10-25T07:30:30Z",
      "2026-10-25T08:30:30Z",
      "2026-10-26T08:30:30Z",
    ]) {
      h.clock.now = new Date(at);
      const before = sentTo(tokens).length;
      await h.services.notifications.dispatchDue();
      if (sentTo(tokens).length > before) times.push(at);
    }
    // 08:30 BST = 07:30Z on the 24th; 08:30 GMT = 08:30Z from the 25th (07:30Z on the 25th is 07:30 local: too early).
    expect(times).toEqual(["2026-10-24T07:30:30Z", "2026-10-25T08:30:30Z", "2026-10-26T08:30:30Z"]);
  });
});

describe("push.receipts", () => {
  test("DeviceNotRegistered tickets disable the device immediately", async () => {
    h.clock.now = new Date("2026-10-14T06:00:00Z");
    const { u, tokens } = await setup({ devices: 2 });
    h.push.failTokens.add(tokens[0] ?? "");
    h.clock.now = new Date("2026-10-14T07:31:00Z");
    await h.services.notifications.dispatchDue();
    const devices = await h.services.devices.list(u);
    expect(devices.filter((d) => d.disabledAt !== null)).toHaveLength(1);
  });

  test("receipts are checked once ready; DeviceNotRegistered receipts disable the device", async () => {
    h.clock.now = new Date("2026-10-14T06:00:00Z");
    const { u, tokens } = await setup({ devices: 2 });
    h.clock.now = new Date("2026-10-14T07:31:00Z");
    const before = h.pushed.length;
    await h.services.notifications.dispatchDue();
    expect(h.pushed.length - before).toBe(2);

    // Too soon: tickets younger than a minute are left alone.
    expect(await h.services.notifications.checkReceipts()).toEqual({ checked: 0, disabled: 0 });

    h.clock.now = new Date("2026-10-14T07:50:00Z");
    // Receipts for the tickets just issued (ids are sequential in the stub): one gone, one ok.
    const ids = (await h.handle.db.query.pushTickets.findMany()).filter((t) =>
      tokens.includes(t.expoPushToken),
    );
    const gone = ids.find((t) => t.expoPushToken === tokens[0]);
    const ok = ids.find((t) => t.expoPushToken === tokens[1]);
    h.push.receipts.set(gone?.ticketId ?? "", {
      status: "error",
      message: "gone",
      deviceNotRegistered: true,
    });
    h.push.receipts.set(ok?.ticketId ?? "", { status: "ok" });
    const result = await h.services.notifications.checkReceipts();
    expect(result.disabled).toBe(1);
    expect(result.checked).toBeGreaterThanOrEqual(2);
    const active = (await h.services.devices.list(u)).filter((d) => d.disabledAt === null);
    expect(active).toHaveLength(1);
    // Checked tickets are not checked again.
    expect((await h.services.notifications.checkReceipts()).checked).toBe(0);
  });
});
