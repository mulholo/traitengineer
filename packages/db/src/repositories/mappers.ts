import type { ChangeTarget, Entry, Tool } from "@te/contracts";
import type { User } from "@te/core";
import type { changeTargets, entries, tools, users } from "../schema/index.ts";

const iso = (d: Date) => d.toISOString();
const isoOrNull = (d: Date | null) => (d === null ? null : d.toISOString());

export function toUser(r: typeof users.$inferSelect): User {
  return {
    id: r.id,
    email: r.email,
    displayName: r.displayName,
    timezone: r.timezone,
    createdAt: iso(r.createdAt),
    updatedAt: iso(r.updatedAt),
  };
}

export function toChangeTarget(r: typeof changeTargets.$inferSelect): ChangeTarget {
  return {
    id: r.id,
    title: r.title,
    oldPattern: r.oldPattern,
    desiredDefault: r.desiredDefault,
    why: r.why,
    status: r.status,
    sortOrder: r.sortOrder,
    archivedAt: isoOrNull(r.archivedAt),
    createdAt: iso(r.createdAt),
    updatedAt: iso(r.updatedAt),
  };
}

export function toTool(r: typeof tools.$inferSelect): Tool {
  return {
    id: r.id,
    changeTargetId: r.changeTargetId,
    type: r.type as Tool["type"],
    name: r.name,
    config: r.config,
    sortOrder: r.sortOrder,
    createdAt: iso(r.createdAt),
    updatedAt: iso(r.updatedAt),
  };
}

export function toEntry(r: typeof entries.$inferSelect): Entry {
  return {
    id: r.id,
    toolId: r.toolId,
    changeTargetId: r.changeTargetId,
    toolType: r.toolType as Entry["toolType"],
    payload: r.payload,
    occurredAt: iso(r.occurredAt),
    source: r.source,
    clientId: r.clientId,
    createdAt: iso(r.createdAt),
    updatedAt: iso(r.updatedAt),
  };
}
