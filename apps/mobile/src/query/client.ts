import { createSyncStoragePersister } from "@tanstack/query-sync-storage-persister";
import { QueryClient } from "@tanstack/react-query";
import type { Schemas } from "@te/client";
import { api, ApiError, unwrap } from "../api/client";
import { keys } from "../api/keys";
import { kvStorage } from "../platform/storage";

export type CreateEntryInput = Schemas["CreateEntry"];
export type Entry = Schemas["Entry"];

/** Mutation key for logging an entry. Its function is registered here so persisted, paused mutations can resume. */
export const CREATE_ENTRY = ["entries", "create"] as const;
/** Most recently used tool, for the "Log evidence" home-screen quick action. */
export const LAST_TOOL_KEY = "te.last-tool-id";

export function createQueryClient() {
  const client = new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        gcTime: 7 * 24 * 60 * 60 * 1000,
        retry: (count, error) => !(error instanceof ApiError && error.status < 500) && count < 2,
      },
      mutations: { networkMode: "online" },
    },
  });

  client.setMutationDefaults(CREATE_ENTRY, {
    // POST is idempotent on clientId, so replaying after a reconnect (or app restart) is safe.
    mutationFn: (input: CreateEntryInput) => unwrap(api.POST("/v1/entries", { body: input })),
    retry: 3,
    onMutate: async (input: CreateEntryInput) => {
      kvStorage.setItem(LAST_TOOL_KEY, input.toolId);
      // Optimistic entry so it shows up immediately (Today, timelines) even while offline.
      const optimistic: Entry = {
        id: input.clientId,
        clientId: input.clientId,
        toolId: input.toolId,
        changeTargetId: "",
        toolType: "evidence_log",
        payload: input.payload,
        occurredAt: input.occurredAt ?? new Date().toISOString(),
        source: input.source ?? "mobile",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      client.setQueriesData<{ items: Entry[]; nextCursor: string | null }>(
        { queryKey: keys.allEntries },
        (old) =>
          old
            ? { ...old, items: [optimistic, ...old.items.filter((e) => e.clientId !== input.clientId)] }
            : old,
      );
    },
    onSettled: () => {
      void client.invalidateQueries({ queryKey: keys.allEntries });
      void client.invalidateQueries({ queryKey: ["summary"] });
    },
  });
  return client;
}

/** Query cache + paused mutations persisted to MMKV (native) or localStorage (web). */
export const persister = createSyncStoragePersister({
  storage: kvStorage,
  key: "te.query-cache",
  throttleTime: 500,
});
