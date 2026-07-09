import React from "react";

type EmptyStateProps = {
  message?: string;
};

export function EmptyState({ message = "No courses found." }: EmptyStateProps): React.ReactElement {
  return (
    <div
      style={{
        padding: "48px 24px",
        textAlign: "center",
        backgroundColor: "#ffffff",
        border: "1px solid #e5e7eb",
        borderRadius: "12px",
        fontFamily:
          '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
      }}
    >
      <p
        style={{
          margin: 0,
          fontSize: "18px",
          fontWeight: 500,
          color: "#6b7280",
        }}
      >
        {message}
      </p>
    </div>
  );
}
