"use client";

import React from "react";
import { usePreferences } from "@/context/PreferencesContext";

const sectionStyle: React.CSSProperties = {
  marginTop: "32px",
  padding: "24px",
  backgroundColor: "var(--bg-card)",
  border: "1px solid var(--border-default)",
  borderRadius: "12px",
};

const headingStyle: React.CSSProperties = {
  margin: "0 0 4px",
  fontSize: "20px",
  fontWeight: 700,
  color: "var(--text-primary)",
};

const subheadingStyle: React.CSSProperties = {
  margin: "0 0 20px",
  fontSize: "14px",
  color: "var(--text-secondary)",
};

const settingRowStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "flex-start",
  justifyContent: "space-between",
  gap: "24px",
  padding: "16px 0",
  borderBottom: "1px solid var(--border-light)",
};

const lastRowStyle: React.CSSProperties = {
  ...settingRowStyle,
  borderBottom: "none",
  paddingBottom: 0,
};

const labelGroupStyle: React.CSSProperties = {
  flex: 1,
  minWidth: 0,
};

const labelStyle: React.CSSProperties = {
  margin: "0 0 4px",
  fontSize: "15px",
  fontWeight: 600,
  color: "var(--text-primary)",
};

const descriptionStyle: React.CSSProperties = {
  margin: 0,
  fontSize: "13px",
  color: "var(--text-muted)",
  lineHeight: 1.5,
};

/* ── Toggle Switch ── */

const toggleTrackBase: React.CSSProperties = {
  position: "relative",
  width: "44px",
  height: "24px",
  borderRadius: "12px",
  border: "none",
  cursor: "pointer",
  flexShrink: 0,
  transition: "background-color 0.2s ease",
  padding: 0,
};

const toggleTrackOff: React.CSSProperties = {
  ...toggleTrackBase,
  backgroundColor: "var(--border-default)",
};

const toggleTrackOn: React.CSSProperties = {
  ...toggleTrackBase,
  backgroundColor: "var(--brand-primary)",
};

const toggleThumb: React.CSSProperties = {
  position: "absolute",
  top: "2px",
  left: "2px",
  width: "20px",
  height: "20px",
  borderRadius: "50%",
  backgroundColor: "#FFFFFF",
  boxShadow: "0 1px 3px rgba(0, 0, 0, 0.2)",
  transition: "transform 0.2s ease",
  pointerEvents: "none",
};

const toggleThumbOn: React.CSSProperties = {
  ...toggleThumb,
  transform: "translateX(20px)",
};

const visuallyHiddenStyle: React.CSSProperties = {
  position: "absolute",
  width: "1px",
  height: "1px",
  padding: 0,
  margin: "-1px",
  overflow: "hidden",
  clip: "rect(0, 0, 0, 0)",
  whiteSpace: "nowrap",
  border: 0,
};

/* ── Select ── */

const selectStyle: React.CSSProperties = {
  padding: "8px 12px",
  fontSize: "14px",
  color: "var(--text-primary)",
  backgroundColor: "var(--bg-input)",
  border: "1px solid var(--border-default)",
  borderRadius: "8px",
  cursor: "pointer",
  outline: "none",
  flexShrink: 0,
  minWidth: "160px",
};

function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
}): React.ReactElement {
  const id = React.useId();
  return (
    <div>
      <input
        type="checkbox"
        id={id}
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        style={visuallyHiddenStyle}
      />
      <label
        htmlFor={id}
        style={{ cursor: "pointer", display: "block" }}
        aria-label={label}
      >
        <span style={checked ? toggleTrackOn : toggleTrackOff}>
          <span style={checked ? toggleThumbOn : toggleThumb} />
        </span>
      </label>
    </div>
  );
}

export function AccessibilitySettings(): React.ReactElement {
  const {
    preferences,
    setKeyboardShortcuts,
    setReducedMotion,
    setLargerText,
  } = usePreferences();

  return (
    <section style={sectionStyle} aria-labelledby="a11y-settings-heading">
      <h2 id="a11y-settings-heading" style={headingStyle}>
        Accessibility &amp; Preferences
      </h2>
      <p style={subheadingStyle}>
        Customize how the application looks and behaves for you.
      </p>

      {/* ── Keyboard Shortcuts ── */}
      <div style={settingRowStyle}>
        <div style={labelGroupStyle}>
          <p id="kb-shortcuts-label" style={labelStyle}>
            Keyboard shortcuts
          </p>
          <p
            id="kb-shortcuts-desc"
            style={descriptionStyle}
          >
            Use keyboard shortcuts for faster navigation and actions.
          </p>
        </div>
        <Toggle
          checked={preferences.keyboardShortcuts}
          onChange={setKeyboardShortcuts}
          label="Keyboard shortcuts"
        />
      </div>

      {/* ── Reduced Motion ── */}
      <div style={settingRowStyle}>
        <div style={labelGroupStyle}>
          <p id="reduced-motion-label" style={labelStyle}>
            Reduce motion
          </p>
          <p
            id="reduced-motion-desc"
            style={descriptionStyle}
          >
            Reduce animations and transitions throughout the website.
          </p>
        </div>
        <div>
          <label htmlFor="reduced-motion-select" style={visuallyHiddenStyle}>
            Reduce motion
          </label>
          <select
            id="reduced-motion-select"
            value={preferences.reducedMotion}
            onChange={(e) =>
              setReducedMotion(
                e.target.value as "system" | "on" | "off"
              )
            }
            style={selectStyle}
            aria-labelledby="reduced-motion-label"
            aria-describedby="reduced-motion-desc"
          >
            <option value="system">Follow system setting</option>
            <option value="on">On</option>
            <option value="off">Off</option>
          </select>
        </div>
      </div>

      {/* ── Larger Text ── */}
      <div style={lastRowStyle}>
        <div style={labelGroupStyle}>
          <p id="larger-text-label" style={labelStyle}>
            Larger text
          </p>
          <p
            id="larger-text-desc"
            style={descriptionStyle}
          >
            Increase text size throughout the website.
          </p>
        </div>
        <Toggle
          checked={preferences.largerText}
          onChange={setLargerText}
          label="Larger text"
        />
      </div>
    </section>
  );
}
