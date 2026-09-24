"use client";

import React from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { User } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useTranslation } from "@/context/I18nContext";
import { breakpoints } from "@/lib/responsive";
import { AccessibilitySettingsButton } from "@/components/settings/AccessibilitySettings";
import { LanguageSettingsButton } from "@/components/settings/LanguageSettings";
import { TutorialButton } from "@/components/tutorial/TutorialButton";

type MobileAppBarProps = {
  onMenuClick: () => void;
};

export function MobileAppBar({ onMenuClick }: MobileAppBarProps) {
  const pathname = usePathname();
  const { user, isGuest } = useAuth();
  const { t } = useTranslation();

  const pageTitles: Record<string, string> = {
    "/": t("mobileAppBar.dashboard"),
    "/catalog": t("nav.courseCatalog"),
    "/saved": t("nav.savedCourses"),
    "/completed": t("nav.completedCourses"),
    "/planner": t("nav.myPlanner"),
    "/requirements": t("nav.graduationRequirements"),
    "/profile": t("mobileAppBar.profile"),
    "/login": t("mobileAppBar.signIn"),
  };

  const title = pageTitles[pathname] ?? t("mobileAppBar.fallbackTitle");

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
          aria-label={t("aria.openNavigationMenu")}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="3" y1="6" x2="21" y2="6" />
            <line x1="3" y1="12" x2="21" y2="12" />
            <line x1="3" y1="18" x2="21" y2="18" />
          </svg>
        </button>

        <Image
          src="/stevensonlogo.png"
          alt={t("aria.stevensonHighSchool")}
          width={28}
          height={28}
          style={{ flexShrink: 0 }}
        />

        <span className="rs-mobile-appbar-title">{title}</span>

        <div className="rs-mobile-appbar-right">
          <TutorialButton />
          <LanguageSettingsButton />
          <AccessibilitySettingsButton />
          {(user || isGuest) && (
            <Link
              href="/profile"
              className="rs-mobile-appbar-btn"
              aria-label={t("aria.myProfile")}
              title={t("aria.myProfile")}
            >
              <User size={22} color="var(--a11y-icon-color)" strokeWidth={1.8} />
            </Link>
          )}
        </div>
      </div>
    </>
  );
}
