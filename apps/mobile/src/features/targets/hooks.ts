import { useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import type { Schemas } from "@te/client";
import { api, unwrap } from "../../api/client";
import { keys } from "../../api/keys";

export type ChangeTarget = Schemas["ChangeTarget"];
export type Tool = Schemas["Tool"];
export type Status = ChangeTarget["status"];

export function useTargets(status?: Status) {
  return useQuery({
    queryKey: keys.targets(status),
    queryFn: () =>
      unwrap(
        api.GET("/v1/change-targets", { params: { query: { limit: 200, ...(status ? { status } : {}) } } }),
      ),
  });
}

export function useTarget(id: string) {
  const qc = useQueryClient();
  return useQuery({
    queryKey: keys.target(id),
    queryFn: () => unwrap(api.GET("/v1/change-targets/{id}", { params: { path: { id } } })),
    enabled: !!id,
    initialData: () => fromCachedLists<ChangeTarget>(qc, "targets", id),
    initialDataUpdatedAt: 0,
  });
}

export function useTargetSummary(id: string) {
  return useQuery({
    queryKey: keys.summary(id),
    queryFn: () =>
      unwrap(api.GET("/v1/change-targets/{id}/summary", { params: { path: { id }, query: { weeks: 12 } } })),
  });
}

export function useTools(changeTargetId?: string) {
  return useQuery({
    queryKey: keys.tools(changeTargetId),
    queryFn: () =>
      unwrap(
        api.GET("/v1/tools", {
          params: { query: { limit: 200, ...(changeTargetId ? { changeTargetId } : {}) } },
        }),
      ),
  });
}

/** Find an item in any cached list page, so detail screens render offline from list data. */
function fromCachedLists<T extends { id: string }>(
  qc: QueryClient,
  prefix: string,
  id: string,
): T | undefined {
  for (const [, data] of qc.getQueriesData<{ items: T[] }>({ queryKey: [prefix] })) {
    const hit = data?.items?.find((x) => x.id === id);
    if (hit) return hit;
  }
  return undefined;
}

export function useTool(id: string) {
  const qc = useQueryClient();
  return useQuery({
    queryKey: keys.tool(id),
    queryFn: () => unwrap(api.GET("/v1/tools/{id}", { params: { path: { id } } })),
    enabled: !!id,
    initialData: () => fromCachedLists<Tool>(qc, "tools", id),
    initialDataUpdatedAt: 0,
  });
}

/** Create a target and attach an evidence log, so it can be logged against straight away. */
export function useCreateTarget() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: Schemas["CreateChangeTarget"]) => {
      const target = await unwrap(api.POST("/v1/change-targets", { body }));
      await unwrap(api.POST("/v1/tools", { body: { changeTargetId: target.id, type: "evidence_log" } }));
      return target;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: keys.allTargets });
      void qc.invalidateQueries({ queryKey: ["tools"] });
    },
  });
}

export function useUpdateTarget(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Schemas["UpdateChangeTarget"]) =>
      unwrap(api.PATCH("/v1/change-targets/{id}", { params: { path: { id } }, body })),
    onSuccess: (target) => {
      qc.setQueryData(keys.target(id), target);
      void qc.invalidateQueries({ queryKey: keys.allTargets });
    },
  });
}

export function useArchiveTarget(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => unwrap(api.DELETE("/v1/change-targets/{id}", { params: { path: { id } } })),
    onSuccess: (target) => {
      qc.setQueryData(keys.target(id), target);
      void qc.invalidateQueries({ queryKey: keys.allTargets });
    },
  });
}
