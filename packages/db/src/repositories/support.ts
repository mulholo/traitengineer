import type {
  DeviceRepository,
  LoginAttemptRepository,
  ReminderRecord,
  ReminderRepository,
  TokenRepository,
} from "@te/core";
import { and, eq, inArray, isNull } from "drizzle-orm";
import type { Database } from "../client.ts";
import { loginAttempts, personalAccessTokens, pushDevices, reminders } from "../schema/index.ts";

const iso = (d: Date) => d.toISOString();
const isoOrNull = (d: Date | null) => (d === null ? null : d.toISOString());
const dateOrNull = (s: string | null | undefined) => (s === null || s === undefined ? null : new Date(s));

function toReminderRecord(r: typeof reminders.$inferSelect): ReminderRecord {
  return {
    id: r.id,
    toolId: r.toolId,
    changeTargetId: r.changeTargetId,
    rrule: r.rrule,
    timezone: r.timezone,
    title: r.title,
    body: r.body,
    enabled: r.enabled,
    nextFireAt: isoOrNull(r.nextFireAt),
    lastFiredAt: isoOrNull(r.lastFiredAt),
    createdAt: iso(r.createdAt),
    updatedAt: iso(r.updatedAt),
  };
}

export function createReminderRepository(db: Database): ReminderRepository {
  return {
    async create(userId, data) {
      const [row] = await db
        .insert(reminders)
        .values({ ...data, userId, nextFireAt: dateOrNull(data.nextFireAt) })
        .returning();
      if (!row) throw new Error("insert returned no row");
      return toReminderRecord(row);
    },
    async get(userId, id) {
      const [row] = await db
        .select()
        .from(reminders)
        .where(and(eq(reminders.userId, userId), eq(reminders.id, id)));
      return row ? toReminderRecord(row) : null;
    },
    async list(userId) {
      const rows = await db
        .select()
        .from(reminders)
        .where(eq(reminders.userId, userId))
        .orderBy(reminders.createdAt, reminders.id);
      return rows.map(toReminderRecord);
    },
    async update(userId, id, patch) {
      const { nextFireAt, ...rest } = patch;
      const [row] = await db
        .update(reminders)
        .set({
          ...rest,
          ...(nextFireAt === undefined ? {} : { nextFireAt: dateOrNull(nextFireAt) }),
          updatedAt: new Date(),
        })
        .where(and(eq(reminders.userId, userId), eq(reminders.id, id)))
        .returning();
      return row ? toReminderRecord(row) : null;
    },
    async delete(userId, id) {
      const rows = await db
        .delete(reminders)
        .where(and(eq(reminders.userId, userId), eq(reminders.id, id)))
        .returning({ id: reminders.id });
      return rows.length > 0;
    },
  };
}

function toDeviceRecord(r: typeof pushDevices.$inferSelect) {
  return {
    id: r.id,
    expoPushToken: r.expoPushToken,
    platform: r.platform,
    deviceName: r.deviceName,
    lastSeenAt: iso(r.lastSeenAt),
    disabledAt: isoOrNull(r.disabledAt),
    createdAt: iso(r.createdAt),
    updatedAt: iso(r.updatedAt),
  };
}

export function createDeviceRepository(db: Database): DeviceRepository {
  return {
    async upsert(userId, data, at) {
      const seen = new Date(at);
      const [row] = await db
        .insert(pushDevices)
        .values({ ...data, userId, lastSeenAt: seen })
        .onConflictDoUpdate({
          target: pushDevices.expoPushToken,
          set: {
            userId,
            platform: data.platform,
            deviceName: data.deviceName,
            lastSeenAt: seen,
            disabledAt: null,
            updatedAt: seen,
          },
        })
        .returning();
      if (!row) throw new Error("upsert returned no row");
      return toDeviceRecord(row);
    },
    async list(userId) {
      const rows = await db
        .select()
        .from(pushDevices)
        .where(eq(pushDevices.userId, userId))
        .orderBy(pushDevices.createdAt);
      return rows.map(toDeviceRecord);
    },
    async disable(userId, id, at) {
      const rows = await db
        .update(pushDevices)
        .set({ disabledAt: new Date(at), updatedAt: new Date(at) })
        .where(and(eq(pushDevices.userId, userId), eq(pushDevices.id, id), isNull(pushDevices.disabledAt)))
        .returning({ id: pushDevices.id });
      return rows.length > 0;
    },
    async disableByToken(expoPushToken, at) {
      await db
        .update(pushDevices)
        .set({ disabledAt: new Date(at), updatedAt: new Date(at) })
        .where(and(eq(pushDevices.expoPushToken, expoPushToken), isNull(pushDevices.disabledAt)));
    },
  };
}

function toTokenRecord(r: typeof personalAccessTokens.$inferSelect) {
  return {
    id: r.id,
    userId: r.userId,
    name: r.name,
    scopes: r.scopes,
    lastUsedAt: isoOrNull(r.lastUsedAt),
    revokedAt: isoOrNull(r.revokedAt),
    createdAt: iso(r.createdAt),
  };
}

export function createTokenRepository(db: Database): TokenRepository {
  return {
    async create(userId, data) {
      const [row] = await db
        .insert(personalAccessTokens)
        .values({ ...data, userId })
        .returning();
      if (!row) throw new Error("insert returned no row");
      return toTokenRecord(row);
    },
    async list(userId) {
      const rows = await db
        .select()
        .from(personalAccessTokens)
        .where(eq(personalAccessTokens.userId, userId))
        .orderBy(personalAccessTokens.createdAt);
      return rows.map(toTokenRecord);
    },
    async revoke(userId, id, at) {
      const rows = await db
        .update(personalAccessTokens)
        .set({ revokedAt: new Date(at), updatedAt: new Date(at) })
        .where(
          and(
            eq(personalAccessTokens.userId, userId),
            eq(personalAccessTokens.id, id),
            isNull(personalAccessTokens.revokedAt),
          ),
        )
        .returning({ id: personalAccessTokens.id });
      return rows.length > 0;
    },
    async findActiveByHash(tokenHash) {
      const [row] = await db
        .select()
        .from(personalAccessTokens)
        .where(and(eq(personalAccessTokens.tokenHash, tokenHash), isNull(personalAccessTokens.revokedAt)));
      return row ? toTokenRecord(row) : null;
    },
    async touch(id, at) {
      await db
        .update(personalAccessTokens)
        .set({ lastUsedAt: new Date(at) })
        .where(eq(personalAccessTokens.id, id));
    },
  };
}

export function createLoginAttemptRepository(db: Database): LoginAttemptRepository {
  return {
    async get(keys) {
      if (keys.length === 0) return [];
      const rows = await db.select().from(loginAttempts).where(inArray(loginAttempts.key, keys));
      return rows.map((r) => ({
        key: r.key,
        failures: r.failures,
        windowStartedAt: iso(r.windowStartedAt),
        lockedUntil: isoOrNull(r.lockedUntil),
      }));
    },
    async put(r) {
      const values = {
        failures: r.failures,
        windowStartedAt: new Date(r.windowStartedAt),
        lockedUntil: dateOrNull(r.lockedUntil),
        updatedAt: new Date(),
      };
      await db
        .insert(loginAttempts)
        .values({ key: r.key, ...values })
        .onConflictDoUpdate({ target: loginAttempts.key, set: values });
    },
    async clear(keys) {
      if (keys.length > 0) await db.delete(loginAttempts).where(inArray(loginAttempts.key, keys));
    },
  };
}
