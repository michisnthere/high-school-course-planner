"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useTranslation } from "@/context/I18nContext";

export function DeleteAccountSection(): React.ReactElement | null {
  const { isAuthenticated, deleteAccount } = useAuth();
  const { t } = useTranslation();

  const [open, setOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cancelButtonRef = useRef<HTMLButtonElement>(null);
  const confirmButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (open) {
      cancelButtonRef.current?.focus();
    }
  }, [open]);

  const closeDialog = useCallback(() => {
    if (deleting) return;
    setOpen(false);
    setError(null);
  }, [deleting]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        closeDialog();
        return;
      }
      if (e.key === "Tab") {
        const focusables = [cancelButtonRef.current, confirmButtonRef.current].filter(
          Boolean
        ) as HTMLButtonElement[];
        if (focusables.length === 0) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        const active = document.activeElement;
        if (e.shiftKey) {
          if (active === first || !focusables.includes(active as HTMLButtonElement)) {
            e.preventDefault();
            last.focus();
          }
        } else if (active === last || !focusables.includes(active as HTMLButtonElement)) {
          e.preventDefault();
          first.focus();
        }
      }
    },
    [closeDialog]
  );

  const handleConfirm = useCallback(async () => {
    setDeleting(true);
    setError(null);
    try {
      await deleteAccount();
      // Success: AuthContext clears auth state and redirects to Home.
    } catch (err) {
      setError(
        err instanceof Error && err.message
          ? err.message
          : t("profile.deleteAccountError")
      );
      setDeleting(false);
    }
  }, [deleteAccount, t]);

  if (!isAuthenticated) return null;

  return (
    <>
      <div
        style={{
          marginTop: "16px",
          paddingTop: "16px",
          borderTop: "1px solid var(--border-default)",
        }}
      >
        <h3
          style={{
            margin: "0 0 6px",
            fontSize: "15px",
            fontWeight: 600,
            color: "var(--text-primary)",
          }}
        >
          {t("profile.deleteAccount")}
        </h3>
        <p
          style={{
            margin: "0 0 12px",
            fontSize: "14px",
            lineHeight: 1.5,
            color: "var(--text-secondary)",
          }}
        >
          {t("profile.deleteAccountDescription")}
        </p>
        <button
          type="button"
          onClick={() => {
            setError(null);
            setOpen(true);
          }}
          style={{
            padding: "10px 20px",
            fontSize: "14px",
            fontWeight: 600,
            color: "#dc2626",
            backgroundColor: "transparent",
            border: "1px solid #dc2626",
            borderRadius: "8px",
            cursor: "pointer",
            minHeight: "44px",
          }}
        >
          {t("profile.deleteAccount")}
        </button>
      </div>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-account-title"
          aria-describedby="delete-account-description"
          onKeyDown={handleKeyDown}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 1000,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: "rgba(0, 0, 0, 0.5)",
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) closeDialog();
          }}
        >
          <div
            style={{
              width: "100%",
              maxWidth: "480px",
              maxHeight: "90vh",
              overflowY: "auto",
              backgroundColor: "var(--bg-card)",
              borderRadius: "12px",
              border: "1px solid var(--border-default)",
              padding: "28px",
              margin: "16px",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2
              id="delete-account-title"
              style={{
                margin: "0 0 12px",
                fontSize: "20px",
                fontWeight: 700,
                color: "var(--text-primary)",
              }}
            >
              {t("profile.deleteAccountConfirmTitle")}
            </h2>
            <p
              id="delete-account-description"
              style={{
                margin: "0 0 8px",
                fontSize: "15px",
                lineHeight: 1.6,
                color: "var(--text-secondary)",
              }}
            >
              {t("profile.deleteAccountConfirmBody")}
            </p>
            {error && (
              <div
                role="alert"
                style={{
                  margin: "12px 0 0",
                  padding: "12px 16px",
                  fontSize: "14px",
                  fontWeight: 500,
                  color: "#dc3545",
                  backgroundColor: "#fff5f5",
                  border: "1px solid #fecaca",
                  borderRadius: "8px",
                }}
              >
                {error}
              </div>
            )}
            <div
              style={{
                display: "flex",
                gap: "12px",
                justifyContent: "flex-end",
                marginTop: "24px",
              }}
            >
              <button
                ref={cancelButtonRef}
                type="button"
                onClick={closeDialog}
                disabled={deleting}
                style={{
                  padding: "10px 20px",
                  fontSize: "14px",
                  fontWeight: 500,
                  color: "var(--text-secondary)",
                  backgroundColor: "transparent",
                  border: "1px solid var(--border-default)",
                  borderRadius: "8px",
                  cursor: deleting ? "not-allowed" : "pointer",
                  opacity: deleting ? 0.6 : 1,
                  minHeight: "44px",
                }}
              >
                {t("common.cancel")}
              </button>
              <button
                ref={confirmButtonRef}
                type="button"
                onClick={handleConfirm}
                disabled={deleting}
                style={{
                  padding: "10px 20px",
                  fontSize: "14px",
                  fontWeight: 600,
                  color: "#FFFFFF",
                  backgroundColor: "#dc2626",
                  border: "none",
                  borderRadius: "8px",
                  cursor: deleting ? "not-allowed" : "pointer",
                  opacity: deleting ? 0.7 : 1,
                  minHeight: "44px",
                }}
              >
                {deleting
                  ? t("profile.deleteAccountDeleting")
                  : t("profile.deleteAccountConfirmButton")}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
