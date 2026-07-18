"use client";

import React from "react";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { breakpoints } from "@/lib/responsive";

type MobileAppBarProps = {
  onMenuClick: () => void;
};

const pageTitles: Record<string, string> = {
  "/": "Dashboard",
  "/catalog": "Course Catalog",
  "/saved": "Saved Courses",
  "/completed-courses": "Completed Courses",
  "/planner": "My Planner",
  "/requirements": "Graduation Requirements",
  "/profile": "Profile",
  "/login": "Sign In",
};

export function MobileAppBar({ onMenuClick }: MobileAppBarProps) {
  const pathname = usePathname();
  const { user, isGuest } = useAuth();

  const title = pageTitles[pathname] ?? "Stevenson Course Planner";

  return (
    <>
      <style>{`
        .rs-mobile-appbar {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          z-index: 100;
          display: flex;
          align-items: center;
          height: 56px;
          padding: 0 12px;
          padding-top: var(--safe-area-top);
          background-color: var(--bg-header);
          border-bottom: 1px solid var(--border-default);
          box-sizing: content-box;
          gap: 8px;
        }
        .rs-mobile-appbar-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 40px;
          height: 40px;
          flex-shrink: 0;
          background: none;
          border: none;
          border-radius: 8px;
          cursor: pointer;
          color: var(--nav-text);
          transition: background-color 0.15s;
        }
        .rs-mobile-appbar-btn:hover {
          background-color: rgba(255, 255, 255, 0.1);
        }
        .rs-mobile-appbar-title {
          flex: 1;
          font-size: 1.125rem;
          font-weight: 600;
          color: var(--nav-text);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          line-height: 1.3;
        }
        .rs-mobile-appbar-right {
          display: flex;
          align-items: center;
          gap: 4px;
          flex-shrink: 0;
        }
        @media (min-width: ${breakpoints.tablet}px) {
          .rs-mobile-appbar {
            display: none;
          }
        }
      `}</style>
      <div className="rs-mobile-appbar">
        <button
          type="button"
          className="rs-mobile-appbar-btn"
          onClick={onMenuClick}
          aria-label="Open navigation menu"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="3" y1="6" x2="21" y2="6" />
            <line x1="3" y1="12" x2="21" y2="12" />
            <line x1="3" y1="18" x2="21" y2="18" />
          </svg>
        </button>

        <Image
          src="/stevensonlogo.png"
          alt="Stevenson High School"
          width={28}
          height={28}
          style={{ flexShrink: 0 }}
        />

        <span className="rs-mobile-appbar-title">{title}</span>

        <div className="rs-mobile-appbar-right">
          {(user || isGuest) && (
            <button
              type="button"
              className="rs-mobile-appbar-btn"
              onClick={() => { window.location.href = "/profile"; }}
              aria-label="Profile"
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="8" r="4" />
                <path d="M20 21c0-4.418-3.582-8-8-8s-8 3.582-8 8" />
              </svg>
            </button>
          )}
        </div>
      </div>
    </>
  );
}
