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
  /** Worker only (not user-scoped): every user ID, for jobs like the nightly archive. */
  listIds(): Promise<string[]>;
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

export interface ReminderRecord {
  id: string;
  toolId: string | null;
  changeTargetId: string | null;
  rrule: string;
  timezone: string;
  title: string;
  body: string;
  enabled: boolean;
  nextFireAt: string | null;
  lastFiredAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export type NewReminder = Omit<ReminderRecord, "id" | "createdAt" | "updatedAt" | "lastFiredAt">;

export interface ReminderRepository {
  create(userId: string, data: NewReminder): Promise<ReminderRecord>;
  get(userId: string, id: string): Promise<ReminderRecord | null>;
  list(userId: string): Promise<ReminderRecord[]>;
  update(userId: string, id: string, patch: Partial<NewReminder>): Promise<ReminderRecord | null>;
  delete(userId: string, id: string): Promise<boolean>;
  /** Worker only (not user-scoped): enabled reminders with next_fire_at <= now, oldest first. */
  listDue(now: string, limit: number): Promise<(ReminderRecord & { userId: string })[]>;
  /**
   * Compare-and-set: move a reminder to its next occurrence only if `next_fire_at` still equals `expected`.
   * Returns false if another dispatcher already advanced it, which is what makes delivery exactly-once.
   */
  advance(
    id: string,
    expected: string,
    next: { nextFireAt: string | null; lastFiredAt: string },
  ): Promise<boolean>;
}

export interface DeviceRecord {
  id: string;
  expoPushToken: string;
  platform: "ios" | "android" | "web";
  deviceName: string;
  lastSeenAt: string;
  disabledAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface DeviceRepository {
  /** Insert or re-own by push token; re-enables a disabled device and bumps last_seen_at. */
  upsert(
    userId: string,
    data: Pick<DeviceRecord, "expoPushToken" | "platform" | "deviceName">,
    at: string,
  ): Promise<DeviceRecord>;
  list(userId: string): Promise<DeviceRecord[]>;
  disable(userId: string, id: string, at: string): Promise<boolean>;
  /** Not user-scoped: push receipts only know the token. */
  disableByToken(expoPushToken: string, at: string): Promise<void>;
}

export interface TokenRecord {
  id: string;
  userId: string;
  name: string;
  scopes: ("read" | "write")[];
  lastUsedAt: string | null;
  revokedAt: string | null;
  createdAt: string;
}

export interface TokenRepository {
  create(
    userId: string,
    data: { name: string; tokenHash: string; scopes: ("read" | "write")[] },
  ): Promise<TokenRecord>;
  list(userId: string): Promise<TokenRecord[]>;
  revoke(userId: string, id: string, at: string): Promise<boolean>;
  /** Not user-scoped: this is how a bearer token is resolved to a user. Excludes revoked tokens. */
  findActiveByHash(tokenHash: string): Promise<TokenRecord | null>;
  touch(id: string, at: string): Promise<void>;
}

export interface PushTicketRepository {
  record(tickets: { userId: string; ticketId: string; expoPushToken: string }[], at: string): Promise<void>;
  /** Tickets with no receipt check yet, created before `before`. */
  listUnchecked(before: string, limit: number): Promise<{ ticketId: string; expoPushToken: string }[]>;
  markChecked(ticketIds: string[], at: string): Promise<void>;
}

export interface LoginAttemptRecord {
  key: string;
  failures: number;
  windowStartedAt: string;
  lockedUntil: string | null;
}

export interface LoginAttemptRepository {
  get(keys: string[]): Promise<LoginAttemptRecord[]>;
  put(record: LoginAttemptRecord): Promise<void>;
  clear(keys: string[]): Promise<void>;
}

export interface Repositories {
  users: UserRepository;
  changeTargets: ChangeTargetRepository;
  tools: ToolRepository;
  entries: EntryRepository;
  reminders: ReminderRepository;
  devices: DeviceRepository;
  tokens: TokenRepository;
  loginAttempts: LoginAttemptRepository;
  pushTickets: PushTicketRepository;
}
