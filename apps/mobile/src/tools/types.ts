import type { Schemas } from "@te/client";
import type { ComponentType } from "react";

export type Tool = Schemas["Tool"];
export type Entry = Schemas["Entry"];

export interface QuickLogFormProps {
  tool: Tool;
  /** Existing payload when editing an entry. */
  initialPayload?: Record<string, unknown> | undefined;
  submitLabel?: string | undefined;
  busy?: boolean | undefined;
  onSubmit(payload: Record<string, unknown>): void;
}

export interface EntryCardProps {
  entry: Entry;
  toolName?: string | undefined;
  onPress?: (() => void) | undefined;
}

export interface ToolUi {
  QuickLogForm: ComponentType<QuickLogFormProps>;
  EntryCard: ComponentType<EntryCardProps>;
}
