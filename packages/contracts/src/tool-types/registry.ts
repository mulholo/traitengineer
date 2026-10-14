import { z } from "zod";
import { evidenceLog } from "./evidence-log.ts";
import type { SummarisableEntry, SummariseContext } from "./types.ts";

/** Every tool type the system knows about, keyed by `type`. Unknown types are rejected on every write. */
export const toolTypes = {
  evidence_log: evidenceLog,
} as const;

export type ToolType = keyof typeof toolTypes;
export const toolTypeNames = Object.keys(toolTypes) as [ToolType, ...ToolType[]];
export const toolTypeSchema = z.enum(toolTypeNames);

export function isToolType(type: string): type is ToolType {
  return Object.hasOwn(toolTypes, type);
}

/** Type-erased view of a registry entry for generic code paths (validation, summaries). */
export interface AnyToolType {
  type: ToolType;
  displayName: string;
  description: string;
  configSchema: z.ZodType<Record<string, unknown>>;
  payloadSchema: z.ZodType<Record<string, unknown>>;
  summarySchema: z.ZodType;
  summarise(entries: readonly SummarisableEntry<unknown>[], ctx: SummariseContext): unknown;
}

export function getToolType(type: ToolType): AnyToolType {
  return toolTypes[type] as AnyToolType;
}

const toolSummaryBase = { toolId: z.uuid(), name: z.string() };

/** One tool's summary (discriminated by `type`). Add a branch here when adding a tool type. */
export const toolSummarySchema = z
  .discriminatedUnion("type", [
    z.object({ ...toolSummaryBase, type: z.literal("evidence_log"), summary: evidenceLog.summarySchema }),
  ])
  .meta({ id: "ToolSummary" });
export type ToolSummary = z.infer<typeof toolSummarySchema>;
