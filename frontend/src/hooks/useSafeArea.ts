"use client";

import { useState, useEffect } from "react";

export type SafeAreaInsets = {
  top: number;
  bottom: number;
  left: number;
  right: number;
};

function parsePx(value: string | null): number {
  if (!value) return 0;
  const match = value.match(/^(\d+)px$/);
  return match ? parseInt(match[1], 10) : 0;
}

export function useSafeArea(): SafeAreaInsets {
  const [insets, setInsets] = useState<SafeAreaInsets>({ top: 0, bottom: 0, left: 0, right: 0 });

  useEffect(() => {
    const computed = getComputedStyle(document.documentElement);
    setInsets({
      top: parsePx(computed.getPropertyValue("--safe-area-top")),
      bottom: parsePx(computed.getPropertyValue("--safe-area-bottom")),
      left: parsePx(computed.getPropertyValue("--safe-area-left")),
      right: parsePx(computed.getPropertyValue("--safe-area-right")),
    });
  }, []);

  return insets;
}
