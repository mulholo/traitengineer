import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Schemas } from "@te/client";
import { api, unwrap } from "../../api/client";
import { keys } from "../../api/keys";
import { CREATE_ENTRY, type CreateEntryInput } from "../../query/client";

export type Entry = Schemas["Entry"];
export type EntryFilter = {
  changeTargetId?: string;
  toolId?: string;
  since?: string;
  until?: string;
  tag?: string;
};

export function useEntries(filter: EntryFilter = {}, limit = 50) {
  return useQuery({
    queryKey: keys.entries({ ...filter, limit: String(limit) }),
    queryFn: () => unwrap(api.GET("/v1/entries", { params: { query: { ...filter, limit } } })),
  });
}

export function useEntry(id: string) {
  return useQuery({
    queryKey: keys.entry(id),
    queryFn: () => unwrap(api.GET("/v1/entries/{id}", { params: { path: { id } } })),
  });
}

export { LAST_TOOL_KEY } from "../../query/client";

/**
 * Log an entry. Uses the persisted CREATE_ENTRY mutation (defaults in query/client.ts: optimistic insert,
 * idempotent replay), so it survives going offline or closing the app. Don't pass callbacks here: they would
 * replace the defaults rather than add to them.
 */
export function useLogEntry() {
  return useMutation<Entry, Error, CreateEntryInput>({ mutationKey: CREATE_ENTRY });
}

export function useUpdateEntry(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Schemas["UpdateEntry"]) =>
      unwrap(api.PATCH("/v1/entries/{id}", { params: { path: { id } }, body })),
    onSuccess: (entry) => {
      qc.setQueryData(keys.entry(id), entry);
      void qc.invalidateQueries({ queryKey: keys.allEntries });
      void qc.invalidateQueries({ queryKey: ["summary"] });
    },
  });
}

export function useDeleteEntry(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => unwrap(api.DELETE("/v1/entries/{id}", { params: { path: { id } } })),
    onSuccess: () => {
      qc.removeQueries({ queryKey: keys.entry(id) });
      void qc.invalidateQueries({ queryKey: keys.allEntries });
      void qc.invalidateQueries({ queryKey: ["summary"] });
    },
  });
}

/** ISO timestamp of local midnight today (for "today's entries"). */
export function startOfToday(now = new Date()): string {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}
