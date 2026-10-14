import {
  DEFAULT_TIME_ZONE,
  daysBetween,
  getToolType,
  localDate,
  progressQuerySchema,
  type ChangeTarget,
  type ChangeTargetSummary,
  type Entry,
  type ProgressQuery,
  type ProgressSummary,
  type ToolSummary,
} from "@te/contracts";
import { parseOrThrow } from "../validate.ts";
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

    /**
     * Progress across targets for a period (default: every active target, last 28 days): weekly counts, streaks,
     * days since last entry, and the user's own words from recent entries. Used by MCP `summarise_progress`.
     */
    async progress(userId: string, query: ProgressQuery = {}): Promise<ProgressSummary> {
      const q = parseOrThrow(progressQuerySchema, query, "query");
      const at = now();
      const since = q.since ? new Date(q.since) : new Date(at.getTime() - 28 * 86_400_000);
      const weeks = Math.min(
        52,
        Math.max(1, Math.ceil((at.getTime() - since.getTime()) / (7 * 86_400_000)) + 1),
      );
      const timeZone = await timeZoneOf(userId);

      let targets: ChangeTarget[];
      if (q.changeTargetId) {
        const t = await repos.changeTargets.get(userId, q.changeTargetId);
        if (!t) throw new NotFoundError("Change target", q.changeTargetId);
        targets = [t];
      } else {
        targets = await repos.changeTargets.list(userId, { status: "active", limit: 1000 });
      }

      const results = [];
      for (const target of targets) {
        const tools = await repos.tools.list(userId, { changeTargetId: target.id, limit: 1000 });
        const entries = await repos.entries.listForTools(
          userId,
          tools.map((t) => t.id),
        );
        const toolName = new Map(tools.map((t) => [t.id, t.name]));
        const inPeriod = entries.filter((e) => Date.parse(e.occurredAt) >= since.getTime());
        const last = entries[0]?.occurredAt ?? null; // newest first
        results.push({
          changeTargetId: target.id,
          title: target.title,
          status: target.status,
          oldPattern: target.oldPattern,
          desiredDefault: target.desiredDefault,
          entriesInPeriod: inPeriod.length,
          daysSinceLastEntry:
            last === null ? null : daysBetween(localDate(last, timeZone), localDate(at, timeZone)),
          tools: tools.map(
            (tool) =>
              ({
                toolId: tool.id,
                name: tool.name,
                type: tool.type,
                summary: getToolType(tool.type).summarise(
                  entries.filter((e) => e.toolId === tool.id),
                  { timeZone, now: at, weeks },
                ),
              }) as ToolSummary,
          ),
          recentEntries: inPeriod.slice(0, 20).map((e) => ({
            entryId: e.id,
            occurredAt: e.occurredAt,
            toolName: toolName.get(e.toolId) ?? "",
            words: e.payload,
          })),
        });
      }
      return { since: since.toISOString(), until: at.toISOString(), timeZone, targets: results };
    },
  };
}
