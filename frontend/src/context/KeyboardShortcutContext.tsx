"use client";

import React, { createContext, useContext, useEffect, useRef } from "react";
import { useRouter, usePathname } from "next/navigation";
import { breakpoints } from "@/lib/responsive";

type KeyboardShortcutContextType = Record<string, never>;

const KeyboardShortcutContext = createContext<KeyboardShortcutContextType | undefined>(undefined);

function isTextInput(el: EventTarget | null): boolean {
  if (!el || !(el instanceof HTMLElement)) return false;
  const tag = el.tagName.toLowerCase();
  return tag === "input" || tag === "textarea" || tag === "select" || el.isContentEditable;
}

function focusCatalogSearch(): boolean {
  const input = document.querySelector<HTMLInputElement>('input[aria-label="Search courses"]');
  if (input) {
    input.focus();
    return true;
  }
  return false;
}

export function KeyboardShortcutProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const pendingFocus = useRef(false);

  useEffect(() => {
    if (pendingFocus.current && pathname.startsWith("/catalog")) {
      pendingFocus.current = false;
      const timer = setTimeout(() => focusCatalogSearch(), 150);
      return () => clearTimeout(timer);
    }
  }, [pathname]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (window.innerWidth < breakpoints.mobile) return;

      if (e.key === "Escape" && !isTextInput(e.target)) {
        e.preventDefault();
        if (document.activeElement instanceof HTMLElement) {
          document.activeElement.blur();
        }
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        if (!focusCatalogSearch()) {
          pendingFocus.current = true;
          router.push("/catalog");
        }
        return;
      }

      if (e.key === "/" && !isTextInput(e.target)) {
        e.preventDefault();
        if (!focusCatalogSearch()) {
          pendingFocus.current = true;
          router.push("/catalog");
        }
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [router]);

  return (
    <KeyboardShortcutContext.Provider value={{}}>
      {children}
    </KeyboardShortcutContext.Provider>
  );
}

export function useKeyboardShortcuts(): KeyboardShortcutContextType {
  const ctx = useContext(KeyboardShortcutContext);
  if (!ctx) throw new Error("useKeyboardShortcuts must be used within KeyboardShortcutProvider");
  return ctx;
}
