"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import { usePreferences } from "@/context/PreferencesContext";
import { LanguageSelector } from "./LanguageSelector";

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
        {checked ? "On" : "Off"}
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
              Accessibility &amp; Preferences
            </h2>
            <p
              id="rs-a11y-dialog-description"
              className="rs-a11y-dialog-intro"
            >
              Customize how the Course Planner looks and behaves. These
              settings are optional and can be changed at any time.
            </p>
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            className="rs-a11y-close"
            onClick={closeDialog}
            aria-label="Close Accessibility & Preferences"
            title="Close"
          >
            Close
          </button>
        </div>

        <div className="rs-a11y-settings">
          <SettingRow
            label="Keyboard shortcuts"
            labelId="rs-a11y-keyboard-label"
            description="Use keyboard shortcuts for faster navigation and actions."
            descriptionId="rs-a11y-keyboard-desc"
            note="No application-level character-key shortcuts are currently active. This preference is saved for any future application shortcuts."
          >
            <SwitchControl
              checked={preferences.keyboardShortcuts}
              onChange={setKeyboardShortcuts}
              labelId="rs-a11y-keyboard-label"
              descriptionId="rs-a11y-keyboard-desc"
            />
          </SettingRow>

          <SettingRow
            label="Larger text"
            labelId="rs-a11y-text-label"
            description="Increase text size throughout the website."
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
            label="Reduce motion"
            labelId="rs-a11y-motion-label"
            description="Reduce animations and transitions throughout the website."
            descriptionId="rs-a11y-motion-desc"
          >
            <fieldset
              className="rs-a11y-segmented"
              aria-labelledby="rs-a11y-motion-label"
              aria-describedby="rs-a11y-motion-desc"
            >
              <legend className="rs-visually-hidden">Reduce motion</legend>
              {[
                ["system", "Follow system"],
                ["on", "On"],
                ["off", "Off"],
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

          <LanguageSelector />
        </div>

        <section
          className="rs-a11y-info"
          aria-labelledby="rs-a11y-info-title"
        >
          <h3 id="rs-a11y-info-title">How these settings help</h3>
          <p>
            The Course Planner is designed to be accessible to all users. These
            optional preferences allow users to customize certain aspects of the
            experience.
          </p>
          <dl>
            <div>
              <dt>Keyboard shortcuts</dt>
              <dd>
                WCAG 2.2 2.1.4 Character Key Shortcuts, Level A: if
                single-character application shortcuts are used, users must be
                able to turn them off, remap them, or restrict them to a
                relevant component.
              </dd>
            </div>
            <div>
              <dt>Larger text</dt>
              <dd>
                WCAG 2.2 1.4.4 Resize Text and 1.4.10 Reflow, Level AA:
                content should remain usable when text is enlarged. This
                setting is an optional larger-text presentation and does not
                replace browser zoom.
              </dd>
            </div>
            <div>
              <dt>Reduce motion</dt>
              <dd>
                WCAG 2.2 2.3.3 Animation from Interactions, Level AAA: reducing
                unnecessary motion can improve comfort. The site also respects
                the system prefers-reduced-motion setting.
              </dd>
            </div>
          </dl>
          <p>
            These settings support accessibility but do not by themselves
            establish WCAG 2.2 conformance.
          </p>
        </section>

        <section
          className="rs-a11y-icon-attribution"
          aria-labelledby="rs-a11y-icon-attribution-title"
        >
          <h3 id="rs-a11y-icon-attribution-title">Icon attribution</h3>
          <p>
            Accessibility icon: Dave Braunschweig,{" "}
            <a
              href="https://commons.wikimedia.org/wiki/File:Accessibility.svg"
              target="_blank"
              rel="noreferrer"
            >
              Accessibility.svg
            </a>
            . Licensed under{" "}
            <a
              href="https://creativecommons.org/licenses/by-sa/4.0/"
              target="_blank"
              rel="noreferrer"
            >
              CC BY-SA 4.0
            </a>
            . Used without modification.
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

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        className="rs-a11y-button"
        aria-label="Accessibility & Preferences"
        title="Accessibility & Preferences"
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
