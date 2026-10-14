import {
  createChangeTargetSchema,
  listChangeTargetsQuerySchema,
  updateChangeTargetSchema,
  type ChangeTarget,
  type CreateChangeTarget,
  type ListChangeTargetsQuery,
  type Page,
  type UpdateChangeTarget,
} from "@te/contracts";
import { decodeCursor, isSortKey, paginate } from "../cursor.ts";
import { NotFoundError } from "../errors.ts";
import type { ChangeTargetPatch } from "../repositories.ts";
import { compact, parseOrThrow } from "../validate.ts";
import type { ServiceDeps } from "./context.ts";

export type ChangeTargetService = ReturnType<typeof createChangeTargetService>;

export function createChangeTargetService({ repos, now }: ServiceDeps) {
  async function getOrThrow(userId: string, id: string): Promise<ChangeTarget> {
    const target = await repos.changeTargets.get(userId, id);
    if (!target) throw new NotFoundError("Change target", id);
    return target;
  }

  return {
    async create(userId: string, input: CreateChangeTarget): Promise<ChangeTarget> {
      const data = parseOrThrow(createChangeTargetSchema, input, "change target");
      const sortOrder = data.sortOrder ?? ((await repos.changeTargets.maxSortOrder(userId)) ?? -1) + 1;
      return repos.changeTargets.create(userId, { ...data, sortOrder });
    },

    async list(userId: string, query: ListChangeTargetsQuery = {}): Promise<Page<ChangeTarget>> {
      const q = parseOrThrow(listChangeTargetsQuerySchema, query, "query");
      const after = decodeCursor(q.cursor, isSortKey);
      const rows = await repos.changeTargets.list(userId, {
        ...(q.status ? { status: q.status } : {}),
        limit: q.limit + 1,
        ...(after ? { after } : {}),
      });
      return paginate(rows, q.limit, (t) => ({ sortOrder: t.sortOrder, id: t.id }));
    },

    get: getOrThrow,

    async update(userId: string, id: string, input: UpdateChangeTarget): Promise<ChangeTarget> {
      const patch: ChangeTargetPatch = compact(
        parseOrThrow(updateChangeTargetSchema, input, "change target"),
      );
      const current = await getOrThrow(userId, id);
      if (patch.status !== undefined && patch.status !== current.status) {
        patch.archivedAt = patch.status === "archived" ? now().toISOString() : null;
      }
      const updated = await repos.changeTargets.update(userId, id, patch);
      if (!updated) throw new NotFoundError("Change target", id);
      return updated;
    },

    /** DELETE semantics: archive (never hard-delete). Idempotent. */
    async archive(userId: string, id: string): Promise<ChangeTarget> {
      const current = await getOrThrow(userId, id);
      if (current.status === "archived") return current;
      const updated = await repos.changeTargets.update(userId, id, {
        status: "archived",
        archivedAt: now().toISOString(),
      });
      if (!updated) throw new NotFoundError("Change target", id);
      return updated;
    },
  };
}
