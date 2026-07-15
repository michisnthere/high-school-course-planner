"use client";

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useRef,
  useCallback,
  ReactNode,
} from "react";
import { getSession, logout, type AuthUser } from "@/lib/auth";

type AuthContextType = {
  user: AuthUser | null;
  loading: boolean;
  refresh: () => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const fetchingRef = useRef(false);

  const refresh = useCallback(async () => {
    if (fetchingRef.current) return;
    fetchingRef.current = true;
    try {
      const session = await getSession();
      console.log(`[AUTH-DEBUG] AuthContext refresh: authenticated=${session.authenticated}, user=${session.authenticated ? session.user?.email : "null"}`);
      setUser(session.authenticated ? session.user ?? null : null);
    } catch (err) {
      console.error(`[AUTH-DEBUG] AuthContext refresh FAILED:`, err);
      setUser(null);
    } finally {
      fetchingRef.current = false;
    }
  }, []);

  useEffect(() => {
    refresh().finally(() => setLoading(false));
  }, [refresh]);

  useEffect(() => {
    const onPageShow = (event: PageTransitionEvent) => {
      if (event.persisted) {
        refresh();
      }
    };
    const onFocus = () => {
      refresh();
    };
    window.addEventListener("pageshow", onPageShow);
    window.addEventListener("focus", onFocus);
    return () => {
      window.removeEventListener("pageshow", onPageShow);
      window.removeEventListener("focus", onFocus);
    };
  }, [refresh]);

  const handleLogout = useCallback(async () => {
    try {
      await logout();
    } catch {
      // Ignore logout errors; session is cleared on the backend if it exists.
    }
    setUser(null);
    window.location.href = "/";
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, refresh, logout: handleLogout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
