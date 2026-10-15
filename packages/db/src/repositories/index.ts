import type { Repositories } from "@te/core";
import { and, desc, eq, gte, inArray, isNull, lte, max, sql, type SQL } from "drizzle-orm";
import type { Database } from "../client.ts";
import { changeTargets, entries, tools, users } from "../schema/index.ts";
import { toChangeTarget, toEntry, toTool, toUser } from "./mappers.ts";
import {
  createDeviceRepository,
  createLoginAttemptRepository,
  createPushTicketRepository,
  createReminderRepository,
  createTokenRepository,
} from "./support.ts";

/** Drizzle implementations of the core repository ports. Every query is scoped by user_id. */
export function createRepositories(db: Database): Repositories {
  return {
    users: {
      async get(userId) {
        const [row] = await db.select().from(users).where(eq(users.id, userId));
        return row ? toUser(row) : null;
      },
      async update(userId, patch) {
        if (Object.keys(patch).length === 0) return this.get(userId);
        const [row] = await db.update(users).set(patch).where(eq(users.id, userId)).returning();
        return row ? toUser(row) : null;
      },
    },

    changeTargets: {
      async create(userId, data) {
        const [row] = await db
          .insert(changeTargets)
          .values({ ...data, userId })
          .returning();
        if (!row) throw new Error("insert returned no row");
        return toChangeTarget(row);
      },
      async get(userId, id) {
        const [row] = await db
          .select()
          .from(changeTargets)
          .where(and(eq(changeTargets.userId, userId), eq(changeTargets.id, id)));
        return row ? toChangeTarget(row) : null;
      },
      async list(userId, q) {
        const where: SQL[] = [eq(changeTargets.userId, userId)];
        if (q.status) where.push(eq(changeTargets.status, q.status));
        if (q.after)
          where.push(
            sql`(${changeTargets.sortOrder}, ${changeTargets.id}) > (${q.after.sortOrder}, ${q.after.id}::uuid)`,
          );
        const rows = await db
          .select()
          .from(changeTargets)
          .where(and(...where))
          .orderBy(changeTargets.sortOrder, changeTargets.id)
          .limit(q.limit);
        return rows.map(toChangeTarget);
      },
      async update(userId, id, patch) {
        const { archivedAt, ...rest } = patch;
        const set = {
          ...rest,
          ...(archivedAt === undefined
            ? {}
            : { archivedAt: archivedAt === null ? null : new Date(archivedAt) }),
          updatedAt: new Date(),
        };
        const [row] = await db
          .update(changeTargets)
          .set(set)
          .where(and(eq(changeTargets.userId, userId), eq(changeTargets.id, id)))
          .returning();
        return row ? toChangeTarget(row) : null;
      },
      async maxSortOrder(userId) {
        const [row] = await db
          .select({ value: max(changeTargets.sortOrder) })
          .from(changeTargets)
          .where(eq(changeTargets.userId, userId));
        return row?.value ?? null;
      },
    },

    tools: {
      async create(userId, data) {
        const [row] = await db
          .insert(tools)
          .values({ ...data, userId })
          .returning();
        if (!row) throw new Error("insert returned no row");
        return toTool(row);
      },
      async get(userId, id) {
        const [row] = await db
          .select()
          .from(tools)
          .where(and(eq(tools.userId, userId), eq(tools.id, id), isNull(tools.deletedAt)));
        return row ? toTool(row) : null;
      },
      async list(userId, q) {
        const where: SQL[] = [eq(tools.userId, userId), isNull(tools.deletedAt)];
        if (q.changeTargetId) where.push(eq(tools.changeTargetId, q.changeTargetId));
        if (q.after)
          where.push(sql`(${tools.sortOrder}, ${tools.id}) > (${q.after.sortOrder}, ${q.after.id}::uuid)`);
        const rows = await db
          .select()
          .from(tools)
          .where(and(...where))
          .orderBy(tools.sortOrder, tools.id)
          .limit(q.limit);
        return rows.map(toTool);
      },
      async update(userId, id, patch) {
        const [row] = await db
          .update(tools)
          .set({ ...patch, updatedAt: new Date() })
          .where(and(eq(tools.userId, userId), eq(tools.id, id), isNull(tools.deletedAt)))
          .returning();
        return row ? toTool(row) : null;
      },
      async softDelete(userId, id, at) {
        const rows = await db
          .update(tools)
          .set({ deletedAt: new Date(at), updatedAt: new Date() })
          .where(and(eq(tools.userId, userId), eq(tools.id, id), isNull(tools.deletedAt)))
          .returning({ id: tools.id });
        return rows.length > 0;
      },
      async maxSortOrder(userId, changeTargetId) {
        const [row] = await db
          .select({ value: max(tools.sortOrder) })
          .from(tools)
          .where(and(eq(tools.userId, userId), eq(tools.changeTargetId, changeTargetId)));
        return row?.value ?? null;
      },
    },

    entries: {
      async createIdempotent(userId, data) {
        const [inserted] = await db
          .insert(entries)
          .values({ ...data, userId, occurredAt: new Date(data.occurredAt) })
          .onConflictDoNothing({ target: [entries.userId, entries.clientId] })
          .returning();
        if (inserted) return { entry: toEntry(inserted), created: true };
        const [existing] = await db
          .select()
          .from(entries)
          .where(and(eq(entries.userId, userId), eq(entries.clientId, data.clientId)));
        if (!existing) throw new Error("idempotent insert conflicted but no row found");
        return { entry: toEntry(existing), created: false };
      },
      async get(userId, id) {
        const [row] = await db
          .select()
          .from(entries)
          .where(and(eq(entries.userId, userId), eq(entries.id, id), isNull(entries.deletedAt)));
        return row ? toEntry(row) : null;
      },
      async list(userId, q) {
        const where: SQL[] = [eq(entries.userId, userId), isNull(entries.deletedAt)];
        if (q.changeTargetId) where.push(eq(entries.changeTargetId, q.changeTargetId));
        if (q.toolId) where.push(eq(entries.toolId, q.toolId));
        if (q.since) where.push(gte(entries.occurredAt, new Date(q.since)));
        if (q.until) where.push(lte(entries.occurredAt, new Date(q.until)));
        if (q.tag) where.push(sql`${entries.payload} -> 'tags' @> ${JSON.stringify([q.tag])}::jsonb`);
        if (q.after) {
          where.push(
            sql`(${entries.occurredAt}, ${entries.id}) < (${q.after.occurredAt}::timestamptz, ${q.after.id}::uuid)`,
          );
        }
        const rows = await db
          .select()
          .from(entries)
          .where(and(...where))
          .orderBy(desc(entries.occurredAt), desc(entries.id))
          .limit(q.limit);
        return rows.map(toEntry);
      },
      async update(userId, id, patch) {
        const set = {
          ...(patch.payload === undefined ? {} : { payload: patch.payload }),
          ...(patch.occurredAt === undefined ? {} : { occurredAt: new Date(patch.occurredAt) }),
          updatedAt: new Date(),
        };
        const [row] = await db
          .update(entries)
          .set(set)
          .where(and(eq(entries.userId, userId), eq(entries.id, id), isNull(entries.deletedAt)))
          .returning();
        return row ? toEntry(row) : null;
      },
      async softDelete(userId, id, at) {
        const rows = await db
          .update(entries)
          .set({ deletedAt: new Date(at), updatedAt: new Date() })
          .where(and(eq(entries.userId, userId), eq(entries.id, id), isNull(entries.deletedAt)))
          .returning({ id: entries.id });
        return rows.length > 0;
      },
      async listForTools(userId, toolIds) {
        if (toolIds.length === 0) return [];
        const rows = await db
          .select()
          .from(entries)
          .where(and(eq(entries.userId, userId), inArray(entries.toolId, toolIds), isNull(entries.deletedAt)))
          .orderBy(desc(entries.occurredAt), desc(entries.id));
        return rows.map(toEntry);
      },
    },
    reminders: createReminderRepository(db),
    devices: createDeviceRepository(db),
    tokens: createTokenRepository(db),
    loginAttempts: createLoginAttemptRepository(db),
    pushTickets: createPushTicketRepository(db),
  };
}
