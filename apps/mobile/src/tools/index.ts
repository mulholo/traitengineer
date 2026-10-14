import type { ToolType } from "@te/contracts";
import { EntryCard as EvidenceEntryCard } from "./evidence_log/EntryCard";
import { QuickLogForm as EvidenceQuickLogForm } from "./evidence_log/QuickLogForm";
import type { ToolUi } from "./types";

/**
 * UI for every tool type in the registry. Typed as a complete Record over `ToolType`, so adding a type to
 * `@te/contracts` without UI here fails typecheck (and `tools.test.ts`).
 */
export const toolUi: Record<ToolType, ToolUi> = {
  evidence_log: { QuickLogForm: EvidenceQuickLogForm, EntryCard: EvidenceEntryCard },
};

export function uiFor(type: string): ToolUi | undefined {
  return (toolUi as Record<string, ToolUi | undefined>)[type];
}

export type { ToolUi } from "./types";
