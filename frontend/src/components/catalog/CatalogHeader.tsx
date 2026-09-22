import React from "react";
import Link from "next/link";
import { useTranslation } from "@/context/I18nContext";

export function CatalogHeader(): React.ReactElement {
  const { t } = useTranslation();
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "flex-start",
        gap: "16px",
        marginBottom: "32px",
      }}
    >
      <div>
        <h1
          style={{
            margin: 0,
            fontSize: "32px",
            fontWeight: 700,
            color: "var(--text-primary)",
            lineHeight: 1.2,
          }}
        >
          {t("catalogHeader.courseCatalog")}
        </h1>
        <p
          style={{
            margin: "8px 0 0",
            fontSize: "16px",
            color: "var(--text-secondary)",
          }}
        >
          {t("catalogHeader.browseDescription")}
        </p>
      </div>

      <Link
        href="/saved"
        style={{
          display: "inline-flex",
          alignItems: "center",
          flexShrink: 0,
          height: "40px",
          padding: "0 18px",
          fontSize: "14px",
          fontWeight: 500,
          color: "var(--btn-primary-text)",
          backgroundColor: "var(--brand-primary)",
          borderRadius: "8px",
          textDecoration: "none",
        }}
      >
        {t("catalogHeader.viewSavedCourses")}
      </Link>
    </div>
  );
}
