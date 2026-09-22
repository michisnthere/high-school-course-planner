import React from "react";
import { useTranslation } from "@/context/I18nContext";

type EmptyStateProps = {
  message?: string;
};

export function EmptyState({ message }: EmptyStateProps): React.ReactElement {
  const { t } = useTranslation();
  const text = message ?? t("emptyState.noCoursesFound");
  return (
    <div
      style={{
        padding: "48px 24px",
        textAlign: "center",
        backgroundColor: "#ffffff",
        border: "1px solid #e5e7eb",
        borderRadius: "12px",

      }}
    >
      <p
        style={{
          margin: 0,
          fontSize: "18px",
          fontWeight: 400,
          color: "#6b7280",
        }}
      >
        {message}
      </p>
    </div>
  );
}
