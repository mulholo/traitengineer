import {
  DEFAULT_TIME_ZONE,
  daysBetween,
  getToolType,
  localDate,
  type ChangeTargetSummary,
  type Entry,
  type ToolSummary,
} from "@te/contracts";
import { NotFoundError } from "../errors.ts";
import type { ServiceDeps } from "./context.ts";

export type SummaryService = ReturnType<typeof createSummaryService>;

export function createSummaryService({ repos, now }: ServiceDeps) {
  async function timeZoneOf(userId: string): Promise<string> {
    return (await repos.users.get(userId))?.timezone ?? DEFAULT_TIME_ZONE;
  }

  return {
    /** Per-tool summaries from the registry plus totals for one change target. */
    async forChangeTarget(
      userId: string,
      changeTargetId: string,
      opts: { weeks?: number } = {},
    ): Promise<ChangeTargetSummary> {
      const target = await repos.changeTargets.get(userId, changeTargetId);
      if (!target) throw new NotFoundError("Change target", changeTargetId);
      const timeZone = await timeZoneOf(userId);
      const at = now();
      const tools = await repos.tools.list(userId, { changeTargetId, limit: 1000 });
      const entries = await repos.entries.listForTools(
        userId,
        tools.map((t) => t.id),
      );
      const byTool = new Map<string, Entry[]>();
      for (const e of entries) byTool.set(e.toolId, [...(byTool.get(e.toolId) ?? []), e]);

      const toolSummaries = tools.map((tool) => {
        const def = getToolType(tool.type);
        const summary = def.summarise(byTool.get(tool.id) ?? [], {
          timeZone,
          now: at,
          ...(opts.weeks ? { weeks: opts.weeks } : {}),
        });
        return { toolId: tool.id, name: tool.name, type: tool.type, summary } as ToolSummary;
      });

      const last = entries.reduce<string | null>(
        (acc, e) => (acc === null || Date.parse(e.occurredAt) > Date.parse(acc) ? e.occurredAt : acc),
        null,
      );
      return {
        changeTargetId,
        timeZone,
        generatedAt: at.toISOString(),
        totals: {
          entries: entries.length,
          tools: tools.length,
          lastEntryAt: last,
          daysSinceLastEntry:
            last === null ? null : daysBetween(localDate(last, timeZone), localDate(at, timeZone)),
        },
        tools: toolSummaries,
      };
    },
  };
}
