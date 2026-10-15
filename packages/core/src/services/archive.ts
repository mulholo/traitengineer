import type { ArchiveFile, ArchiveStore } from "../archive.ts";
import type { ServiceDeps } from "./context.ts";
import { createExportService, renderExportMarkdown } from "./export.ts";

export type ArchiveService = ReturnType<typeof createArchiveService>;

/**
 * `archive.nightly`: write every user's export as Markdown (for humans) and JSON (for `db:restore`) to the
 * archive store in a single commit. Exports never contain credentials or email addresses.
 */
export function createArchiveService(deps: ServiceDeps, store: ArchiveStore | undefined) {
  const exports = createExportService(deps);
  return {
    configured: store !== undefined,
    async archiveAll(): Promise<{ users: number; snapshot: string | null }> {
      if (!store) return { users: 0, snapshot: null };
      const files: ArchiveFile[] = [];
      const ids = await deps.repos.users.listIds();
      for (const userId of ids) {
        const data = await exports.exportAll(userId);
        files.push({ path: `users/${userId}/traitengineer.md`, content: renderExportMarkdown(data) });
        files.push({
          path: `users/${userId}/traitengineer.json`,
          content: `${JSON.stringify(data, null, 2)}\n`,
        });
      }
      const day = deps.now().toISOString().slice(0, 10);
      files.push({
        path: "README.md",
        content:
          "# Trait Engineer archive\n\nNightly snapshot of everything recorded in Trait Engineer. Git history keeps every " +
          "previous night.\n\n- `users/<id>/traitengineer.md`: readable export\n- `users/<id>/traitengineer.json`: " +
          "complete export; restore with `pnpm db:restore <file>` (see docs/deploy.md)\n\n" +
          `Last snapshot: ${day} (${ids.length} user${ids.length === 1 ? "" : "s"}).\n`,
      });
      const { id } = await store.writeSnapshot(files, `Nightly archive ${day}`);
      return { users: ids.length, snapshot: id };
    },
  };
}
