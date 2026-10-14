import { z } from "zod";
import { addDays, daysBetween, isoWeek, lastIsoWeeks, localDate } from "../time.ts";
import type { SummarisableEntry, SummariseContext, ToolTypeDefinition } from "./types.ts";

const longText = z.string().trim().max(5000);

export const evidenceLogConfigSchema = z
  .object({
    prompt: z.string().trim().min(1).max(200).default("What did you do?"),
    askDifficulty: z.boolean().default(true),
  })
  .meta({ id: "EvidenceLogConfig" });
export type EvidenceLogConfig = z.infer<typeof evidenceLogConfigSchema>;

/** See ADR 0023 for how these fields map to the spec's "what I expected / did / ..." prompts. */
export const evidenceLogPayloadSchema = z
  .object({
    summary: z
      .string()
      .trim()
      .min(1)
      .max(280)
      .meta({ description: "What I did — one line, e.g. 'Sent the proposal without a third rewrite'" }),
    expected: longText.optional().meta({ description: "What I expected to happen" }),
    happened: longText.optional().meta({ description: "What actually happened" }),
    supports: longText
      .optional()
      .meta({ description: "What this supports (the belief or default it is evidence for)" }),
    uncertain: longText.optional().meta({ description: "What remains uncertain" }),
    details: longText.optional().meta({ description: "Any other notes" }),
    difficulty: z.number().int().min(1).max(5).optional().meta({ description: "1 (easy) to 5 (very hard)" }),
    tags: z.array(z.string().trim().min(1).max(50)).max(10).default([]),
  })
  .meta({ id: "EvidenceLogPayload" });
export type EvidenceLogPayload = z.infer<typeof evidenceLogPayloadSchema>;

export const evidenceLogSummarySchema = z
  .object({
    totalEntries: z.number().int(),
    weeklyCounts: z.array(
      z.object({ week: z.string().meta({ example: "2026-W42" }), count: z.number().int() }),
    ),
    currentStreakDays: z.number().int().meta({
      description: "Consecutive days with an entry, ending today (or yesterday if nothing logged yet today)",
    }),
    daysSinceLastEntry: z.number().int().nullable(),
    lastEntryAt: z.string().nullable(),
  })
  .meta({ id: "EvidenceLogSummary" });
export type EvidenceLogSummary = z.infer<typeof evidenceLogSummarySchema>;

export function summariseEvidenceLog(
  entries: readonly SummarisableEntry<unknown>[],
  ctx: SummariseContext,
): EvidenceLogSummary {
  const today = localDate(ctx.now, ctx.timeZone);
  const weeks = lastIsoWeeks(today, ctx.weeks ?? 12);
  const counts = new Map(weeks.map((w) => [w, 0]));
  const days = new Set<string>();
  let lastEntryAt: string | null = null;

  for (const e of entries) {
    const day = localDate(e.occurredAt, ctx.timeZone);
    days.add(day);
    const week = isoWeek(day);
    const c = counts.get(week);
    if (c !== undefined) counts.set(week, c + 1);
    if (lastEntryAt === null || Date.parse(e.occurredAt) > Date.parse(lastEntryAt))
      lastEntryAt = e.occurredAt;
  }

  let cursor = days.has(today) ? today : addDays(today, -1);
  let streak = 0;
  while (days.has(cursor)) {
    streak++;
    cursor = addDays(cursor, -1);
  }

  return {
    totalEntries: entries.length,
    weeklyCounts: weeks.map((week) => ({ week, count: counts.get(week) ?? 0 })),
    currentStreakDays: streak,
    daysSinceLastEntry:
      lastEntryAt === null ? null : daysBetween(localDate(lastEntryAt, ctx.timeZone), today),
    lastEntryAt: lastEntryAt === null ? null : new Date(lastEntryAt).toISOString(),
  };
}

export const evidenceLog = {
  type: "evidence_log",
  displayName: "Evidence log",
  description:
    "A log of concrete moments where the user acted on (or against) the desired default. Each entry's payload has " +
    "`summary` (required, ≤280 chars: what they did), optional `expected`, `happened`, `supports`, `uncertain`, " +
    "`details`, `difficulty` (1–5) and `tags` (≤10 strings).",
  configSchema: evidenceLogConfigSchema,
  payloadSchema: evidenceLogPayloadSchema,
  summarySchema: evidenceLogSummarySchema,
  summarise: summariseEvidenceLog,
} as const satisfies ToolTypeDefinition<
  "evidence_log",
  typeof evidenceLogConfigSchema,
  typeof evidenceLogPayloadSchema,
  typeof evidenceLogSummarySchema
>;
