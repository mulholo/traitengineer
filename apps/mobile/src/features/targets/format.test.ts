import {
  countByStatus,
  groupByStatus,
  rowLabel,
  sinceLabel,
  streakLabel,
  targetStats,
  type TargetStats,
} from "./format";
import type { ChangeTarget, Status, TargetSummary } from "./hooks";

function target(id: string, status: Status, title = `Target ${id}`): ChangeTarget {
  return {
    id,
    title,
    oldPattern: "",
    desiredDefault: "",
    why: "",
    status,
    sortOrder: 0,
    archivedAt: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  };
}

const TARGETS = [
  target("a", "paused"),
  target("b", "active"),
  target("c", "archived"),
  target("d", "active"),
];

test("countByStatus counts every status and the total", () => {
  expect(countByStatus(TARGETS)).toEqual({ active: 2, paused: 1, achieved: 0, archived: 1, all: 4 });
  expect(countByStatus([])).toEqual({ active: 0, paused: 0, achieved: 0, archived: 0, all: 0 });
});

test("groupByStatus groups in status order, keeps list order within a group and drops empty groups", () => {
  expect(groupByStatus(TARGETS, "all").map((g) => [g.status, g.items.map((t) => t.id)])).toEqual([
    ["active", ["b", "d"]],
    ["paused", ["a"]],
    ["archived", ["c"]],
  ]);
  expect(groupByStatus(TARGETS, "active").map((g) => g.items.map((t) => t.id))).toEqual([["b", "d"]]);
  expect(groupByStatus(TARGETS, "achieved")).toEqual([]);
});

test("sinceLabel and streakLabel", () => {
  expect([null, undefined, 0, 1, 12].map(sinceLabel)).toEqual(["—", "—", "today", "1d ago", "12d ago"]);
  expect([undefined, 0, 1, 9].map(streakLabel)).toEqual(["—", "—", "1d", "9d"]);
});

function summary(tools: { streak: number; weeks: [string, number][] }[], entries: number): TargetSummary {
  return {
    changeTargetId: "a",
    timeZone: "UTC",
    generatedAt: "2026-11-18T00:00:00.000Z",
    totals: { entries, tools: tools.length, lastEntryAt: null, daysSinceLastEntry: entries ? 3 : null },
    tools: tools.map((t, i) => ({
      toolId: `tool-${i}`,
      name: "Evidence log",
      type: "evidence_log" as const,
      summary: {
        totalEntries: 0,
        weeklyCounts: t.weeks.map(([week, count]) => ({ week, count })),
        currentStreakDays: t.streak,
        daysSinceLastEntry: null,
        lastEntryAt: null,
      },
    })),
  };
}

test("targetStats adds a target's tools together", () => {
  const weeks: [string, number][] = [
    ["2026-W45", 1],
    ["2026-W46", 0],
  ];
  expect(targetStats(summary([{ streak: 2, weeks }], 5))).toEqual({
    entries: 5,
    daysSinceLastEntry: 3,
    streakDays: 2,
    weeks: [
      { week: "2026-W45", count: 1 },
      { week: "2026-W46", count: 0 },
    ],
  });
  const two = targetStats(
    summary(
      [
        { streak: 2, weeks },
        {
          streak: 4,
          weeks: [
            ["2026-W45", 2],
            ["2026-W46", 3],
          ],
        },
      ],
      6,
    ),
  );
  expect(two.streakDays).toBe(4);
  expect(two.weeks.map((w) => w.count)).toEqual([3, 3]);
  expect(targetStats(summary([], 0))).toEqual({
    entries: 0,
    daysSinceLastEntry: null,
    streakDays: 0,
    weeks: [],
  });
});

function stats(s: Partial<TargetStats>): TargetStats {
  return { entries: 0, daysSinceLastEntry: null, streakDays: 0, weeks: [], ...s };
}

test("rowLabel spells the row out for a screen reader", () => {
  const t = target("a", "active", "Speak up early");
  expect(rowLabel(t, undefined)).toBe("Speak up early");
  expect(rowLabel(t, stats({}))).toBe("Speak up early. 0 entries");
  expect(rowLabel(t, stats({ entries: 1, daysSinceLastEntry: 0, streakDays: 1 }))).toBe(
    "Speak up early. 1 entry, last entry today, streak 1 day",
  );
  expect(rowLabel(t, stats({ entries: 20, daysSinceLastEntry: 1 }))).toBe(
    "Speak up early. 20 entries, last entry 1 day ago",
  );
  expect(rowLabel(t, stats({ entries: 20, daysSinceLastEntry: 12, streakDays: 3 }))).toBe(
    "Speak up early. 20 entries, last entry 12 days ago, streak 3 days",
  );
});
