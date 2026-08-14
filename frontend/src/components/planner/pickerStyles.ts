import type { CSSProperties } from "react";

// Shared visual language for the course cards and search bars in the
// "Mark a course as completed" modal. Both the regular course list and the
// Summer School list use the same light-gray scheme so the two read as one
// component system.

/** Card frame shared by the regular and Summer School picker cards. */
export function pickerCardFrame(selected: boolean): Pick<CSSProperties, "border" | "backgroundColor"> {
  return {
    border: selected ? "2px solid var(--brand-accent)" : "1px solid var(--border-default)",
    backgroundColor: selected ? "var(--bg-hover, rgba(0,0,0,0.03))" : "var(--bg-input)",
  };
}

export const pickerCardRadius = "10px";

/** Hover border for the light picker cards (slightly stronger than resting). */
export const pickerCardHoverBorder = "#D1D5DB";

/** Text/chip palette used on the light picker cards. */
export const pickerCardPalette = {
  title: "var(--text-primary)",
  meta: "var(--text-secondary)",
  muted: "var(--text-muted)",
  chip: "var(--bg-muted)",
  selectedAction: "var(--brand-primary)",
  action: "var(--brand-accent)",
} as const;

/**
 * Light-gray search input shared by the picker search bars. The matching
 * `::placeholder` and `:focus` treatment is defined once in globals.css via
 * the `.rs-picker-search` class (pseudo-elements cannot be styled inline).
 */
export const pickerSearchInputStyle: CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  height: "44px",
  fontSize: "15px",
  color: "var(--text-primary)",
  backgroundColor: "var(--bg-input)",
  border: "1px solid var(--border-default)",
  borderRadius: "9999px",
  outline: "none",
};