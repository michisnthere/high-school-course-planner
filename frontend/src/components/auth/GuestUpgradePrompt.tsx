"use client";

import React, { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { usePlannerService, useCompletedCoursesService, useSavedCoursesService, useResolutionsService } from "@/services/ServiceContext";
import { hasGuestProgress } from "@/lib/guestProgress";
import { breakpoints } from "@/lib/responsive";

const DISMISS_KEY = "guest_upgrade_dismissed";

export function GuestUpgradePrompt() {
  const { isGuest } = useAuth();
  const plannerService = usePlannerService();
  const completedCoursesService = useCompletedCoursesService();
  const savedCoursesService = useSavedCoursesService();
  const resolutionsService = useResolutionsService();

  const [hasProgress, setHasProgress] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    if (typeof window !== "undefined") {
      setDismissed(sessionStorage.getItem(DISMISS_KEY) === "true");
    }
  }, []);

  useEffect(() => {
    if (!isGuest) return;
    setChecking(true);

    Promise.all([
      plannerService.getPlanners(),
      completedCoursesService.getCompletedCourses(),
      savedCoursesService.getSavedCourseIds(),
      resolutionsService.getResolutions(),
    ])
      .then(([planners, completed, savedIds, resolutions]) => {
        setHasProgress(hasGuestProgress(planners, completed, savedIds, resolutions));
      })
      .catch(() => setHasProgress(false))
      .finally(() => setChecking(false));
  }, [isGuest, plannerService, completedCoursesService, savedCoursesService, resolutionsService]);

  const handleDismiss = () => {
    setDismissed(true);
    sessionStorage.setItem(DISMISS_KEY, "true");
  };

  const handleSignIn = () => {
    const redirect = encodeURIComponent(window.location.pathname + window.location.search);
    window.location.href = `/auth/google?redirect=${redirect}`;
  };

  if (!isGuest || dismissed || !hasProgress || checking) return null;

  return (
    <>
      <style>{`
        .guest-upgrade {
          display: flex;
          align-items: center;
          gap: 16px;
          padding: 16px 20px;
          margin-bottom: 24px;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          border-radius: 12px;
          color: #fff;
          box-sizing: border-box;
        }
        .guest-upgrade-message {
          flex: 1;
          font-size: 0.9375rem;
          line-height: 1.5;
        }
        .guest-upgrade-message strong {
          font-weight: 600;
        }
        .guest-upgrade-btn {
          flex-shrink: 0;
          height: 40px;
          padding: 0 20px;
          font-size: 0.9375rem;
          font-weight: 500;
          color: #667eea;
          background: #fff;
          border: none;
          border-radius: 8px;
          cursor: pointer;
          font-family: var(--font-sans);
          box-sizing: border-box;
          transition: opacity 0.15s;
        }
        .guest-upgrade-btn:hover {
          opacity: 0.9;
        }
        .guest-upgrade-close {
          flex-shrink: 0;
          width: 32px;
          height: 32px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: rgba(255,255,255,0.2);
          border: none;
          border-radius: 50%;
          cursor: pointer;
          color: #fff;
          font-size: 18px;
          line-height: 1;
          padding: 0;
          box-sizing: border-box;
          transition: background 0.15s;
        }
        .guest-upgrade-close:hover {
          background: rgba(255,255,255,0.3);
        }
        @media (max-width: ${breakpoints.mobile - 1}px) {
          .guest-upgrade {
            flex-wrap: wrap;
            padding: 14px 16px;
            gap: 12px;
          }
          .guest-upgrade-btn {
            width: 100%;
            text-align: center;
          }
        }
      `}</style>
      <div className="guest-upgrade" role="alert">
        <div className="guest-upgrade-message">
          <strong>You&apos;re in Guest Mode.</strong> Your courses and plans won&apos;t be saved after you leave. Sign in with Google to keep your progress.
        </div>
        <button type="button" className="guest-upgrade-btn" onClick={handleSignIn}>
          Sign In
        </button>
        <button type="button" className="guest-upgrade-close" onClick={handleDismiss} aria-label="Dismiss">
          ×
        </button>
      </div>
    </>
  );
}
