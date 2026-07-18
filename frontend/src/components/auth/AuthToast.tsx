"use client";

import React, { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";

const TOAST_DURATION = 2800;

type ToastData = {
  message: string;
  type: "success" | "info";
};

export function AuthToast(): React.ReactElement | null {
  const { user, mode } = useAuth();
  const [toast, setToast] = useState<ToastData | null>(null);

  useEffect(() => {
    if (mode === null) return;
    try {
      const stored = sessionStorage.getItem("authToast");
      if (!stored) return;
      const data = JSON.parse(stored);
      sessionStorage.removeItem("authToast");
      if (data.type === "signIn" && mode === "authenticated" && user) {
        setToast({ message: `Signed in as ${user.name || user.email}`, type: "success" });
      } else if (data.type === "guest" && mode === "guest") {
        setToast({ message: "Continuing in Guest Mode. Your progress will only be saved until you leave or refresh this page.", type: "info" });
      }
    } catch {
      // Ignore parse errors
    }
  }, [mode, user]);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), TOAST_DURATION);
    return () => clearTimeout(timer);
  }, [toast]);

  if (!toast) return null;

  return (
    <div
      style={{
        position: "fixed",
        bottom: "24px",
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 9999,
        padding: "12px 20px",
        borderRadius: "10px",
        backgroundColor: toast.type === "success" ? "#16a34a" : "#2563eb",
        color: "#fff",
        fontSize: "15px",
        fontWeight: 500,
        boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
        display: "flex",
        alignItems: "center",
        gap: "8px",
        maxWidth: "90vw",
        lineHeight: 1.4,
      }}
    >
      {toast.message}
    </div>
  );
}
