import type { AuthSession, PublicUser } from "@showrooms/shared";
import { useQueryClient } from "@tanstack/react-query";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { onSessionChange, refreshSession, signOut as apiSignOut } from "@/services/api";
import { unregisterPushToken } from "@/services/push";

type Status = "loading" | "authenticated" | "anonymous";

interface AuthValue {
  status: Status;
  user: PublicUser | null;
  setUser: (u: PublicUser) => void;
  signOut: () => Promise<void>;
}

const Ctx = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const qc = useQueryClient();
  const [status, setStatus] = useState<Status>("loading");
  const [user, setUser] = useState<PublicUser | null>(null);

  useEffect(() => {
    let previous: string | null = null;
    const off = onSessionChange((s: AuthSession | null) => {
      // Never show one account's cached data to another.
      if ((s?.user.id ?? null) !== previous) qc.clear();
      previous = s?.user.id ?? null;
      setUser(s?.user ?? null);
      setStatus(s ? "authenticated" : "anonymous");
    });
    refreshSession().then((s) => !s && setStatus("anonymous"));
    return off;
  }, [qc]);

  const signOut = useCallback(async () => {
    await unregisterPushToken().catch(() => undefined);
    await apiSignOut();
  }, []);

  const value = useMemo(() => ({ status, user, setUser, signOut }), [status, user, signOut]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}

export const isSeller = (u: PublicUser | null) => u?.role === "BROKER" || u?.role === "DEALER";
