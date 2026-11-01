// Sessão do Supabase Auth, nível de autenticação (aal1/aal2) e contexto da organização atual.
import type { Session } from "@supabase/supabase-js";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { SessionContext } from "./access";
import { useOrg } from "./OrgProvider";
import { supabase } from "./supabase";

interface AuthState {
  ready: boolean;
  session: Session | null;
  aal: "aal1" | "aal2" | null;
  context: SessionContext | null;
  contextLoading: boolean;
  contextError: unknown;
  /** Volta a ler o nível de autenticação e o contexto (depois do MFA ou do consentimento). */
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function useAuth(): AuthState {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth fora de AuthProvider");
  return value;
}

/** Lê o nível "aal" do token atual (aal2 = passou o MFA). */
export function aalFromToken(accessToken: string | undefined): "aal1" | "aal2" | null {
  if (!accessToken) return null;
  try {
    const payload = JSON.parse(atob(accessToken.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")));
    return payload.aal === "aal2" ? "aal2" : "aal1";
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const org = useOrg();
  const queryClient = useQueryClient();
  const [ready, setReady] = useState(false);
  const [session, setSession] = useState<Session | null>(null);

  useEffect(() => {
    let active = true;
    void supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setSession(data.session);
      setReady(true);
    });
    // Não chamar outras funções do Supabase dentro deste callback (recomendação do supabase-js).
    const { data } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
      setReady(true);
    });
    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, []);

  const userId = session?.user.id ?? null;
  const aal = aalFromToken(session?.access_token);

  const contextQuery = useQuery({
    queryKey: ["session-context", org.id, userId, aal],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_session_context", { p_org: org.id });
      if (error) throw error;
      return data as SessionContext;
    },
    staleTime: 60_000,
  });

  const refresh = useCallback(async () => {
    const { data } = await supabase.auth.refreshSession();
    setSession(data.session);
    await queryClient.invalidateQueries({ queryKey: ["session-context"] });
  }, [queryClient]);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    queryClient.clear();
  }, [queryClient]);

  const value = useMemo<AuthState>(
    () => ({
      ready,
      session,
      aal,
      context: userId ? (contextQuery.data ?? null) : null,
      contextLoading: !!userId && contextQuery.isPending,
      contextError: contextQuery.error,
      refresh,
      signOut,
    }),
    [ready, session, aal, userId, contextQuery.data, contextQuery.isPending, contextQuery.error, refresh, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
