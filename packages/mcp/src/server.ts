import { randomUUID } from "node:crypto";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import {
  changeTargetStatusSchema,
  idSchema,
  timestampSchema,
  toolTypeNames,
  toolTypes,
  type Scope,
} from "@te/contracts";
import { isDomainError, type Services } from "@te/core";
import { z } from "zod";

export interface McpPrincipal {
  userId: string;
  scopes: Scope[];
}

export const SERVER_INSTRUCTIONS = `Trait Engineer tracks psychological change targets and evidence for them.

- A change target is a behaviour the user wants to shift: the old pattern, the desired default, and why it matters.
- Each target has tools; v1 has one tool type, the evidence log. Each tool collects entries.
- An evidence-log entry records a concrete moment: what the user did (summary), and optionally what they expected,
  what happened, what it supports, what remains uncertain, difficulty (1–5) and tags.

Guidance:
- Read before you write: call list_change_targets or get_change_target to find the right target and tool IDs.
- Never fabricate entries. Only log something the user actually described, in their own words where possible.
  If details are missing, ask rather than invent them.
- Times are ISO 8601; summaries use the user's own time zone.`;

const evidencePayloadHelp = Object.values(toolTypes)
  .map((t) => `- ${t.type}: ${t.description}`)
  .join("\n");

function text(value: string): CallToolResult["content"] {
  return [{ type: "text", text: value }];
}

function errorResult(message: string): CallToolResult {
  return { isError: true, content: text(message) };
}

/** Build a per-request MCP server bound to the caller. Stateless: nothing is kept between requests. */
export function createMcpServer(deps: { services: Services; principal: McpPrincipal; now?: () => Date }) {
  const { services: s, principal } = deps;
  const now = deps.now ?? (() => new Date());
  const userId = principal.userId;
  const server = new McpServer(
    { name: "trait-engineer", title: "Trait Engineer", version: "1.0.0" },
    { instructions: SERVER_INSTRUCTIONS, capabilities: { tools: {}, prompts: {} } },
  );

  /** Run a tool body with scope enforcement and domain-error mapping. */
  async function run(
    scope: Scope,
    fn: () => Promise<{ structured: Record<string, unknown>; summary: string }>,
  ): Promise<CallToolResult> {
    if (!principal.scopes.includes(scope)) {
      return errorResult(
        `This tool needs the '${scope}' scope, but this connection only has: ${principal.scopes.join(", ") || "none"}.`,
      );
    }
    try {
      const { structured, summary } = await fn();
      return { content: text(summary), structuredContent: structured };
    } catch (e) {
      if (isDomainError(e)) {
        const issues = e.issues.map((i) => `${i.path || "(root)"}: ${i.message}`).join("; ");
        return errorResult(`${e.code}: ${e.message}${issues ? ` — ${issues}` : ""}`);
      }
      throw e;
    }
  }

  const readOnly = { readOnlyHint: true, openWorldHint: false } as const;

  server.registerTool(
    "list_change_targets",
    {
      title: "List change targets",
      description:
        "List the user's change targets with their tools and the date of the most recent entry. Use this first to " +
        "find target and tool IDs. Optional `status` filter (default: all statuses).",
      inputSchema: { status: changeTargetStatusSchema.optional() },
      annotations: readOnly,
    },
    ({ status }) =>
      run("read", async () => {
        const targets = await s.changeTargets.list(userId, { limit: 200, ...(status ? { status } : {}) });
        const items = [];
        for (const t of targets.items) {
          const tools = await s.tools.listForTarget(userId, t.id);
          const last = await s.entries.list(userId, { changeTargetId: t.id, limit: 1 });
          items.push({
            ...t,
            tools: tools.map(({ id, name, type }) => ({ id, name, type })),
            lastEntryAt: last.items[0]?.occurredAt ?? null,
          });
        }
        const lines = items.map(
          (t) =>
            `- ${t.title} [${t.status}] id=${t.id}; tools: ${t.tools.map((x) => `${x.name} (${x.id})`).join(", ") || "none"}; last entry: ${t.lastEntryAt ?? "never"}`,
        );
        return { structured: { items }, summary: lines.length ? lines.join("\n") : "No change targets yet." };
      }),
  );

  server.registerTool(
    "get_change_target",
    {
      title: "Get a change target",
      description:
        "Full details of one change target: what and why, its tools, per-tool summaries (weekly counts, streak, days " +
        "since last entry) and the 20 most recent entries.",
      inputSchema: { id: idSchema },
      annotations: readOnly,
    },
    ({ id }) =>
      run("read", async () => {
        const target = await s.changeTargets.get(userId, id);
        const tools = await s.tools.listForTarget(userId, id);
        const summary = await s.summaries.forChangeTarget(userId, id);
        const recent = await s.entries.list(userId, { changeTargetId: id, limit: 20 });
        const structured = { target, tools, summary, recentEntries: recent.items };
        const lines = [
          `${target.title} [${target.status}]`,
          `Old pattern: ${target.oldPattern || "—"}`,
          `Desired default: ${target.desiredDefault || "—"}`,
          `Why: ${target.why || "—"}`,
          `Entries: ${summary.totals.entries}; days since last entry: ${summary.totals.daysSinceLastEntry ?? "n/a"}`,
          ...recent.items
            .slice(0, 5)
            .map((e) => `- ${e.occurredAt.slice(0, 10)}: ${String(e.payload["summary"] ?? "")}`),
        ];
        return { structured, summary: lines.join("\n") };
      }),
  );

  server.registerTool(
    "list_entries",
    {
      title: "List entries",
      description:
        "Entries newest first, optionally filtered by change target, tool, time range (ISO 8601) and tag. " +
        "Returns up to `limit` (default 50, max 200) plus `nextCursor` when there are more.",
      inputSchema: {
        changeTargetId: idSchema.optional(),
        toolId: idSchema.optional(),
        since: timestampSchema.optional(),
        until: timestampSchema.optional(),
        tag: z.string().optional(),
        limit: z.number().int().min(1).max(200).optional(),
        cursor: z.string().optional(),
      },
      annotations: readOnly,
    },
    (args) =>
      run("read", async () => {
        const query = Object.fromEntries(Object.entries(args).filter(([, v]) => v !== undefined));
        const page = await s.entries.list(userId, query);
        const lines = page.items.map(
          (e) => `- ${e.occurredAt} (${e.id}): ${String(e.payload["summary"] ?? "")}`,
        );
        return { structured: page, summary: lines.length ? lines.join("\n") : "No entries match." };
      }),
  );

  server.registerTool(
    "summarise_progress",
    {
      title: "Summarise progress",
      description:
        "Progress per change target over a period: weekly entry counts, current streak in days, days since the last " +
        "entry, and the user's own words from recent entries. Defaults to every active target over the last 28 days. " +
        "Use this for reviews and reflections.",
      inputSchema: { changeTargetId: idSchema.optional(), since: timestampSchema.optional() },
      annotations: readOnly,
    },
    (args) =>
      run("read", async () => {
        const progress = await s.summaries.progress(userId, {
          ...(args.changeTargetId ? { changeTargetId: args.changeTargetId } : {}),
          ...(args.since ? { since: args.since } : {}),
        });
        const lines = progress.targets.map((t) => {
          const streak = Math.max(0, ...t.tools.map((x) => x.summary.currentStreakDays));
          return `- ${t.title}: ${t.entriesInPeriod} entries since ${progress.since.slice(0, 10)}, streak ${streak}d, last entry ${t.daysSinceLastEntry ?? "never"}d ago`;
        });
        return {
          structured: progress,
          summary: lines.length ? lines.join("\n") : "No active change targets.",
        };
      }),
  );

  server.registerTool(
    "log_entry",
    {
      title: "Log an entry",
      description:
        "Record one entry the user described, against a tool (get tool IDs from list_change_targets). Only log what the " +
        "user actually said; never invent details. `payload` must match the tool type:\n" +
        evidencePayloadHelp +
        "\n`occurredAt` defaults to now. Returns the stored entry.",
      inputSchema: {
        toolId: idSchema,
        payload: z.record(z.string(), z.unknown()),
        occurredAt: timestampSchema.optional(),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: false,
      },
    },
    ({ toolId, payload, occurredAt }) =>
      run("write", async () => {
        const { entry } = await s.entries.create(userId, {
          toolId,
          payload,
          source: "mcp",
          clientId: randomUUID(),
          ...(occurredAt ? { occurredAt } : {}),
        });
        return {
          structured: { entry },
          summary: `Logged entry ${entry.id} at ${entry.occurredAt}: ${String(entry.payload["summary"] ?? "")}`,
        };
      }),
  );

  server.registerTool(
    "create_change_target",
    {
      title: "Create a change target",
      description:
        "Create a new change target once the user has agreed on its wording. An evidence log tool is attached " +
        "automatically so entries can be logged straight away. Returns the target and its tool.",
      inputSchema: {
        title: z
          .string()
          .min(1)
          .max(120)
          .describe("Short name, e.g. 'Default to action rather than over-planning'"),
        oldPattern: z.string().describe("The current default behaviour the user wants to move away from"),
        desiredDefault: z.string().describe("The behaviour they want to become automatic"),
        why: z.string().describe("Why it matters to them, in their words"),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: false,
      },
    },
    (args) =>
      run("write", async () => {
        const target = await s.changeTargets.create(userId, args);
        const tool = await s.tools.create(userId, { changeTargetId: target.id, type: toolTypeNames[0] });
        return {
          structured: { target, tool },
          summary: `Created "${target.title}" (${target.id}) with tool ${tool.name} (${tool.id}).`,
        };
      }),
  );

  server.registerTool(
    "update_change_target",
    {
      title: "Update a change target",
      description:
        "Change a target's wording or status. Only the fields given are changed. Status is one of active, paused, " +
        "achieved, archived.",
      inputSchema: {
        id: idSchema,
        fields: z
          .object({
            title: z.string().min(1).max(120).optional(),
            oldPattern: z.string().optional(),
            desiredDefault: z.string().optional(),
            why: z.string().optional(),
            status: changeTargetStatusSchema.optional(),
          })
          .describe("Fields to change"),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    ({ id, fields }) =>
      run("write", async () => {
        const patch = Object.fromEntries(Object.entries(fields).filter(([, v]) => v !== undefined));
        const target = await s.changeTargets.update(userId, id, patch);
        return { structured: { target }, summary: `Updated "${target.title}" [${target.status}].` };
      }),
  );

  server.registerPrompt(
    "weekly_review",
    {
      title: "Weekly review",
      description:
        "Reflect on the last 7 days of evidence: patterns, wins, and one experiment for next week.",
    },
    async () => {
      if (!principal.scopes.includes("read")) throw new Error("weekly_review needs the 'read' scope");
      const progress = await s.summaries.progress(userId, {
        since: new Date(now().getTime() - 7 * 86_400_000).toISOString(),
      });
      return {
        description: "Weekly review of change targets",
        messages: [
          {
            role: "user",
            content: {
              type: "text",
              text:
                "Here is my Trait Engineer progress for the last 7 days (from summarise_progress):\n\n" +
                "```json\n" +
                JSON.stringify(progress, null, 2) +
                "\n```\n\n" +
                "Please run a short weekly review with me:\n" +
                "1. Patterns: what do my entries show about when the desired default shows up, and when the old pattern wins?\n" +
                "2. Wins: name the specific moments worth acknowledging, quoting my own words.\n" +
                "3. One experiment: propose a single small, concrete experiment for next week.\n" +
                "Base everything on the entries above; do not invent events. If there is little or no evidence, say so " +
                "and ask me about my week instead.",
            },
          },
        ],
      };
    },
  );

  server.registerPrompt(
    "define_change_target",
    {
      title: "Define a change target",
      description: "A short interview to turn something you want to change into a well-formed change target.",
      argsSchema: { topic: z.string().optional().describe("What you'd like to change, in a few words") },
    },
    ({ topic }) => ({
      description: "Interview that ends in create_change_target",
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text:
              `I want to define a new change target in Trait Engineer${topic ? ` about: ${topic}` : ""}.\n\n` +
              "Interview me one question at a time to pin down:\n" +
              "- the old pattern (what I do now, concretely, and in which situations),\n" +
              "- the desired default (what I want to do instead, phrased as a behaviour, not a feeling),\n" +
              "- why it matters to me,\n" +
              "- a short title (under 120 characters).\n" +
              "Reflect my words back rather than rewriting them. When I confirm the wording, call create_change_target. " +
              "Check list_change_targets first so we don't duplicate an existing target.",
          },
        },
      ],
    }),
  );

  return server;
}
