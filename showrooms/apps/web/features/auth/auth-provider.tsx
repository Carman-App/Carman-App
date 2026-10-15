"use client";

import type { AuthSession, PublicUser } from "@showrooms/shared";
import { useQueryClient } from "@tanstack/react-query";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { logout as apiLogout, onSessionChange, refreshSession, setSession } from "@/lib/api-client";

type Status = "loading" | "authenticated" | "anonymous";

interface AuthContextValue {
  status: Status;
  user: PublicUser | null;
  signIn: (session: AuthSession) => void;
  signOut: () => Promise<void>;
  updateUser: (user: PublicUser) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<Status>("loading");
  const [user, setUser] = useState<PublicUser | null>(null);

  useEffect(() => {
    const off = onSessionChange((session) => {
      setUser(session?.user ?? null);
      setStatus(session ? "authenticated" : "anonymous");
    });
    // Restore the session from the HttpOnly refresh cookie.
    refreshSession().then((s) => {
      if (!s) setStatus("anonymous");
    });
    return () => {
      off();
    };
  }, []);

  const signIn = useCallback(
    (session: AuthSession) => {
      // A different account must never see the previous account's cached data.
      queryClient.clear();
      setSession(session);
    },
    [queryClient],
  );

  const signOut = useCallback(async () => {
    await apiLogout();
    queryClient.clear();
  }, [queryClient]);

  const value = useMemo(() => ({ status, user, signIn, signOut, updateUser: setUser }), [status, user, signIn, signOut]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}

export const isSeller = (user: PublicUser | null) => user?.role === "BROKER" || user?.role === "DEALER";
