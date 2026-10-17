import type { ChangeTarget, Entry, Export, Tool } from "@te/contracts";
import { localDate } from "@te/contracts";
import { NotFoundError } from "../errors.ts";
import type { ServiceDeps } from "./context.ts";
import { toReminder } from "./reminders.ts";

export type ExportService = ReturnType<typeof createExportService>;

const field = (label: string, value: unknown) =>
  typeof value === "string" && value.trim()
    ? `  - **${label}:** ${value.trim().replaceAll("\n", " ")}\n`
    : "";

/** Human-readable Markdown rendering of an export (used for the share sheet). */
export function renderExportMarkdown(data: Export): string {
  const tz = data.user.timezone;
  let md = `# Trait Engineer export\n\nExported ${data.exportedAt} · time zone ${tz}\n`;
  const toolsByTarget = new Map<string, Tool[]>();
  for (const t of data.tools)
    toolsByTarget.set(t.changeTargetId, [...(toolsByTarget.get(t.changeTargetId) ?? []), t]);
  const entriesByTool = new Map<string, Entry[]>();
  for (const e of data.entries) entriesByTool.set(e.toolId, [...(entriesByTool.get(e.toolId) ?? []), e]);

  for (const target of data.changeTargets) {
    md += `\n## ${target.title}\n\n_Status: ${target.status}_\n\n`;
    if (target.oldPattern) md += `**Old pattern:** ${target.oldPattern}\n\n`;
    if (target.desiredDefault) md += `**Desired default:** ${target.desiredDefault}\n\n`;
    if (target.why) md += `**Why it matters:** ${target.why}\n\n`;
    for (const tool of toolsByTarget.get(target.id) ?? []) {
      const entries = entriesByTool.get(tool.id) ?? [];
      md += `### ${tool.name} (${entries.length} entries)\n\n`;
      for (const e of entries) {
        const p = e.payload;
        md += `- ${localDate(e.occurredAt, tz)} — ${String(p["summary"] ?? "")}\n`;
        md +=
          field("Expected", p["expected"]) +
          field("Happened", p["happened"]) +
          field("Supports", p["supports"]);
        md += field("Uncertain", p["uncertain"]) + field("Details", p["details"]);
        if (typeof p["difficulty"] === "number") md += `  - **Difficulty:** ${p["difficulty"]}/5\n`;
        if (Array.isArray(p["tags"]) && p["tags"].length > 0) md += `  - **Tags:** ${p["tags"].join(", ")}\n`;
      }
      md += "\n";
    }
  }
  return md;
}

export function createExportService({ repos, now }: ServiceDeps) {
  return {
    /** Everything for the user. Excludes credentials, tokens, devices and the email address. */
    async exportAll(userId: string): Promise<Export> {
      const user = await repos.users.get(userId);
      if (!user) throw new NotFoundError("User", userId);
      // Single-user data volumes: fetch everything in one go (no pagination needed).
      const changeTargets: ChangeTarget[] = await repos.changeTargets.list(userId, { limit: 1_000_000 });
      const tools: Tool[] = await repos.tools.list(userId, { limit: 1_000_000 });
      // All live entries, including those of deleted tools (evidence is never dropped from an export).
      const entries: Entry[] = await repos.entries.list(userId, { limit: 1_000_000 });
      const reminders = (await repos.reminders.list(userId)).map(toReminder);
      return {
        version: 1,
        exportedAt: now().toISOString(),
        user: { id: user.id, displayName: user.displayName, timezone: user.timezone },
        changeTargets,
        tools,
        entries,
        reminders,
      };
    },
  };
}
