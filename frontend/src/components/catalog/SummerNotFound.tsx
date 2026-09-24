"use client";

import React from "react";
import Link from "next/link";
import { useTranslation } from "@/context/I18nContext";

export function SummerNotFound(): React.ReactElement {
  const { t } = useTranslation();
  return (
    <div style={{ padding: "32px" }}>
      <div
        style={{
          padding: "48px 32px",
          backgroundColor: "#ffffff",
          border: "1px solid #e5e7eb",
          borderRadius: "12px",
          textAlign: "center",
          maxWidth: "600px",
        }}
      >
        <h1
          style={{
            margin: "0 0 12px",
            fontSize: "28px",
            fontWeight: 700,
            color: "#111827",
          }}
        >
          {t("catalogNotFound.courseNotFound")}
        </h1>
        <p
          style={{
            margin: "0 0 24px",
            fontSize: "16px",
            color: "#6b7280",
          }}
        >
          {t("summerCourseDetail.notFoundDescription")}
        </p>
        <Link
          href="/catalog?source=summer"
          style={{
            display: "inline-block",
            padding: "12px 20px",
            fontSize: "15px",
            fontWeight: 500,
            color: "#374151",
            backgroundColor: "#ffffff",
            border: "1px solid #e5e7eb",
            borderRadius: "8px",
            textDecoration: "none",
          }}
        >
          {t("summerCourseDetail.backToSummerCatalogButton")}
        </Link>
      </div>
    </div>
  );
}
