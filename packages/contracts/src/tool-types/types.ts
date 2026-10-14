import type { z } from "zod";

export interface SummariseContext {
  /** IANA zone used to bucket entries into calendar days and weeks. */
  timeZone: string;
  now: Date;
  /** How many ISO weeks of counts to return (default 12). */
  weeks?: number;
}

export interface SummarisableEntry<P> {
  occurredAt: string;
  payload: P;
}

/** What every tool type must export. Adding a type: see the checklist in AGENTS.md. */
export interface ToolTypeDefinition<
  TType extends string,
  TConfig extends z.ZodType,
  TPayload extends z.ZodType,
  TSummary extends z.ZodType,
> {
  type: TType;
  displayName: string;
  /** Written for an LLM reader: what an entry of this type records. */
  description: string;
  configSchema: TConfig;
  payloadSchema: TPayload;
  summarySchema: TSummary;
  summarise(
    entries: readonly SummarisableEntry<z.output<TPayload>>[],
    ctx: SummariseContext,
  ): z.output<TSummary>;
}
