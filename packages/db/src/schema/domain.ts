import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  foreignKey,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  unique,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { id, timestamps, tstz } from "./columns.ts";
import { users } from "./users.ts";

const userId = () =>
  uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" });

export const changeTargets = pgTable(
  "change_targets",
  {
    id: id(),
    userId: userId(),
    title: varchar("title", { length: 120 }).notNull(),
    oldPattern: text("old_pattern").notNull().default(""),
    desiredDefault: text("desired_default").notNull().default(""),
    why: text("why").notNull().default(""),
    status: text("status", { enum: ["active", "paused", "achieved", "archived"] })
      .notNull()
      .default("active"),
    sortOrder: integer("sort_order").notNull().default(0),
    archivedAt: tstz("archived_at"),
    ...timestamps,
  },
  (t) => [
    unique("change_targets_user_id_id_key").on(t.userId, t.id),
    index("change_targets_user_sort_idx").on(t.userId, t.sortOrder, t.id),
    check("change_targets_status_check", sql`${t.status} in ('active','paused','achieved','archived')`),
  ],
);

export const tools = pgTable(
  "tools",
  {
    id: id(),
    userId: userId(),
    changeTargetId: uuid("change_target_id").notNull(),
    type: text("type").notNull(),
    name: text("name").notNull(),
    config: jsonb("config").$type<Record<string, unknown>>().notNull().default({}),
    sortOrder: integer("sort_order").notNull().default(0),
    deletedAt: tstz("deleted_at"),
    ...timestamps,
  },
  (t) => [
    unique("tools_user_id_id_key").on(t.userId, t.id),
    // Composite FK: a tool can only belong to a change target owned by the same user.
    foreignKey({
      name: "tools_change_target_fk",
      columns: [t.userId, t.changeTargetId],
      foreignColumns: [changeTargets.userId, changeTargets.id],
    }).onDelete("cascade"),
    index("tools_user_target_sort_idx").on(t.userId, t.changeTargetId, t.sortOrder, t.id),
    index("tools_user_sort_idx").on(t.userId, t.sortOrder, t.id),
  ],
);

export const entries = pgTable(
  "entries",
  {
    id: id(),
    userId: userId(),
    toolId: uuid("tool_id").notNull(),
    changeTargetId: uuid("change_target_id").notNull(),
    toolType: text("tool_type").notNull(),
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull(),
    occurredAt: tstz("occurred_at").notNull().defaultNow(),
    source: text("source", { enum: ["mobile", "web", "mcp", "api"] }).notNull(),
    clientId: uuid("client_id").notNull(),
    deletedAt: tstz("deleted_at"),
    ...timestamps,
  },
  (t) => [
    unique("entries_user_client_id_key").on(t.userId, t.clientId),
    foreignKey({
      name: "entries_tool_fk",
      columns: [t.userId, t.toolId],
      foreignColumns: [tools.userId, tools.id],
    }).onDelete("cascade"),
    foreignKey({
      name: "entries_change_target_fk",
      columns: [t.userId, t.changeTargetId],
      foreignColumns: [changeTargets.userId, changeTargets.id],
    }).onDelete("cascade"),
    index("entries_user_target_occurred_idx").on(t.userId, t.changeTargetId, t.occurredAt.desc()),
    index("entries_user_occurred_idx").on(t.userId, t.occurredAt.desc(), t.id.desc()),
    index("entries_user_tool_occurred_idx").on(t.userId, t.toolId, t.occurredAt.desc()),
    check("entries_source_check", sql`${t.source} in ('mobile','web','mcp','api')`),
  ],
);

export const reminders = pgTable(
  "reminders",
  {
    id: id(),
    userId: userId(),
    toolId: uuid("tool_id"),
    changeTargetId: uuid("change_target_id"),
    rrule: text("rrule").notNull(),
    timezone: text("timezone").notNull(),
    title: text("title").notNull(),
    body: text("body").notNull().default(""),
    enabled: boolean("enabled").notNull().default(true),
    nextFireAt: tstz("next_fire_at"),
    lastFiredAt: tstz("last_fired_at"),
    ...timestamps,
  },
  (t) => [
    foreignKey({
      name: "reminders_tool_fk",
      columns: [t.userId, t.toolId],
      foreignColumns: [tools.userId, tools.id],
    }).onDelete("cascade"),
    foreignKey({
      name: "reminders_change_target_fk",
      columns: [t.userId, t.changeTargetId],
      foreignColumns: [changeTargets.userId, changeTargets.id],
    }).onDelete("cascade"),
    index("reminders_user_idx").on(t.userId),
    index("reminders_due_idx")
      .on(t.nextFireAt)
      .where(sql`${t.enabled}`),
  ],
);

export const pushDevices = pgTable(
  "push_devices",
  {
    id: id(),
    userId: userId(),
    expoPushToken: text("expo_push_token").notNull().unique(),
    platform: text("platform", { enum: ["ios", "android", "web"] }).notNull(),
    deviceName: text("device_name").notNull().default(""),
    lastSeenAt: tstz("last_seen_at").notNull().defaultNow(),
    disabledAt: tstz("disabled_at"),
    ...timestamps,
  },
  (t) => [index("push_devices_user_idx").on(t.userId)],
);

export const personalAccessTokens = pgTable(
  "personal_access_tokens",
  {
    id: id(),
    userId: userId(),
    name: text("name").notNull(),
    /** SHA-256 hex of the token; the plaintext is shown once and never stored. */
    tokenHash: text("token_hash").notNull().unique(),
    scopes: text("scopes").array().$type<("read" | "write")[]>().notNull(),
    lastUsedAt: tstz("last_used_at"),
    revokedAt: tstz("revoked_at"),
    ...timestamps,
  },
  (t) => [index("personal_access_tokens_user_idx").on(t.userId)],
);
