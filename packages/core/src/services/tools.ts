import {
  createToolSchema,
  getToolType,
  listToolsQuerySchema,
  updateToolSchema,
  type CreateTool,
  type ListToolsQuery,
  type Page,
  type Tool,
  type UpdateTool,
} from "@te/contracts";
import { decodeCursor, isSortKey, paginate } from "../cursor.ts";
import { NotFoundError } from "../errors.ts";
import { compact, parseOrThrow } from "../validate.ts";
import type { ServiceDeps } from "./context.ts";

export type ToolService = ReturnType<typeof createToolService>;

export function createToolService({ repos, now }: ServiceDeps) {
  async function getOrThrow(userId: string, id: string): Promise<Tool> {
    const tool = await repos.tools.get(userId, id);
    if (!tool) throw new NotFoundError("Tool", id);
    return tool;
  }

  return {
    async create(userId: string, input: CreateTool): Promise<Tool> {
      const data = parseOrThrow(createToolSchema, input, "tool");
      const target = await repos.changeTargets.get(userId, data.changeTargetId);
      if (!target) throw new NotFoundError("Change target", data.changeTargetId);
      const def = getToolType(data.type);
      const config = parseOrThrow(def.configSchema, data.config ?? {}, `${data.type} config`, "config");
      const sortOrder =
        data.sortOrder ?? ((await repos.tools.maxSortOrder(userId, data.changeTargetId)) ?? -1) + 1;
      return repos.tools.create(userId, {
        changeTargetId: data.changeTargetId,
        type: data.type,
        name: data.name ?? def.displayName,
        config,
        sortOrder,
      });
    },

    async list(userId: string, query: ListToolsQuery = {}): Promise<Page<Tool>> {
      const q = parseOrThrow(listToolsQuerySchema, query, "query");
      const after = decodeCursor(q.cursor, isSortKey);
      const rows = await repos.tools.list(userId, {
        ...(q.changeTargetId ? { changeTargetId: q.changeTargetId } : {}),
        limit: q.limit + 1,
        ...(after ? { after } : {}),
      });
      return paginate(rows, q.limit, (t) => ({ sortOrder: t.sortOrder, id: t.id }));
    },

    /** All live tools of a change target (no pagination; a target has a handful of tools). */
    async listForTarget(userId: string, changeTargetId: string): Promise<Tool[]> {
      return repos.tools.list(userId, { changeTargetId, limit: 1000 });
    },

    get: getOrThrow,

    async update(userId: string, id: string, input: UpdateTool): Promise<Tool> {
      const patch = compact(parseOrThrow(updateToolSchema, input, "tool"));
      const current = await getOrThrow(userId, id);
      const next = { ...patch };
      if (patch.config !== undefined) {
        const def = getToolType(current.type);
        next.config = parseOrThrow(
          def.configSchema,
          { ...current.config, ...patch.config },
          `${current.type} config`,
          "config",
        );
      }
      const updated = await repos.tools.update(userId, id, next);
      if (!updated) throw new NotFoundError("Tool", id);
      return updated;
    },

    async remove(userId: string, id: string): Promise<void> {
      const ok = await repos.tools.softDelete(userId, id, now().toISOString());
      if (!ok) throw new NotFoundError("Tool", id);
    },
  };
}
