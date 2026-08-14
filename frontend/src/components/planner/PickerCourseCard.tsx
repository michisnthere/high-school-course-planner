"use client";

import React from "react";
import {
  pickerCardFrame,
  pickerCardHoverBorder,
  pickerCardPalette,
  pickerCardRadius,
} from "./pickerStyles";

/**
 * Shared picker course card. The regular course card is the canonical design;
 * the Summer School cards render through this same component so both course
 * types share one card structure, tag system, hover state, selected state,
 * click/keyboard behavior, and accessibility semantics. Only the data (title +
 * tag labels) differs per course type.
 */

type PickerCourseCardProps = {
  title: string;
  /** Chip labels rendered in the shared tag row (credit type, credits,
   *  duration for regular courses; division, credit type for Summer School). */
  tags?: string[];
  selected?: boolean;
  disabled?: boolean;
  disabledNote?: string;
  onSelect?: () => void;
  actionLabel?: string;
  isSaved?: boolean;
  tone?: "light" | "dark";
};

// Dark-tone palette (used by the planner's "Add a Course" modal). The light
// tone reuses the shared light-gray picker palette via pickerCardFrame.
const DARK = {
  cardBorder: "#374151",
  cardBorderSelected: "#275D38",
  cardBg: "#111827",
  cardBgSelected: "#ffffff",
  title: "#ffffff",
  titleSelected: "#000000",
  meta: "#9ca3af",
  metaSelected: "#4b5563",
  chip: "#1f2937",
  actionSelected: "#275D38",
} as const;

export function PickerCourseCard({
  title,
  tags = [],
  selected = false,
  disabled = false,
  disabledNote,
  onSelect,
  actionLabel = "Select",
  isSaved = false,
  tone = "dark",
}: PickerCourseCardProps): React.ReactElement {
  const isLight = tone === "light";
  const frame = isLight ? pickerCardFrame(selected) : undefined;

  return (
    <button
      type="button"
      onClick={() => {
        if (!disabled) onSelect?.();
      }}
      disabled={disabled}
      aria-pressed={selected}
      style={{
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "space-between",
        gap: "12px",
        padding: isLight ? "12px 14px" : "16px",
        borderRadius: isLight ? pickerCardRadius : "12px",
        backgroundColor: isLight
          ? frame?.backgroundColor
          : selected
            ? DARK.cardBgSelected
            : DARK.cardBg,
        border: isLight
          ? frame?.border
          : `2px solid ${selected ? DARK.cardBorderSelected : DARK.cardBorder}`,
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.5 : 1,
        textAlign: "left",
        color: isLight
          ? pickerCardPalette.title
          : selected
            ? DARK.titleSelected
            : "inherit",
        width: "100%",
        transition: "border-color 0.15s ease",
      }}
      onMouseEnter={(e) => {
        if (!selected && !disabled) {
          e.currentTarget.style.borderColor = isLight ? pickerCardHoverBorder : "#4b5563";
        }
      }}
      onMouseLeave={(e) => {
        if (!selected && !disabled) {
          e.currentTarget.style.borderColor = isLight ? "var(--border-default)" : DARK.cardBorder;
        }
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px" }}>
          <span
            style={{
              fontSize: "16px",
              fontWeight: 600,
              color: isLight
                ? pickerCardPalette.title
                : selected
                  ? DARK.titleSelected
                  : DARK.title,
            }}
          >
            {title}
          </span>
          {isSaved && (
            <span style={{ fontSize: "18px", color: "var(--brand-accent)" }} aria-label="Saved">
              ★
            </span>
          )}
        </div>
        {tags.length > 0 && (
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: "8px",
              fontSize: "13px",
              color: isLight
                ? pickerCardPalette.meta
                : selected
                  ? DARK.metaSelected
                  : DARK.meta,
            }}
          >
            {tags.map((tag) => (
              <span
                key={tag}
                style={{
                  padding: "3px 8px",
                  backgroundColor: isLight ? pickerCardPalette.chip : DARK.chip,
                  borderRadius: "9999px",
                }}
              >
                {tag}
              </span>
            ))}
          </div>
        )}
        {disabledNote && (
          <div style={{ marginTop: "6px", fontSize: "12px", color: "var(--status-error)" }}>
            {disabledNote}
          </div>
        )}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: "6px", flexShrink: 0 }}>
        {selected && (
          <span
            style={{
              fontSize: "16px",
              color: isLight ? pickerCardPalette.selectedAction : DARK.actionSelected,
            }}
            aria-hidden="true"
          >
            ✓
          </span>
        )}
        <span
          style={{
            fontSize: "14px",
            fontWeight: 500,
            color: selected
              ? isLight
                ? pickerCardPalette.selectedAction
                : DARK.actionSelected
              : pickerCardPalette.action,
            whiteSpace: "nowrap",
          }}
        >
          {selected ? "Selected" : actionLabel}
        </span>
      </div>
    </button>
  );
}
