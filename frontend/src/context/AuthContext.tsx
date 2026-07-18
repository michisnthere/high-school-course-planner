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

const AUTH_MODE_KEY = "authMode";

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
    // Never ask the backend about a guest session
    if (modeRef.current === "guest") return;
    if (fetchingRef.current) return;
    fetchingRef.current = true;
    try {
      const session = await getSession();
      if (session.authenticated) {
        setMode("authenticated");
        setUser(session.user ?? null);
        sessionStorage.removeItem(AUTH_MODE_KEY);
      }
    } catch {
      // Network error — preserve current mode
    } finally {
      fetchingRef.current = false;
    }
  }, []);

  useEffect(() => {
    const init = async () => {
      console.log("[Auth:init] START getSession()");
      // 1. Try to detect an existing authenticated session
      fetchingRef.current = true;
      try {
        const session = await getSession();
        console.log("[Auth:init] getSession returned:", JSON.stringify(session));
        if (session.authenticated) {
          console.log("[Auth:init] authenticated → setMode=authenticated");
          setMode("authenticated");
          setUser(session.user ?? null);
          sessionStorage.removeItem(AUTH_MODE_KEY);
          return;
        }
      } catch (e) {
        console.log("[Auth:init] getSession ERROR:", e);
      } finally {
        fetchingRef.current = false;
      }

      // 2. Not authenticated — restore stored guest mode
      const storedMode = sessionStorage.getItem(AUTH_MODE_KEY);
      console.log("[Auth:init] storedMode =", storedMode);
      if (storedMode === "guest") {
        console.log("[Auth:init] restoring guest mode");
        setMode("guest");
        setUser(GUEST_USER);
        return;
      }

      // 3. Truly unauthenticated
      console.log("[Auth:init] no session, no guest → mode=null");
      setMode(null);
      setUser(null);
    };

    init().finally(() => {
      console.log("[Auth:init] .finally() → setLoading=false");
      setLoading(false);
    });
  }, []);

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
    sessionStorage.setItem(AUTH_MODE_KEY, "guest");
    setMode("guest");
    setUser(GUEST_USER);
  }, []);

  const handleLogout = useCallback(async () => {
    sessionStorage.removeItem(AUTH_MODE_KEY);
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

  const renderCount = React.useRef(0);
  renderCount.current++;
  console.log(`[Auth:render #${renderCount.current}] mode=${mode} loading=${loading}`);

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
