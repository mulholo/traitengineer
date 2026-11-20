import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Schemas } from "@te/client";
import { api, authFetch, unwrap } from "../../api/client";
import { keys } from "../../api/keys";
import { signInWithPasskey } from "../../auth/passkey";
import { useAuth } from "../../auth/session";

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

/**
 * Step-up for actions Better Auth only allows on a fresh session (signed in within a day): sign in again with
 * the password or a passkey, which issues a fresh session, then revoke the stale one it replaces so it does
 * not linger in Active sessions.
 */
export function useReauthenticate() {
  const qc = useQueryClient();
  const { me, signIn, refresh } = useAuth();
  return useMutation({
    mutationFn: async (credential: { password: string } | { passkey: true }) => {
      const current = await authFetch<{ session: { token: string } } | null>("/get-session");
      if ("password" in credential) {
        if (!me) throw new Error("Not signed in");
        await signIn(me.email, credential.password);
      } else {
        await signInWithPasskey();
        await refresh();
      }
      const stale = current?.session.token;
      if (stale) await authFetch("/revoke-session", { body: { token: stale } }).catch(() => undefined);
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: keys.sessions }),
  });
}
