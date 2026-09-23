"use client";

import React, { useState, useCallback } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { MobileAppBar } from "@/components/layout/MobileAppBar";
import { MobileDrawer } from "@/components/responsive/MobileDrawer";
import { useAuth } from "@/context/AuthContext";
import { useTranslation } from "@/context/I18nContext";
import { breakpoints } from "@/lib/responsive";

const FEEDBACK_FORM_URL = "https://forms.gle/gPebJ41P8r8sUEsW6";

export function MobileNav() {
  const [isOpen, setIsOpen] = useState(false);
  const pathname = usePathname();
  const { logout, isGuest, isAuthenticated } = useAuth();
  const { t } = useTranslation();

  const handleClose = useCallback(() => setIsOpen(false), []);

  const navItems = [
    { label: t("nav.myProfile"), href: "/profile" },
    { label: t("nav.courseCatalog"), href: "/catalog" },
    { label: t("nav.myPlanner"), href: "/planner" },
    { label: t("nav.graduationRequirements"), href: "/requirements" },
    { label: t("nav.savedCourses"), href: "/saved" },
    { label: t("nav.completedCourses"), href: "/completed-courses" },
  ];

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
          min-height: 0;
        }
        .rs-mobile-nav-scroll {
          flex: 1;
          overflow-y: auto;
          min-height: 0;
        }
        .rs-mobile-nav-items {
          display: flex;
          flex-direction: column;
          gap: 2px;
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
          <div className="rs-mobile-nav-scroll">
            <div className="rs-mobile-nav-items">
              {navItems.map((item) => {
                const isActive = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`rs-mobile-nav-link${isActive ? " rs-mobile-nav-link--active" : ""}`}
                    onClick={handleClose}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </div>
          </div>

          {/* Sign In button for non-authenticated users */}
          {!isAuthenticated && (
            <div style={{ padding: "12px 0", marginTop: "auto" }}>
              <button
                type="button"
                onClick={() => {
                  const currentPath = window.location.pathname + window.location.search;
                  const redirectParam = currentPath !== "/login" ? `?redirect=${encodeURIComponent(currentPath)}` : "";
                  window.location.href = `/auth/google${redirectParam}`;
                }}
                style={{
                  width: "100%",
                  minHeight: "44px",
                  padding: "8px 16px",
                  fontSize: "0.9375rem",
                  fontWeight: 600,
                  color: "#FFFFFF",
                  backgroundColor: "var(--brand-accent)",
                  border: "none",
                  borderRadius: "10px",
                  cursor: "pointer",
                  boxSizing: "border-box",
                }}
              >
                {t("mobileNav.signIn")}
              </button>
            </div>
          )}

          {/* Footer links */}
          <div
            style={{
              borderTop: "1px solid var(--border-default)",
              paddingTop: "12px",
              marginTop: "4px",
            }}
          >
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                alignItems: "center",
                gap: "6px",
                fontSize: "13px",
              }}
            >
                <Link
                  href="/about"
                  style={{ color: "var(--text-secondary)", textDecoration: "underline", textUnderlineOffset: "2px" }}
                  onClick={handleClose}
                >
                  {t("mobileNav.about")}
                </Link>
                <span style={{ color: "var(--text-muted)" }}>•</span>
                <Link
                  href="/privacy"
                  style={{ color: "var(--text-secondary)", textDecoration: "underline", textUnderlineOffset: "2px" }}
                  onClick={handleClose}
                >
                  {t("mobileNav.privacy")}
                </Link>
                <span style={{ color: "var(--text-muted)" }}>•</span>
                <a
                  href={FEEDBACK_FORM_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: "var(--text-secondary)", textDecoration: "underline", textUnderlineOffset: "2px" }}
                >
                  {t("mobileNav.reportBug")}
                </a>
                <span style={{ color: "var(--text-muted)" }}>•</span>
                <a
                  href={FEEDBACK_FORM_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: "var(--text-secondary)", textDecoration: "underline", textUnderlineOffset: "2px" }}
                >
                  {t("mobileNav.sendFeedback")}
                </a>
            </div>
            <p style={{ margin: "8px 0 0", fontSize: "12px", color: "var(--text-muted)", lineHeight: 1.4 }}>
              {t("mobileNav.productName")}
              <br />
              {t("mobileNav.version")}
            </p>
            <p style={{ margin: "4px 0 0", fontSize: "11px", color: "var(--text-muted)", lineHeight: 1.4 }}>
              {t("mobileNav.disclaimer")}
            </p>
          </div>

          {/* Sign Out / Exit Guest Mode for auth/guest users */}
          {(isAuthenticated || isGuest) && (
            <div className="rs-mobile-nav-footer" style={{ marginTop: "4px" }}>
              <button
                type="button"
                className="rs-mobile-nav-footer-btn"
                onClick={() => {
                  handleClose();
                  logout();
                }}
              >
                {isGuest ? t("mobileNav.exitGuestMode") : t("mobileNav.signOut")}
              </button>
            </div>
          )}
        </div>
      </MobileDrawer>
    </>
  );
}
