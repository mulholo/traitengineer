import { describe, expect, test } from "vitest";
import { useApi } from "./harness.ts";

const h = useApi();
const uuid = () => crypto.randomUUID();

describe("public routes", () => {
  test("GET /health reports DB reachability", async () => {
    const { status, body } = await h.json("GET", "/health");
    expect(status).toBe(200);
    expect(body).toEqual({ status: "ok", db: "ok" });
  });

  test("/openapi.json and /docs are public", async () => {
    const { status, body } = await h.json<{ openapi: string; paths: Record<string, unknown> }>(
      "GET",
      "/openapi.json",
    );
    expect(status).toBe(200);
    expect(body.openapi).toBe("3.1.0");
    expect(Object.keys(body.paths)).toEqual(
      expect.arrayContaining(["/v1/entries", "/v1/change-targets/{id}/summary", "/health"]),
    );
    const docs = await h.request("GET", "/docs");
    expect(docs.status).toBe(200);
    expect(docs.headers.get("content-type")).toContain("text/html");
  });

  test("responses carry a request ID, and an incoming one is propagated", async () => {
    const res = await h.request("GET", "/health", { headers: { "x-request-id": "abc-123" } });
    expect(res.headers.get("x-request-id")).toBe("abc-123");
    expect((await h.request("GET", "/health")).headers.get("x-request-id")).toBeTruthy();
  });

  test("unknown API routes are problem+json 404s (401 first when unauthenticated, so routes aren't enumerable)", async () => {
    expect((await h.request("GET", "/v1/nope")).status).toBe(401);
    const { token } = await h.session();
    const res = await h.request("GET", "/v1/nope", { token });
    expect(res.status).toBe(404);
    expect(res.headers.get("content-type")).toBe("application/problem+json");
  });
});

describe("change targets, tools and entries over REST", () => {
  test("full lifecycle", async () => {
    const { token } = await h.session();
    const created = await h.json("POST", "/v1/change-targets", {
      token,
      body: { title: "Default to action", why: "Momentum" },
    });
    expect(created.status).toBe(201);
    const id = created.body["id"] as string;

    expect((await h.json("GET", `/v1/change-targets/${id}`, { token })).body).toMatchObject({
      title: "Default to action",
    });
    expect(
      (await h.json("PATCH", `/v1/change-targets/${id}`, { token, body: { status: "paused" } })).body,
    ).toMatchObject({ status: "paused" });
    const list = await h.json<{ items: unknown[]; nextCursor: string | null }>(
      "GET",
      "/v1/change-targets?status=paused&limit=10",
      { token },
    );
    expect(list.body.items).toHaveLength(1);

    const tool = await h.json("POST", "/v1/tools", {
      token,
      body: { changeTargetId: id, type: "evidence_log" },
    });
    expect(tool.status).toBe(201);
    const toolId = tool.body["id"] as string;
    expect((await h.json("GET", `/v1/tools?changeTargetId=${id}`, { token })).body["items"]).toHaveLength(1);
    expect(
      (await h.json("PATCH", `/v1/tools/${toolId}`, { token, body: { name: "Wins" } })).body,
    ).toMatchObject({ name: "Wins" });

    const clientId = uuid();
    const entry = {
      toolId,
      clientId,
      source: "web",
      payload: { summary: "Sent it", expected: "Disaster", happened: "Fine", tags: ["work"] },
    };
    const first = await h.json("POST", "/v1/entries", { token, body: entry });
    expect(first.status).toBe(201);
    const again = await h.json("POST", "/v1/entries", { token, body: entry });
    expect(again.status).toBe(200);
    expect(again.body["id"]).toBe(first.body["id"]);
    const entryId = first.body["id"] as string;

    expect(
      (await h.json("GET", `/v1/entries?tag=work&changeTargetId=${id}`, { token })).body["items"],
    ).toHaveLength(1);
    expect(
      (
        await h.json("PATCH", `/v1/entries/${entryId}`, {
          token,
          body: { payload: { uncertain: "Will it last?" } },
        })
      ).body,
    ).toMatchObject({
      payload: { summary: "Sent it", uncertain: "Will it last?" },
    });

    const summary = await h.json<{
      totals: { entries: number };
      tools: { summary: { totalEntries: number } }[];
    }>("GET", `/v1/change-targets/${id}/summary?weeks=4`, { token });
    expect(summary.status).toBe(200);
    expect(summary.body.totals.entries).toBe(1);
    expect(summary.body.tools[0]?.summary.totalEntries).toBe(1);

    expect((await h.request("DELETE", `/v1/entries/${entryId}`, { token })).status).toBe(204);
    expect((await h.request("GET", `/v1/entries/${entryId}`, { token })).status).toBe(404);
    expect((await h.request("DELETE", `/v1/tools/${toolId}`, { token })).status).toBe(204);
    const archived = await h.json("DELETE", `/v1/change-targets/${id}`, { token });
    expect(archived.body).toMatchObject({ status: "archived" });
  });

  test("validation errors are problem+json with field paths", async () => {
    const { token } = await h.session();
    const res = await h.request("POST", "/v1/change-targets", { token, body: { title: "" } });
    expect(res.status).toBe(400);
    expect(res.headers.get("content-type")).toBe("application/problem+json");
    const body = (await res.json()) as { code: string; errors: { path: string }[] };
    expect(body.code).toBe("validation_failed");
    expect(body.errors[0]?.path).toBe("title");

    const target = await h.json("POST", "/v1/change-targets", { token, body: { title: "T" } });
    const tool = await h.json("POST", "/v1/tools", {
      token,
      body: { changeTargetId: target.body["id"], type: "evidence_log" },
    });
    const bad = await h.json<{ code: string; errors: { path: string }[] }>("POST", "/v1/entries", {
      token,
      body: { toolId: tool.body["id"], clientId: uuid(), payload: { summary: "x", difficulty: 9 } },
    });
    expect(bad.status).toBe(400);
    expect(bad.body.errors[0]?.path).toBe("payload.difficulty");

    const unknownType = await h.json("POST", "/v1/tools", {
      token,
      body: { changeTargetId: target.body["id"], type: "mood" },
    });
    expect(unknownType.status).toBe(400);
    expect((await h.json("GET", "/v1/entries?limit=500", { token })).status).toBe(400);
    expect((await h.json("GET", "/v1/change-targets/not-a-uuid", { token })).status).toBe(400);
  });

  test("cursor pagination over REST", async () => {
    const { token } = await h.session();
    for (let i = 0; i < 3; i++)
      await h.json("POST", "/v1/change-targets", { token, body: { title: `T${i}` } });
    const p1 = await h.json<{ items: { title: string }[]; nextCursor: string }>(
      "GET",
      "/v1/change-targets?limit=2",
      { token },
    );
    const p2 = await h.json<{ items: { title: string }[]; nextCursor: string | null }>(
      "GET",
      `/v1/change-targets?limit=2&cursor=${p1.body.nextCursor}`,
      { token },
    );
    expect([...p1.body.items, ...p2.body.items].map((t) => t.title)).toEqual(["T0", "T1", "T2"]);
    expect(p2.body.nextCursor).toBeNull();
  });
});

describe("reminders, devices, me and export", () => {
  test("reminder lifecycle including send test", async () => {
    const { token } = await h.session();
    await h.json("POST", "/v1/devices", {
      token,
      body: { expoPushToken: `ExponentPushToken[${uuid()}]`, platform: "ios", deviceName: "iPhone" },
    });
    const created = await h.json("POST", "/v1/reminders", {
      token,
      body: { schedule: { type: "weekdays", time: "09:00" }, title: "Log it" },
    });
    expect(created.status).toBe(201);
    expect(created.body).toMatchObject({ schedule: { type: "weekdays", time: "09:00" }, enabled: true });
    const id = created.body["id"] as string;
    expect((await h.json("GET", "/v1/reminders", { token })).body["items"]).toHaveLength(1);
    expect(
      (await h.json("PATCH", `/v1/reminders/${id}`, { token, body: { enabled: false } })).body,
    ).toMatchObject({ enabled: false, nextFireAt: null });
    const before = h.pushed.length;
    expect((await h.json("POST", `/v1/reminders/${id}/test`, { token })).body).toEqual({ devices: 1 });
    expect(h.pushed.length).toBe(before + 1);
    expect((await h.request("DELETE", `/v1/reminders/${id}`, { token })).status).toBe(204);
    const badSchedule = await h.json("POST", "/v1/reminders", {
      token,
      body: { schedule: { type: "daily", time: "25:00" } },
    });
    expect(badSchedule.status).toBe(400);
  });

  test("devices upsert by token and never echo it", async () => {
    const { token } = await h.session();
    const pushToken = `ExponentPushToken[${uuid()}]`;
    const a = await h.json("POST", "/v1/devices", {
      token,
      body: { expoPushToken: pushToken, platform: "ios" },
    });
    const b = await h.json("POST", "/v1/devices", {
      token,
      body: { expoPushToken: pushToken, platform: "ios", deviceName: "Renamed" },
    });
    expect(a.status).toBe(200);
    expect(b.body["id"]).toBe(a.body["id"]);
    expect(JSON.stringify(b.body)).not.toContain(pushToken);
    expect((await h.request("DELETE", `/v1/devices/${a.body["id"]}`, { token })).status).toBe(204);
  });

  test("GET/PATCH /v1/me", async () => {
    const email = `me-${uuid()}@example.test`;
    const { token, userId } = await h.session(email);
    const me = await h.json("GET", "/v1/me", { token });
    expect(me.body).toMatchObject({
      id: userId,
      email,
      timezone: "Europe/London",
      scopes: ["read", "write"],
    });
    const patched = await h.json("PATCH", "/v1/me", {
      token,
      body: { timezone: "America/New_York", displayName: "J" },
    });
    expect(patched.body).toMatchObject({ timezone: "America/New_York", displayName: "J" });
    expect((await h.json("PATCH", "/v1/me", { token, body: { timezone: "Mars/Olympus" } })).status).toBe(400);
  });

  test("export as JSON and Markdown", async () => {
    const { token } = await h.session();
    const t = await h.json("POST", "/v1/change-targets", { token, body: { title: "Exported target" } });
    const tool = await h.json("POST", "/v1/tools", {
      token,
      body: { changeTargetId: t.body["id"], type: "evidence_log" },
    });
    await h.json("POST", "/v1/entries", {
      token,
      body: { toolId: tool.body["id"], clientId: uuid(), payload: { summary: "Exported entry" } },
    });
    const json = await h.json<{ version: number; entries: unknown[] }>("GET", "/v1/export", { token });
    expect(json.status).toBe(200);
    expect(json.body.version).toBe(1);
    expect(json.body.entries).toHaveLength(1);
    expect(json.res.headers.get("content-disposition")).toMatch(
      /attachment; filename="traitengineer-\d{4}-\d{2}-\d{2}\.json"/,
    );
    const md = await h.request("GET", "/v1/export?format=markdown", { token });
    expect(md.headers.get("content-type")).toContain("text/markdown");
    const text = await md.text();
    expect(text).toContain("## Exported target");
    expect(text).toContain("Exported entry");
  });
});
