import {
  createEntrySchema,
  getToolType,
  listEntriesQuerySchema,
  updateEntrySchema,
  type CreateEntry,
  type Entry,
  type ListEntriesQuery,
  type Page,
  type UpdateEntry,
} from "@te/contracts";
import { decodeCursor, isTimeKey, paginate } from "../cursor.ts";
import { NotFoundError } from "../errors.ts";
import type { EntryFilter } from "../repositories.ts";
import { parseOrThrow } from "../validate.ts";
import type { ServiceDeps } from "./context.ts";

export type EntryService = ReturnType<typeof createEntryService>;

function toIso(ts: string): string {
  return new Date(ts).toISOString();
}

export function createEntryService({ repos, now }: ServiceDeps) {
  async function getOrThrow(userId: string, id: string): Promise<Entry> {
    const entry = await repos.entries.get(userId, id);
    if (!entry) throw new NotFoundError("Entry", id);
    return entry;
  }

  return {
    /**
     * Log an entry. Idempotent on `clientId`: a repeat returns the existing entry with `created: false`
     * (and does not re-validate or change it).
     */
    async create(userId: string, input: CreateEntry): Promise<{ entry: Entry; created: boolean }> {
      const data = parseOrThrow(createEntrySchema, input, "entry");
      const tool = await repos.tools.get(userId, data.toolId);
      if (!tool) throw new NotFoundError("Tool", data.toolId);
      const def = getToolType(tool.type);
      const payload = parseOrThrow(def.payloadSchema, data.payload, `${tool.type} payload`, "payload");
      return repos.entries.createIdempotent(userId, {
        toolId: tool.id,
        changeTargetId: tool.changeTargetId,
        toolType: tool.type,
        payload,
        occurredAt: data.occurredAt ? toIso(data.occurredAt) : now().toISOString(),
        source: data.source,
        clientId: data.clientId,
      });
    },

    async list(userId: string, query: ListEntriesQuery = {}): Promise<Page<Entry>> {
      const q = parseOrThrow(listEntriesQuerySchema, query, "query");
      const after = decodeCursor(q.cursor, isTimeKey);
      const filter: EntryFilter = {};
      if (q.changeTargetId) filter.changeTargetId = q.changeTargetId;
      if (q.toolId) filter.toolId = q.toolId;
      if (q.since) filter.since = toIso(q.since);
      if (q.until) filter.until = toIso(q.until);
      if (q.tag) filter.tag = q.tag;
      const rows = await repos.entries.list(userId, {
        ...filter,
        limit: q.limit + 1,
        ...(after ? { after } : {}),
      });
      return paginate(rows, q.limit, (e) => ({ occurredAt: e.occurredAt, id: e.id }));
    },

    get: getOrThrow,

    async update(userId: string, id: string, input: UpdateEntry): Promise<Entry> {
      const patch = parseOrThrow(updateEntrySchema, input, "entry");
      const current = await getOrThrow(userId, id);
      const next: Partial<Pick<Entry, "payload" | "occurredAt">> = {};
      if (patch.payload !== undefined) {
        const def = getToolType(current.toolType);
        next.payload = parseOrThrow(
          def.payloadSchema,
          { ...current.payload, ...patch.payload },
          `${current.toolType} payload`,
          "payload",
        );
      }
      if (patch.occurredAt !== undefined) next.occurredAt = toIso(patch.occurredAt);
      const updated = await repos.entries.update(userId, id, next);
      if (!updated) throw new NotFoundError("Entry", id);
      return updated;
    },

    async remove(userId: string, id: string): Promise<void> {
      const ok = await repos.entries.softDelete(userId, id, now().toISOString());
      if (!ok) throw new NotFoundError("Entry", id);
    },
  };
}
