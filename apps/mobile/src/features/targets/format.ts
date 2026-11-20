import type { ChangeTarget, Status, TargetSummary } from "./hooks";

/** Statuses in the order the targets table groups them. */
export const STATUS_ORDER = ["active", "paused", "achieved", "archived"] as const satisfies readonly Status[];

export const STATUS_LABEL: Record<Status, string> = {
  active: "Active",
  paused: "Paused",
  achieved: "Achieved",
  archived: "Archived",
};

export type StatusFilter = Status | "all";

export function countByStatus(targets: readonly ChangeTarget[]): Record<StatusFilter, number> {
  const counts = { active: 0, paused: 0, achieved: 0, archived: 0, all: targets.length };
  for (const t of targets) counts[t.status]++;
  return counts;
}

/** Targets grouped by status in `STATUS_ORDER`, keeping their order within a group; empty groups are left out. */
export function groupByStatus(
  targets: readonly ChangeTarget[],
  filter: StatusFilter,
): { status: Status; items: ChangeTarget[] }[] {
  return STATUS_ORDER.filter((status) => filter === "all" || filter === status)
    .map((status) => ({ status, items: targets.filter((t) => t.status === status) }))
    .filter((group) => group.items.length > 0);
}

/** Age of the last entry in whole days: "today", "1d ago", "12d ago"; "—" when there is none. */
export function sinceLabel(days: number | null | undefined): string {
  if (days === null || days === undefined) return "—";
  return days <= 0 ? "today" : `${days}d ago`;
}

/** Streak length: "3d"; "—" when there is no current streak. */
export function streakLabel(days: number | undefined): string {
  return days ? `${days}d` : "—";
}

export type TargetStats = {
  entries: number;
  daysSinceLastEntry: number | null;
  /** Longest current streak across the target's tools. */
  streakDays: number;
  /** Entries per ISO week across the target's tools, oldest first. */
  weeks: { week: string; count: number }[];
};

/** One row of numbers for a target, adding its tools together. */
export function targetStats(summary: TargetSummary): TargetStats {
  const weeks = new Map<string, number>();
  let streakDays = 0;
  for (const tool of summary.tools) {
    streakDays = Math.max(streakDays, tool.summary.currentStreakDays);
    for (const w of tool.summary.weeklyCounts) weeks.set(w.week, (weeks.get(w.week) ?? 0) + w.count);
  }
  return {
    entries: summary.totals.entries,
    daysSinceLastEntry: summary.totals.daysSinceLastEntry,
    streakDays,
    weeks: [...weeks].map(([week, count]) => ({ week, count })).sort((a, b) => a.week.localeCompare(b.week)),
  };
}

/** What a screen reader says for a row: the title, then what the columns show. */
export function rowLabel(target: ChangeTarget, stats: TargetStats | undefined): string {
  const parts: string[] = [];
  if (stats) {
    parts.push(stats.entries === 1 ? "1 entry" : `${stats.entries} entries`);
    if (stats.daysSinceLastEntry !== null)
      parts.push(
        stats.daysSinceLastEntry <= 0
          ? "last entry today"
          : stats.daysSinceLastEntry === 1
            ? "last entry 1 day ago"
            : `last entry ${stats.daysSinceLastEntry} days ago`,
      );
    if (stats.streakDays > 0)
      parts.push(stats.streakDays === 1 ? "streak 1 day" : `streak ${stats.streakDays} days`);
  }
  return parts.length ? `${target.title}. ${parts.join(", ")}` : target.title;
}
