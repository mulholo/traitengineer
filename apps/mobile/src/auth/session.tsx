import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { Schemas } from "@te/client";
import { createContext, useCallback, useContext, useMemo, type ReactNode } from "react";
import { api, ApiError, authFetch, unwrap } from "../api/client";
import { keys } from "../api/keys";
import { kvStorage } from "../platform/storage";
import { setSessionToken } from "../platform/token";

type Me = Schemas["Me"];

interface AuthState {
  status: "loading" | "signedOut" | "signedIn";
  me: Me | undefined;
  signIn(email: string, password: string): Promise<void>;
  /** Called after a passkey sign-in (web), which sets the cookie itself. */
  refresh(): Promise<void>;
  signOut(): Promise<void>;
}

const AuthContext = createContext<AuthState | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const meQuery = useQuery({
    queryKey: keys.me,
    queryFn: async () => {
      try {
        return await unwrap(api.GET("/v1/me"));
      } catch (e) {
        if (e instanceof ApiError && e.status === 401) return null;
        throw e;
      }
    },
    staleTime: 60_000,
  });

  const refresh = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: keys.me });
    await queryClient.refetchQueries({ queryKey: keys.me });
  }, [queryClient]);

  const signIn = useCallback(
    async (email: string, password: string) => {
      const res = await authFetch<{ token?: string }>("/sign-in/email", { body: { email, password } });
      await setSessionToken(res.token ?? null);
      await refresh();
    },
    [refresh],
  );

  const signOut = useCallback(async () => {
    try {
      await authFetch("/sign-out", { body: {} });
    } catch {
      // already signed out server-side
    }
    await setSessionToken(null);
    queryClient.clear();
    kvStorage.removeItem("te.query-cache");
    queryClient.setQueryData(keys.me, null);
  }, [queryClient]);

  const value = useMemo<AuthState>(() => {
    const me = meQuery.data ?? undefined;
    const status =
      meQuery.isPending && meQuery.data === undefined ? "loading" : me ? "signedIn" : "signedOut";
    return { status, me, signIn, refresh, signOut };
  }, [meQuery.data, meQuery.isPending, signIn, refresh, signOut]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
