import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Schemas } from "@te/client";
import { api, authFetch, unwrap } from "../../api/client";
import { keys } from "../../api/keys";

export function useUpdateMe() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Schemas["UpdateMe"]) => unwrap(api.PATCH("/v1/me", { body })),
    onSuccess: (me) => qc.setQueryData(keys.me, me),
  });
}

export function useChangePassword() {
  return useMutation({
    mutationFn: (body: { currentPassword: string; newPassword: string }) =>
      authFetch("/change-password", { body: { ...body, revokeOtherSessions: true } }),
  });
}

export interface SessionInfo {
  id: string;
  token: string;
  createdAt: string;
  expiresAt: string;
  userAgent?: string | null;
  ipAddress?: string | null;
}

export function useSessions() {
  return useQuery({ queryKey: keys.sessions, queryFn: () => authFetch<SessionInfo[]>("/list-sessions") });
}

export function useRevokeSession() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (token: string) => authFetch("/revoke-session", { body: { token } }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: keys.sessions }),
  });
}

export function useDevices() {
  return useQuery({ queryKey: keys.devices, queryFn: () => unwrap(api.GET("/v1/devices")) });
}

export function useRemoveDevice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => unwrap(api.DELETE("/v1/devices/{id}", { params: { path: { id } } })),
    onSuccess: () => void qc.invalidateQueries({ queryKey: keys.devices }),
  });
}

export function useTokens() {
  return useQuery({ queryKey: keys.tokens, queryFn: () => unwrap(api.GET("/v1/tokens")) });
}

export function useCreateToken() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Schemas["CreatePersonalAccessToken"]) => unwrap(api.POST("/v1/tokens", { body })),
    onSuccess: () => void qc.invalidateQueries({ queryKey: keys.tokens }),
  });
}

export function useRevokeToken() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => unwrap(api.DELETE("/v1/tokens/{id}", { params: { path: { id } } })),
    onSuccess: () => void qc.invalidateQueries({ queryKey: keys.tokens }),
  });
}

export interface PasskeyInfo {
  id: string;
  name?: string | null;
  createdAt: string;
  deviceType: string;
}

export function usePasskeys(enabled: boolean) {
  return useQuery({
    queryKey: keys.passkeys,
    queryFn: () => authFetch<PasskeyInfo[]>("/passkey/list-user-passkeys"),
    enabled,
  });
}

export function useDeletePasskey() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => authFetch("/passkey/delete-passkey", { body: { id } }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: keys.passkeys }),
  });
}

export async function fetchExport(format: "json" | "markdown"): Promise<string> {
  const res = await api.GET("/v1/export", { params: { query: { format } }, parseAs: "text" });
  if (!res.response.ok || typeof res.data !== "string") throw new Error("Export failed");
  return res.data;
}
