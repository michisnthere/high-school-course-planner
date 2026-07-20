"use client";

import React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { breakpoints } from "@/lib/responsive";

export default function NotFoundPage(): React.ReactElement {
  const router = useRouter();

  return (
    <>
      <style>{`
        .rs-not-found {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          min-height: calc(100vh - 64px - 48px);
          padding: 48px 24px;
          box-sizing: border-box;
          text-align: center;
        }
        .rs-not-found-icon {
          margin-bottom: 24px;
        }
        .rs-not-found-title {
          font-size: 28px;
          font-weight: 700;
          color: var(--text-primary);
          margin: 0 0 12px;
        }
        .rs-not-found-message {
          font-size: 15px;
          line-height: 1.6;
          color: var(--text-secondary);
          margin: 0 0 32px;
          max-width: 420px;
        }
        .rs-not-found-actions {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 12px;
        }
        .rs-not-found-btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          padding: 12px 28px;
          font-size: 15px;
          font-weight: 500;
          border-radius: 10px;
          text-decoration: none;
          cursor: pointer;
          transition: background-color 0.15s;
          font-family: var(--font-sans);
          line-height: 1.4;
          min-width: 240px;
          box-sizing: border-box;
        }
        .rs-not-found-btn--primary {
          background-color: var(--brand-accent);
          color: var(--text-on-accent);
          border: none;
        }
        .rs-not-found-btn--primary:hover {
          opacity: 0.9;
        }
        .rs-not-found-btn--secondary {
          background-color: var(--btn-secondary-bg);
          color: var(--btn-secondary-text);
          border: 1px solid var(--btn-secondary-border);
        }
        .rs-not-found-btn--secondary:hover {
          background-color: var(--bg-muted);
        }
        .rs-not-found-back {
          margin-top: 8px;
          font-size: 14px;
          color: var(--text-secondary);
          background: none;
          border: none;
          cursor: pointer;
          text-decoration: underline;
          text-underline-offset: 3px;
          font-family: var(--font-sans);
          padding: 8px 12px;
        }
        .rs-not-found-back:hover {
          color: var(--text-primary);
        }
        @media (max-width: ${breakpoints.mobile - 1}px) {
          .rs-not-found {
            min-height: calc(100vh - 56px - 32px);
            padding: 32px 20px;
          }
          .rs-not-found-title {
            font-size: 24px;
          }
          .rs-not-found-btn {
            min-width: 100%;
          }
          .rs-not-found-actions {
            width: 100%;
          }
        }
      `}</style>

      <div className="rs-not-found">
        <div className="rs-not-found-icon">
          <svg
            width="80"
            height="80"
            viewBox="0 0 80 80"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden="true"
          >
            <circle cx="40" cy="40" r="36" stroke="var(--brand-accent)" strokeWidth="2.5" fill="none" />
            <circle cx="40" cy="40" r="16" stroke="var(--brand-accent)" strokeWidth="2.5" fill="none" />
            <line x1="40" y1="4" x2="40" y2="18" stroke="var(--brand-accent)" strokeWidth="2.5" strokeLinecap="round" />
            <line x1="40" y1="62" x2="40" y2="76" stroke="var(--brand-accent)" strokeWidth="2.5" strokeLinecap="round" />
            <line x1="4" y1="40" x2="18" y2="40" stroke="var(--brand-accent)" strokeWidth="2.5" strokeLinecap="round" />
            <line x1="62" y1="40" x2="76" y2="40" stroke="var(--brand-accent)" strokeWidth="2.5" strokeLinecap="round" />
            <line x1="12.2" y1="12.2" x2="22" y2="22" stroke="var(--brand-accent)" strokeWidth="2.5" strokeLinecap="round" />
            <line x1="58" y1="58" x2="67.8" y2="67.8" stroke="var(--brand-accent)" strokeWidth="2.5" strokeLinecap="round" />
            <line x1="12.2" y1="67.8" x2="22" y2="58" stroke="var(--brand-accent)" strokeWidth="2.5" strokeLinecap="round" />
            <line x1="58" y1="22" x2="67.8" y2="12.2" stroke="var(--brand-accent)" strokeWidth="2.5" strokeLinecap="round" />
          </svg>
        </div>

        <h1 className="rs-not-found-title">Page Not Found</h1>

        <p className="rs-not-found-message">
          The page you&apos;re looking for doesn&apos;t exist or may have moved.
        </p>

        <div className="rs-not-found-actions">
          <Link href="/" className="rs-not-found-btn rs-not-found-btn--primary">
            Return to Dashboard
          </Link>
          <Link href="/catalog" className="rs-not-found-btn rs-not-found-btn--secondary">
            Browse Course Catalog
          </Link>
          <button
            type="button"
            className="rs-not-found-back"
            onClick={() => {
              if (window.history.length > 1) {
                router.back();
              } else {
                router.push("/");
              }
            }}
          >
            Go Back
          </button>
        </div>
      </div>
    </>
  );
}
