import { exportSchema, type Export } from "@te/contracts";
import type { Database } from "./client.ts";
import { changeTargets, entries, reminders, tools } from "./schema/index.ts";

const d = (s: string | null | undefined) => (s ? new Date(s) : null);

export interface RestoreResult {
  changeTargets: number;
  tools: number;
  entries: number;
  reminders: number;
}

/**
 * Load an export (from `GET /v1/export` or the share sheet) into the database for `userId`, preserving IDs
 * and timestamps. Idempotent: rows that already exist are left alone, so a restore can be re-run safely.
 * Entries whose tool was deleted before the export get a deleted placeholder tool so no evidence is dropped.
 */
export async function restoreExport(db: Database, userId: string, input: unknown): Promise<RestoreResult> {
  const data: Export = exportSchema.parse(input);
  const knownTools = new Set(data.tools.map((t) => t.id));
  const placeholders = new Map<string, { changeTargetId: string; type: string }>();
  for (const e of data.entries) {
    if (!knownTools.has(e.toolId) && !placeholders.has(e.toolId))
      placeholders.set(e.toolId, { changeTargetId: e.changeTargetId, type: e.toolType });
  }

  return db.transaction(async (tx) => {
    const insertedTargets = data.changeTargets.length
      ? await tx
          .insert(changeTargets)
          .values(
            data.changeTargets.map((t) => ({
              id: t.id,
              userId,
              title: t.title,
              oldPattern: t.oldPattern,
              desiredDefault: t.desiredDefault,
              why: t.why,
              status: t.status,
              sortOrder: t.sortOrder,
              archivedAt: d(t.archivedAt),
              createdAt: new Date(t.createdAt),
              updatedAt: new Date(t.updatedAt),
            })),
          )
          .onConflictDoNothing()
          .returning({ id: changeTargets.id })
      : [];

    const toolRows = [
      ...data.tools.map((t) => ({
        id: t.id,
        userId,
        changeTargetId: t.changeTargetId,
        type: t.type,
        name: t.name,
        config: t.config,
        sortOrder: t.sortOrder,
        deletedAt: null,
        createdAt: new Date(t.createdAt),
        updatedAt: new Date(t.updatedAt),
      })),
      ...[...placeholders].map(([id, p]) => ({
        id,
        userId,
        changeTargetId: p.changeTargetId,
        type: p.type,
        name: "Deleted tool",
        config: {},
        sortOrder: 0,
        deletedAt: new Date(data.exportedAt),
        createdAt: new Date(data.exportedAt),
        updatedAt: new Date(data.exportedAt),
      })),
    ];
    const insertedTools = toolRows.length
      ? await tx.insert(tools).values(toolRows).onConflictDoNothing().returning({ id: tools.id })
      : [];

    const insertedEntries = data.entries.length
      ? await tx
          .insert(entries)
          .values(
            data.entries.map((e) => ({
              id: e.id,
              userId,
              toolId: e.toolId,
              changeTargetId: e.changeTargetId,
              toolType: e.toolType,
              payload: e.payload,
              occurredAt: new Date(e.occurredAt),
              source: e.source,
              clientId: e.clientId,
              createdAt: new Date(e.createdAt),
              updatedAt: new Date(e.updatedAt),
            })),
          )
          .onConflictDoNothing()
          .returning({ id: entries.id })
      : [];

    const insertedReminders = data.reminders.length
      ? await tx
          .insert(reminders)
          .values(
            data.reminders.map((r) => ({
              id: r.id,
              userId,
              toolId: r.toolId,
              changeTargetId: r.changeTargetId,
              rrule: r.rrule,
              timezone: r.timezone,
              title: r.title,
              body: r.body,
              enabled: r.enabled,
              nextFireAt: d(r.nextFireAt),
              lastFiredAt: d(r.lastFiredAt),
              createdAt: new Date(r.createdAt),
              updatedAt: new Date(r.updatedAt),
            })),
          )
          .onConflictDoNothing()
          .returning({ id: reminders.id })
      : [];

    return {
      changeTargets: insertedTargets.length,
      tools: insertedTools.length,
      entries: insertedEntries.length,
      reminders: insertedReminders.length,
    };
  });
}
