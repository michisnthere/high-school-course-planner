"use client";

import React, { useRef, useCallback } from "react";

type CourseSearchProps = {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
  disabled?: boolean;
  onClear?: () => void;
};

const searchBtnStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: "6px",
  height: "44px",
  padding: "0 20px",
  fontSize: "14px",
  fontWeight: 500,
  color: "#FFFFFF",
  backgroundColor: "var(--brand-accent)",
  border: "none",
  borderRadius: "9999px",
  cursor: "pointer",
  whiteSpace: "nowrap",
  boxSizing: "border-box",
};

export function CourseSearch({ value, onChange, onSubmit, onKeyDown, disabled, onClear }: CourseSearchProps): React.ReactElement {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleClear = useCallback(() => {
    onClear?.();
    inputRef.current?.focus();
  }, [onClear]);

  return (
    <div className="rs-catalog-search" style={{ marginBottom: "24px" }}>
      <div
        style={{
          display: "flex",
          gap: "8px",
          alignItems: "stretch",
          maxWidth: "560px",
        }}
      >
        <div style={{ position: "relative", flex: 1, display: "flex", alignItems: "stretch" }}>
          <input
            ref={inputRef}
            type="text"
            aria-label="Search courses"
            placeholder="Search courses..."
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={onKeyDown}
            style={{
              flex: 1,
              height: "44px",
              padding: value ? "0 40px 0 18px" : "0 18px",
              fontSize: "15px",
              color: "var(--text-primary)",
              backgroundColor: "var(--bg-card)",
              border: "1px solid var(--border-default)",
              borderRadius: "9999px",
              outline: "none",
              boxSizing: "border-box",
            }}
          />
          {value && (
            <button
              type="button"
              onClick={handleClear}
              aria-label="Clear search"
              style={{
                position: "absolute",
                right: "4px",
                top: "50%",
                transform: "translateY(-50%)",
                width: "36px",
                height: "36px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: "none",
                border: "none",
                cursor: "pointer",
                color: "var(--text-muted)",
                fontSize: "18px",
                lineHeight: 1,
                borderRadius: "50%",
              }}
            >
              ✕
            </button>
          )}
        </div>
        <button
          type="button"
          onClick={onSubmit}
          disabled={disabled}
          aria-label="Search"
          style={{
            ...searchBtnStyle,
            opacity: disabled ? 0.5 : 1,
            cursor: disabled ? "not-allowed" : "pointer",
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.35-4.35" />
          </svg>
          Search
        </button>
      </div>
    </div>
  );
}
