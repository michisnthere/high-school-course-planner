"use client";

import { useState, useEffect } from "react";
import { breakpoints } from "@/lib/responsive";

function getMatches(): { isMobile: boolean; isTablet: boolean; isDesktop: boolean } {
  if (typeof window === "undefined") {
    return { isMobile: false, isTablet: false, isDesktop: true };
  }
  const width = window.innerWidth;
  return {
    isMobile: width < breakpoints.mobile,
    isTablet: width >= breakpoints.mobile && width < breakpoints.tablet,
    isDesktop: width >= breakpoints.tablet,
  };
}

export function useBreakpoint() {
  const [matches, setMatches] = useState(getMatches);

  useEffect(() => {
    const onResize = () => setMatches(getMatches());
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  return matches;
}
