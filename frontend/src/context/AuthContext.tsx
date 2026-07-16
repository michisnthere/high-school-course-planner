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
import { getSession, logout, type AuthUser, type AuthMode, GUEST_USER } from "@/lib/auth";

type AuthContextType = {
  user: AuthUser | null;
  mode: AuthMode | null;
  loading: boolean;
  isAuthenticated: boolean;
  isGuest: boolean;
  refresh: () => Promise<void>;
  logout: () => Promise<void>;
  loginAsGuest: () => void;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [mode, setMode] = useState<AuthMode | null>(null);
  const [loading, setLoading] = useState(true);
  const fetchingRef = useRef(false);
  const modeRef = useRef<AuthMode | null>(null);

  useEffect(() => {
    modeRef.current = mode;
  }, [mode]);

  const refresh = useCallback(async () => {
    if (fetchingRef.current) return;
    fetchingRef.current = true;
    try {
      const session = await getSession();
      if (session.authenticated) {
        setMode("authenticated");
        setUser(session.user ?? null);
      }
    } catch {
      // Network error — preserve current mode
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

  const handleLoginAsGuest = useCallback(() => {
    setMode("guest");
    setUser(GUEST_USER);
  }, []);

  const handleLogout = useCallback(async () => {
    if (modeRef.current === "authenticated") {
      try {
        await logout();
      } catch {
        // Ignore logout errors.
      }
    }
    setMode(null);
    setUser(null);
    window.location.href = "/";
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        mode,
        loading,
        isAuthenticated: mode === "authenticated",
        isGuest: mode === "guest",
        refresh,
        logout: handleLogout,
        loginAsGuest: handleLoginAsGuest,
      }}
    >
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
