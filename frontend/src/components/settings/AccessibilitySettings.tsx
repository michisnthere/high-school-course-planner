"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import { usePreferences } from "@/context/PreferencesContext";
import { useTranslation } from "@/context/I18nContext";

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

type SwitchControlProps = {
  checked: boolean;
  descriptionId: string;
  labelId: string;
  onChange: (checked: boolean) => void;
};

function SwitchControl({
  checked,
  descriptionId,
  labelId,
  onChange,
}: SwitchControlProps): React.ReactElement {
  const { t } = useTranslation();
  return (
    <button
      type="button"
      className={`rs-a11y-switch${checked ? " rs-a11y-switch--on" : ""}`}
      role="switch"
      aria-checked={checked}
      aria-labelledby={labelId}
      aria-describedby={descriptionId}
      onClick={() => onChange(!checked)}
    >
      <span className="rs-a11y-switch-state" aria-hidden="true">
        {checked ? t("a11y.onOption") : t("a11y.offOption")}
      </span>
      <span className="rs-a11y-switch-track" aria-hidden="true">
        <span className="rs-a11y-switch-thumb" />
      </span>
    </button>
  );
}

type SettingRowProps = {
  children: React.ReactNode;
  description: string;
  descriptionId: string;
  label: string;
  labelId: string;
  note?: string;
};

function SettingRow({
  children,
  description,
  descriptionId,
  label,
  labelId,
  note,
}: SettingRowProps): React.ReactElement {
  return (
    <div className="rs-a11y-setting">
      <div className="rs-a11y-setting-copy">
        <p id={labelId} className="rs-a11y-setting-label">
          {label}
        </p>
        <p id={descriptionId} className="rs-a11y-setting-desc">
          {description}
        </p>
        {note && <p className="rs-a11y-setting-note">{note}</p>}
      </div>
      <div className="rs-a11y-setting-control">{children}</div>
    </div>
  );
}

function AccessibilityIcon(): React.ReactElement {
  return (
    <Image
      src="/accessibility-icon.png"
      alt=""
      width={32}
      height={32}
      className="rs-a11y-button-icon"
      aria-hidden="true"
      unoptimized
    />
  );
}

function AccessibilityDialog({
  onClose,
  returnFocusRef,
}: {
  onClose: () => void;
  returnFocusRef: React.RefObject<HTMLButtonElement | null>;
}): React.ReactElement {
  const {
    preferences,
    setKeyboardShortcuts,
    setLargerText,
    setReducedMotion,
  } = usePreferences();
  const { t } = useTranslation();
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
        id="rs-a11y-dialog"
        className="rs-a11y-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="rs-a11y-dialog-title"
        aria-describedby="rs-a11y-dialog-description"
      >
        <div className="rs-a11y-dialog-header">
          <div>
            <h2 id="rs-a11y-dialog-title" className="rs-a11y-dialog-title">
              {t("a11y.dialogTitle")}
            </h2>
            <p
              id="rs-a11y-dialog-description"
              className="rs-a11y-dialog-intro"
            >
              {t("a11y.dialogDescription")}
            </p>
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            className="rs-a11y-close"
            onClick={closeDialog}
            aria-label={t("a11y.closeAriaLabel")}
            title={t("a11y.close")}
          >
            {t("a11y.close")}
          </button>
        </div>

        <div className="rs-a11y-settings">
          <SettingRow
            label={t("a11y.keyboardShortcuts")}
            labelId="rs-a11y-keyboard-label"
            description={t("a11y.keyboardShortcutsDescription")}
            descriptionId="rs-a11y-keyboard-desc"
            note={t("a11y.keyboardShortcutsNote")}
          >
            <SwitchControl
              checked={preferences.keyboardShortcuts}
              onChange={setKeyboardShortcuts}
              labelId="rs-a11y-keyboard-label"
              descriptionId="rs-a11y-keyboard-desc"
            />
          </SettingRow>

          <SettingRow
            label={t("a11y.largerText")}
            labelId="rs-a11y-text-label"
            description={t("a11y.largerTextDescription")}
            descriptionId="rs-a11y-text-desc"
          >
            <SwitchControl
              checked={preferences.largerText}
              onChange={setLargerText}
              labelId="rs-a11y-text-label"
              descriptionId="rs-a11y-text-desc"
            />
          </SettingRow>

          <SettingRow
            label={t("a11y.reduceMotion")}
            labelId="rs-a11y-motion-label"
            description={t("a11y.reduceMotionDescription")}
            descriptionId="rs-a11y-motion-desc"
          >
            <fieldset
              className="rs-a11y-segmented"
              aria-labelledby="rs-a11y-motion-label"
              aria-describedby="rs-a11y-motion-desc"
            >
              <legend className="rs-visually-hidden">{t("a11y.reduceMotionLegend")}</legend>
              {[
                ["system", t("a11y.followSystem")],
                ["on", t("a11y.onOption")],
                ["off", t("a11y.offOption")],
              ].map(([value, label]) => (
                <label
                  key={value}
                  className={`rs-a11y-segment${
                    preferences.reducedMotion === value
                      ? " rs-a11y-segment--selected"
                      : ""
                  }`}
                >
                  <input
                    type="radio"
                    name="rs-a11y-reduce-motion"
                    value={value}
                    checked={preferences.reducedMotion === value}
                    onChange={() =>
                      setReducedMotion(value as "system" | "on" | "off")
                    }
                  />
                  <span>{label}</span>
                </label>
              ))}
            </fieldset>
          </SettingRow>
        </div>

        <section
          className="rs-a11y-info"
          aria-labelledby="rs-a11y-info-title"
        >
          <h3 id="rs-a11y-info-title">{t("a11y.howSettingsHelp")}</h3>
          <p>
            {t("a11y.infoText")}
          </p>
          <dl>
            <div>
              <dt>{t("a11y.dtKeyboardShortcuts")}</dt>
              <dd>
                {t("a11y.ddKeyboardShortcuts")}
              </dd>
            </div>
            <div>
              <dt>{t("a11y.dtLargerText")}</dt>
              <dd>
                {t("a11y.ddLargerText")}
              </dd>
            </div>
            <div>
              <dt>{t("a11y.dtReduceMotion")}</dt>
              <dd>
                {t("a11y.ddReduceMotion")}
              </dd>
            </div>
          </dl>
          <p>
            {t("a11y.wcagDisclaimer")}
          </p>
        </section>

        <section
          className="rs-a11y-icon-attribution"
          aria-labelledby="rs-a11y-icon-attribution-title"
        >
          <h3 id="rs-a11y-icon-attribution-title">{t("a11y.iconAttribution")}</h3>
          <p>
            {t("a11y.iconAttributionText")}
          </p>
        </section>
      </div>
    </div>,
    document.body
  );
}

export function AccessibilitySettingsButton(): React.ReactElement {
  const [isOpen, setIsOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const { t } = useTranslation();

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        className="rs-a11y-button"
        data-tour="a11y-settings"
        aria-label={t("a11y.buttonLabel")}
        title={t("a11y.buttonLabel")}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        aria-controls={isOpen ? "rs-a11y-dialog" : undefined}
        onClick={() => setIsOpen(true)}
        style={buttonTargetSizeStyle}
      >
        <AccessibilityIcon />
      </button>
      {isOpen && (
        <AccessibilityDialog
          onClose={() => setIsOpen(false)}
          returnFocusRef={buttonRef}
        />
      )}
    </>
  );
}
