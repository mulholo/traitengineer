import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import type { Scope } from "@te/contracts";
import { createServices, type Services } from "@te/core";
import { createRepositories, createTestDb, insertUser, type DbHandle } from "@te/db";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { createMcpServer } from "../src/index.ts";

let handle: DbHandle;
let services: Services;
const now = new Date("2026-10-14T12:00:00Z");

beforeAll(async () => {
  handle = await createTestDb();
  services = createServices({ repos: createRepositories(handle.db), now: () => now });
});
afterAll(async () => handle.close());

async function connect(userId: string, scopes: Scope[] = ["read", "write"]) {
  const server = createMcpServer({ services, principal: { userId, scopes }, now: () => now });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: "test", version: "1.0.0" });
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
  return client;
}

type ToolResult = {
  isError?: boolean;
  content: { type: string; text: string }[];
  structuredContent?: Record<string, unknown>;
};
async function call(client: Client, name: string, args: Record<string, unknown> = {}) {
  return (await client.callTool({ name, arguments: args })) as ToolResult;
}

function promptText(result: { messages: { content: unknown }[] }): string {
  const content = result.messages[0]?.content as { text?: string } | undefined;
  return content?.text ?? "";
}

async function newUser() {
  return (await insertUser(handle.db)).id;
}

describe("discovery", () => {
  test("lists the task-shaped tools and prompts, with instructions", async () => {
    const client = await connect(await newUser());
    const tools = (await client.listTools()).tools.map((t) => t.name).sort();
    expect(tools).toEqual([
      "create_change_target",
      "get_change_target",
      "list_change_targets",
      "list_entries",
      "log_entry",
      "summarise_progress",
      "update_change_target",
    ]);
    const prompts = (await client.listPrompts()).prompts.map((p) => p.name).sort();
    expect(prompts).toEqual(["define_change_target", "weekly_review"]);
    expect(client.getInstructions()).toContain("Never fabricate entries");
    const logEntry = (await client.listTools()).tools.find((t) => t.name === "log_entry");
    expect(logEntry?.description).toContain("summary");
    expect(logEntry?.inputSchema.required).toEqual(expect.arrayContaining(["toolId", "payload"]));
  });
});

describe("tools", () => {
  test("create → log → read → summarise → update, all returning structuredContent and text", async () => {
    const client = await connect(await newUser());
    const created = await call(client, "create_change_target", {
      title: "Default to action",
      oldPattern: "Over-plan",
      desiredDefault: "Ship the first version",
      why: "Momentum",
    });
    expect(created.isError).toBeFalsy();
    const target = created.structuredContent?.["target"] as { id: string };
    const tool = created.structuredContent?.["tool"] as { id: string; type: string };
    expect(tool.type).toBe("evidence_log");
    expect(created.content[0]?.text).toContain("Default to action");

    const logged = await call(client, "log_entry", {
      toolId: tool.id,
      payload: {
        summary: "Sent the proposal without a third rewrite",
        happened: "Client signed",
        tags: ["work"],
      },
      occurredAt: "2026-10-13T09:00:00Z",
    });
    expect(logged.isError).toBeFalsy();
    const entry = logged.structuredContent?.["entry"] as { source: string; clientId: string };
    expect(entry.source).toBe("mcp");
    expect(entry.clientId).toMatch(/^[0-9a-f-]{36}$/);

    const list = await call(client, "list_change_targets");
    const items = list.structuredContent?.["items"] as {
      id: string;
      lastEntryAt: string;
      tools: unknown[];
    }[];
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ id: target.id, lastEntryAt: "2026-10-13T09:00:00.000Z" });
    expect(items[0]?.tools).toHaveLength(1);

    const got = await call(client, "get_change_target", { id: target.id });
    expect(got.structuredContent).toMatchObject({
      target: { id: target.id },
      summary: { totals: { entries: 1 } },
    });
    expect(got.structuredContent?.["recentEntries"]).toHaveLength(1);

    const entries = await call(client, "list_entries", { tag: "work" });
    expect(entries.structuredContent?.["items"]).toHaveLength(1);

    const progress = await call(client, "summarise_progress");
    const targets = progress.structuredContent?.["targets"] as {
      entriesInPeriod: number;
      recentEntries: { words: Record<string, unknown> }[];
    }[];
    expect(targets[0]?.entriesInPeriod).toBe(1);
    expect(targets[0]?.recentEntries[0]?.words["summary"]).toBe("Sent the proposal without a third rewrite");

    const updated = await call(client, "update_change_target", {
      id: target.id,
      fields: { status: "paused" },
    });
    expect(updated.structuredContent).toMatchObject({ target: { status: "paused" } });
    // Paused targets drop out of the default (active) progress summary.
    expect((await call(client, "summarise_progress")).structuredContent?.["targets"]).toEqual([]);
  });

  test("validation errors come back as tool errors with field paths, not exceptions", async () => {
    const client = await connect(await newUser());
    const created = await call(client, "create_change_target", {
      title: "T",
      oldPattern: "",
      desiredDefault: "",
      why: "",
    });
    const tool = created.structuredContent?.["tool"] as { id: string };
    const bad = await call(client, "log_entry", { toolId: tool.id, payload: { summary: "", difficulty: 7 } });
    expect(bad.isError).toBe(true);
    expect(bad.content[0]?.text).toContain("validation_failed");
    expect(bad.content[0]?.text).toContain("payload.summary");
    const missing = await call(client, "get_change_target", { id: "01927a4e-6f0b-7160-bcce-23cb1342b381" });
    expect(missing.isError).toBe(true);
    expect(missing.content[0]?.text).toContain("not_found");
    const malformed = await call(client, "get_change_target", { id: "nope" });
    expect(malformed.isError).toBe(true);
  });
});

describe("scopes", () => {
  test("a read-only connection can read but every write tool is refused", async () => {
    const userId = await newUser();
    const writer = await connect(userId);
    const created = await call(writer, "create_change_target", {
      title: "T",
      oldPattern: "",
      desiredDefault: "",
      why: "",
    });
    const target = created.structuredContent?.["target"] as { id: string };
    const tool = created.structuredContent?.["tool"] as { id: string };

    const reader = await connect(userId, ["read"]);
    expect((await call(reader, "list_change_targets")).isError).toBeFalsy();
    expect((await call(reader, "summarise_progress")).isError).toBeFalsy();
    for (const [name, args] of [
      ["log_entry", { toolId: tool.id, payload: { summary: "x" } }],
      ["create_change_target", { title: "x", oldPattern: "", desiredDefault: "", why: "" }],
      ["update_change_target", { id: target.id, fields: { title: "x" } }],
    ] as const) {
      const res = await call(reader, name, args);
      expect(res.isError, name).toBe(true);
      expect(res.content[0]?.text).toContain("'write' scope");
    }
    expect((await services.entries.list(userId, {})).items).toHaveLength(0);
  });
});

describe("cross-user isolation", () => {
  test("user B's connection cannot see or touch user A's data", async () => {
    const a = await connect(await newUser());
    const created = await call(a, "create_change_target", {
      title: "A's",
      oldPattern: "",
      desiredDefault: "",
      why: "",
    });
    const target = created.structuredContent?.["target"] as { id: string };
    const tool = created.structuredContent?.["tool"] as { id: string };
    await call(a, "log_entry", { toolId: tool.id, payload: { summary: "A's secret" } });

    const b = await connect(await newUser());
    expect((await call(b, "list_change_targets")).structuredContent?.["items"]).toEqual([]);
    expect(
      (await call(b, "list_entries", { changeTargetId: target.id })).structuredContent?.["items"],
    ).toEqual([]);
    expect((await call(b, "summarise_progress")).structuredContent?.["targets"]).toEqual([]);
    for (const [name, args] of [
      ["get_change_target", { id: target.id }],
      ["summarise_progress", { changeTargetId: target.id }],
      ["log_entry", { toolId: tool.id, payload: { summary: "B's intrusion" } }],
      ["update_change_target", { id: target.id, fields: { title: "hijacked" } }],
    ] as const) {
      const res = await call(b, name, args);
      expect(res.isError, name).toBe(true);
      expect(res.content[0]?.text).toContain("not_found");
    }
  });
});

describe("prompts", () => {
  test("weekly_review embeds the last 7 days of progress; define_change_target guides to create_change_target", async () => {
    const client = await connect(await newUser());
    const created = await call(client, "create_change_target", {
      title: "Speak up",
      oldPattern: "",
      desiredDefault: "",
      why: "",
    });
    const tool = created.structuredContent?.["tool"] as { id: string };
    await call(client, "log_entry", {
      toolId: tool.id,
      payload: { summary: "Spoke first in standup" },
      occurredAt: "2026-10-12T09:00:00Z",
    });
    await call(client, "log_entry", {
      toolId: tool.id,
      payload: { summary: "Old news" },
      occurredAt: "2026-09-01T09:00:00Z",
    });

    const review = await client.getPrompt({ name: "weekly_review" });
    const body = promptText(review);
    expect(body).toContain("Spoke first in standup");
    expect(body).not.toContain("Old news");
    expect(body).toContain("One experiment");

    const define = await client.getPrompt({
      name: "define_change_target",
      arguments: { topic: "procrastination" },
    });
    const text = promptText(define);
    expect(text).toContain("procrastination");
    expect(text).toContain("create_change_target");
  });
});
