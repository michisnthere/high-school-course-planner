"use client";

import React, { useState, useCallback } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { MobileAppBar } from "@/components/layout/MobileAppBar";
import { MobileDrawer } from "@/components/responsive/MobileDrawer";
import { useAuth } from "@/context/AuthContext";
import { breakpoints } from "@/lib/responsive";

const navItems = [
  { label: "Dashboard", href: "/" },
  { label: "Course Catalog", href: "/catalog" },
  { label: "Saved Courses", href: "/saved" },
  { label: "Completed Courses", href: "/completed-courses" },
  { label: "My Planner", href: "/planner" },
  { label: "Graduation Requirements", href: "/requirements" },
];

const infoItems = [
  { label: "About", href: "/about" },
  { label: "Privacy", href: "/privacy" },
  { label: "Feedback", href: "/feedback" },
];

export function MobileNav() {
  const [isOpen, setIsOpen] = useState(false);
  const pathname = usePathname();
  const { logout, isGuest, isAuthenticated } = useAuth();

  const handleClose = useCallback(() => setIsOpen(false), []);

  return (
    <>
      <style>{`
        .rs-mobile-nav {
          display: none;
        }
        .rs-mobile-nav-drawer-content {
          display: flex;
          flex-direction: column;
          height: 100%;
          padding: 16px;
          padding-top: calc(16px + var(--safe-area-top));
          padding-bottom: calc(16px + var(--safe-area-bottom));
          box-sizing: border-box;
        }
        .rs-mobile-nav-items {
          display: flex;
          flex-direction: column;
          gap: 2px;
          flex: 1;
        }
        .rs-mobile-nav-link {
          display: block;
          padding: 12px 16px;
          font-size: 0.9375rem;
          font-weight: 500;
          color: var(--text-primary);
          text-decoration: none;
          border-radius: 10px;
          transition: background-color 0.15s;
        }
        .rs-mobile-nav-link:hover {
          background-color: var(--bg-muted);
        }
        .rs-mobile-nav-link--active {
          background-color: var(--brand-accent-light);
          color: var(--brand-primary);
          font-weight: 600;
        }
        .rs-mobile-nav-footer {
          border-top: 1px solid var(--border-default);
          padding-top: 12px;
          margin-top: 12px;
        }
        .rs-mobile-nav-footer-btn {
          width: 100%;
          padding: 12px 16px;
          font-size: 0.9375rem;
          font-weight: 500;
          color: var(--text-secondary);
          background: none;
          border: none;
          border-radius: 10px;
          cursor: pointer;
          text-align: left;
          transition: background-color 0.15s;
        }
        .rs-mobile-nav-footer-btn:hover {
          background-color: var(--bg-muted);
        }
        @media (max-width: ${breakpoints.tablet - 1}px) {
          .rs-mobile-nav {
            display: block;
          }
        }
      `}</style>

      <div className="rs-mobile-nav">
        <MobileAppBar onMenuClick={() => setIsOpen(true)} />
      </div>

      <MobileDrawer isOpen={isOpen} onClose={handleClose} side="left">
        <div className="rs-mobile-nav-drawer-content">
          <div className="rs-mobile-nav-items">
            {navItems.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.label}
                  href={item.href}
                  className={`rs-mobile-nav-link${isActive ? " rs-mobile-nav-link--active" : ""}`}
                  onClick={handleClose}
                >
                  {item.label}
                </Link>
              );
            })}
          </div>

          <div style={{ borderTop: "1px solid var(--border-default)", margin: "8px 12px" }} />

          <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
            {infoItems.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.label}
                  href={item.href}
                  className={`rs-mobile-nav-link${isActive ? " rs-mobile-nav-link--active" : ""}`}
                  onClick={handleClose}
                >
                  {item.label}
                </Link>
              );
            })}
          </div>

          {(isAuthenticated || isGuest) && (
            <div className="rs-mobile-nav-footer">
              <button
                type="button"
                className="rs-mobile-nav-footer-btn"
                onClick={() => {
                  handleClose();
                  logout();
                }}
              >
                {isGuest ? "Exit Guest Mode" : "Sign Out"}
              </button>
            </div>
          )}
        </div>
      </MobileDrawer>
    </>
  );
}
