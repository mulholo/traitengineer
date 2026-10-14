import { describe, expect, test } from "vitest";
import { evidenceLog, evidenceLogConfigSchema, evidenceLogPayloadSchema } from "./evidence-log.ts";
import { getToolType, isToolType, toolTypeNames, toolTypeSchema } from "./registry.ts";

describe("evidence_log schemas", () => {
  test("config has defaults", () => {
    expect(evidenceLogConfigSchema.parse({})).toEqual({ prompt: "What did you do?", askDifficulty: true });
  });

  test("payload requires a 1–280 char summary", () => {
    expect(evidenceLogPayloadSchema.safeParse({}).success).toBe(false);
    expect(evidenceLogPayloadSchema.safeParse({ summary: "   " }).success).toBe(false);
    expect(evidenceLogPayloadSchema.safeParse({ summary: "x".repeat(281) }).success).toBe(false);
    expect(evidenceLogPayloadSchema.parse({ summary: "Sent it" })).toEqual({ summary: "Sent it", tags: [] });
  });

  test("payload accepts the reflection fields, difficulty 1–5 and at most 10 tags", () => {
    const full = {
      summary: "Sent the proposal without a third rewrite",
      expected: "They would think it was sloppy",
      happened: "They signed it the same day",
      supports: "Good enough is good enough",
      uncertain: "Whether this generalises to bigger clients",
      difficulty: 3,
      tags: ["work"],
    };
    expect(evidenceLogPayloadSchema.parse(full)).toEqual(full);
    expect(evidenceLogPayloadSchema.safeParse({ summary: "a", difficulty: 6 }).success).toBe(false);
    expect(evidenceLogPayloadSchema.safeParse({ summary: "a", difficulty: 2.5 }).success).toBe(false);
    expect(evidenceLogPayloadSchema.safeParse({ summary: "a", tags: Array(11).fill("t") }).success).toBe(
      false,
    );
  });
});

const at = (iso: string) => ({ occurredAt: iso, payload: { summary: "x", tags: [] } });

describe("evidence_log summarise", () => {
  const tz = "Europe/London";

  test("empty log", () => {
    const s = evidenceLog.summarise([], { timeZone: tz, now: new Date("2026-10-14T12:00:00Z"), weeks: 2 });
    expect(s).toEqual({
      totalEntries: 0,
      weeklyCounts: [
        { week: "2026-W41", count: 0 },
        { week: "2026-W42", count: 0 },
      ],
      currentStreakDays: 0,
      daysSinceLastEntry: null,
      lastEntryAt: null,
    });
  });

  test("counts per ISO week, streak and days since last entry", () => {
    const s = evidenceLog.summarise(
      [
        at("2026-10-12T09:00:00Z"),
        at("2026-10-13T09:00:00Z"),
        at("2026-10-13T20:00:00Z"),
        at("2026-10-14T07:00:00Z"),
        at("2026-10-01T07:00:00Z"),
      ],
      { timeZone: tz, now: new Date("2026-10-14T12:00:00Z"), weeks: 3 },
    );
    expect(s.totalEntries).toBe(5);
    expect(s.weeklyCounts).toEqual([
      { week: "2026-W40", count: 1 },
      { week: "2026-W41", count: 0 },
      { week: "2026-W42", count: 4 },
    ]);
    expect(s.currentStreakDays).toBe(3);
    expect(s.daysSinceLastEntry).toBe(0);
    expect(s.lastEntryAt).toBe("2026-10-14T07:00:00.000Z");
  });

  test("streak still counts if nothing logged yet today, and breaks after a missed day", () => {
    const entries = [at("2026-10-12T09:00:00Z"), at("2026-10-13T09:00:00Z")];
    const ctx = { timeZone: tz, weeks: 1 };
    expect(
      evidenceLog.summarise(entries, { ...ctx, now: new Date("2026-10-14T12:00:00Z") }).currentStreakDays,
    ).toBe(2);
    const later = evidenceLog.summarise(entries, { ...ctx, now: new Date("2026-10-15T12:00:00Z") });
    expect(later.currentStreakDays).toBe(0);
    expect(later.daysSinceLastEntry).toBe(2);
  });

  test("streak uses the user's time zone across the October DST boundary", () => {
    // Late-evening entries in London local time on 24, 25 and 26 Oct 2026 (clocks go back on the 25th).
    const entries = [
      at("2026-10-24T22:30:00Z"), // 23:30 BST on the 24th
      at("2026-10-25T23:30:00Z"), // 23:30 GMT on the 25th
      at("2026-10-26T23:30:00Z"), // 23:30 GMT on the 26th
    ];
    const s = evidenceLog.summarise(entries, {
      timeZone: tz,
      now: new Date("2026-10-26T23:45:00Z"),
      weeks: 2,
    });
    expect(s.currentStreakDays).toBe(3);
    expect(s.daysSinceLastEntry).toBe(0);
    // The 24th and 25th are in W43 (Mon 19–Sun 25), the 26th starts W44.
    expect(s.weeklyCounts).toEqual([
      { week: "2026-W43", count: 2 },
      { week: "2026-W44", count: 1 },
    ]);
    // In UTC the same instants would also be three days, but a New York user sees different days.
    const ny = evidenceLog.summarise(entries, {
      timeZone: "America/New_York",
      now: new Date("2026-10-26T23:45:00Z"),
    });
    expect(ny.currentStreakDays).toBe(3);
  });

  test("streak across the March DST boundary", () => {
    // 00:30 local each day 28–30 Mar 2026 (clocks go forward on the 29th).
    const entries = [at("2026-03-28T00:30:00Z"), at("2026-03-29T00:30:00Z"), at("2026-03-29T23:30:00Z")];
    const s = evidenceLog.summarise(entries, {
      timeZone: tz,
      now: new Date("2026-03-30T10:00:00Z"),
      weeks: 1,
    });
    expect(s.currentStreakDays).toBe(3);
  });
});

describe("registry", () => {
  test("knows evidence_log and rejects unknown types", () => {
    expect(toolTypeNames).toContain("evidence_log");
    expect(isToolType("evidence_log")).toBe(true);
    expect(isToolType("mood_tracker")).toBe(false);
    expect(isToolType("__proto__")).toBe(false);
    expect(toolTypeSchema.safeParse("mood_tracker").success).toBe(false);
    expect(getToolType("evidence_log").displayName).toBe("Evidence log");
  });
});
