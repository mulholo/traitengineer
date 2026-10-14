import type { ChangeTarget, ChangeTargetStatus, Entry, Source, Tool, ToolType } from "@te/contracts";
import type { SortKey, TimeKey } from "./cursor.ts";

/**
 * Persistence ports. `@te/db` implements them with Drizzle. Every method is scoped by `userId`; an
 * implementation must never return or modify another user's rows.
 */

export interface User {
  id: string;
  email: string;
  displayName: string;
  timezone: string;
  createdAt: string;
  updatedAt: string;
}

export interface UserRepository {
  get(userId: string): Promise<User | null>;
  update(userId: string, patch: Partial<Pick<User, "displayName" | "timezone">>): Promise<User | null>;
}

export interface NewChangeTarget {
  title: string;
  oldPattern: string;
  desiredDefault: string;
  why: string;
  status: ChangeTargetStatus;
  sortOrder: number;
}

export type ChangeTargetPatch = Partial<NewChangeTarget & { archivedAt: string | null }>;

export interface ChangeTargetRepository {
  create(userId: string, data: NewChangeTarget): Promise<ChangeTarget>;
  get(userId: string, id: string): Promise<ChangeTarget | null>;
  /** Ordered by (sortOrder, id); returns up to `limit` rows after `after`. */
  list(
    userId: string,
    q: { status?: ChangeTargetStatus; limit: number; after?: SortKey },
  ): Promise<ChangeTarget[]>;
  update(userId: string, id: string, patch: ChangeTargetPatch): Promise<ChangeTarget | null>;
  maxSortOrder(userId: string): Promise<number | null>;
}

export interface NewTool {
  changeTargetId: string;
  type: ToolType;
  name: string;
  config: Record<string, unknown>;
  sortOrder: number;
}

export interface ToolRepository {
  create(userId: string, data: NewTool): Promise<Tool>;
  /** Excludes soft-deleted tools. */
  get(userId: string, id: string): Promise<Tool | null>;
  /** Ordered by (sortOrder, id). Excludes soft-deleted tools. */
  list(userId: string, q: { changeTargetId?: string; limit: number; after?: SortKey }): Promise<Tool[]>;
  update(
    userId: string,
    id: string,
    patch: Partial<Pick<Tool, "name" | "config" | "sortOrder">>,
  ): Promise<Tool | null>;
  softDelete(userId: string, id: string, at: string): Promise<boolean>;
  maxSortOrder(userId: string, changeTargetId: string): Promise<number | null>;
}

export interface NewEntry {
  toolId: string;
  changeTargetId: string;
  toolType: ToolType;
  payload: Record<string, unknown>;
  occurredAt: string;
  source: Source;
  clientId: string;
}

export interface EntryFilter {
  changeTargetId?: string;
  toolId?: string;
  since?: string;
  until?: string;
  tag?: string;
}

export interface EntryRepository {
  /** Inserts unless (userId, clientId) exists; returns the stored row and whether it was created. */
  createIdempotent(userId: string, data: NewEntry): Promise<{ entry: Entry; created: boolean }>;
  /** Excludes soft-deleted entries. */
  get(userId: string, id: string): Promise<Entry | null>;
  /** Ordered by (occurredAt desc, id desc). Excludes soft-deleted entries. */
  list(userId: string, q: EntryFilter & { limit: number; after?: TimeKey }): Promise<Entry[]>;
  update(
    userId: string,
    id: string,
    patch: Partial<Pick<Entry, "payload" | "occurredAt">>,
  ): Promise<Entry | null>;
  softDelete(userId: string, id: string, at: string): Promise<boolean>;
  /** Every live entry for the given tools, newest first (for summaries). */
  listForTools(userId: string, toolIds: string[]): Promise<Entry[]>;
}

export interface Repositories {
  users: UserRepository;
  changeTargets: ChangeTargetRepository;
  tools: ToolRepository;
  entries: EntryRepository;
}
