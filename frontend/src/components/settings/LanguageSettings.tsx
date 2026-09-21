"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "@/context/I18nContext";
import type { Locale } from "@/lib/i18n";

const focusableSelector = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

const buttonTargetSizeStyle: React.CSSProperties = {
  width: 44,
  height: 44,
  minWidth: 44,
  minHeight: 44,
};

function GlobeIcon(): React.ReactElement {
  return (
    <svg
      width="28"
      height="28"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="10" />
      <line x1="2" y1="12" x2="22" y2="12" />
      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
    </svg>
  );
}

function LanguageDialog({
  onClose,
  returnFocusRef,
}: {
  onClose: () => void;
  returnFocusRef: React.RefObject<HTMLButtonElement | null>;
}): React.ReactElement {
  const { locale, setLocale, availableLocales, t } = useTranslation();
  const dialogRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  const closeDialog = useCallback(() => {
    onClose();
    window.requestAnimationFrame(() => returnFocusRef.current?.focus());
  }, [onClose, returnFocusRef]);

  useEffect(() => {
    closeButtonRef.current?.focus();
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const hiddenSiblings = Array.from(document.body.children)
      .filter((element) => element !== overlayRef.current)
      .map((element) => ({
        element,
        ariaHidden: element.getAttribute("aria-hidden"),
        inert: element.hasAttribute("inert"),
      }));

    hiddenSiblings.forEach(({ element }) => {
      element.setAttribute("aria-hidden", "true");
      element.setAttribute("inert", "");
    });

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        closeDialog();
        return;
      }

      if (event.key !== "Tab" || !dialogRef.current) return;

      const focusable = Array.from(
        dialogRef.current.querySelectorAll<HTMLElement>(focusableSelector)
      ).filter((element) => element.getClientRects().length > 0);
      if (focusable.length === 0) {
        event.preventDefault();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;

      if (event.shiftKey && active === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = originalOverflow;
      hiddenSiblings.forEach(({ element, ariaHidden, inert }) => {
        if (ariaHidden === null) {
          element.removeAttribute("aria-hidden");
        } else {
          element.setAttribute("aria-hidden", ariaHidden);
        }
        if (!inert) element.removeAttribute("inert");
      });
    };
  }, [closeDialog]);

  return createPortal(
    <div
      ref={overlayRef}
      className="rs-a11y-overlay"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) closeDialog();
      }}
    >
      <div
        ref={dialogRef}
        className="rs-a11y-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="rs-lang-dialog-title"
        aria-describedby="rs-lang-dialog-description"
      >
        <div className="rs-a11y-dialog-header">
          <div>
            <h2 id="rs-lang-dialog-title" className="rs-a11y-dialog-title">
              {t("language.dialogTitle")}
            </h2>
            <p
              id="rs-lang-dialog-description"
              className="rs-a11y-dialog-intro"
            >
              {t("language.dialogDescription")}
            </p>
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            className="rs-a11y-close"
            onClick={closeDialog}
            aria-label={t("a11y.close")}
            title={t("a11y.close")}
          >
            {t("a11y.close")}
          </button>
        </div>

        <div className="rs-a11y-settings">
          <div className="rs-a11y-setting">
            <div className="rs-a11y-setting-copy">
              <p id="rs-lang-select-label" className="rs-a11y-setting-label">
                {t("language.label")}
              </p>
              <p id="rs-lang-select-desc" className="rs-a11y-setting-desc">
                {t("language.description")}
              </p>
            </div>
            <div className="rs-a11y-setting-control">
              <label
                htmlFor="language-settings-select"
                style={{
                  position: "absolute",
                  width: "1px",
                  height: "1px",
                  padding: 0,
                  margin: "-1px",
                  overflow: "hidden",
                  clip: "rect(0, 0, 0, 0)",
                  whiteSpace: "nowrap",
                  border: 0,
                }}
              >
                {t("language.label")}
              </label>
              <select
                id="language-settings-select"
                value={locale}
                onChange={(e) => setLocale(e.target.value as Locale)}
                aria-labelledby="rs-lang-select-label"
                aria-describedby="rs-lang-select-desc"
                style={{
                  padding: "8px 12px",
                  fontSize: "14px",
                  color: "var(--text-primary)",
                  backgroundColor: "var(--bg-input)",
                  border: "1px solid var(--border-default)",
                  borderRadius: "8px",
                  cursor: "pointer",
                  outline: "none",
                  minWidth: "160px",
                }}
              >
                {availableLocales.map((loc) => (
                  <option key={loc.code} value={loc.code}>
                    {loc.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

export function LanguageSettingsButton(): React.ReactElement {
  const [isOpen, setIsOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        className="rs-a11y-button"
        data-tour="language-settings"
        aria-label="Language Settings"
        title="Language Settings"
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        aria-controls={isOpen ? "rs-lang-dialog" : undefined}
        onClick={() => setIsOpen(true)}
        style={buttonTargetSizeStyle}
      >
        <GlobeIcon />
      </button>
      {isOpen && (
        <LanguageDialog
          onClose={() => setIsOpen(false)}
          returnFocusRef={buttonRef}
        />
      )}
    </>
  );
}
