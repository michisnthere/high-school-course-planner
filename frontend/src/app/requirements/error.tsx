"use client";

import { useTranslation } from "@/context/I18nContext";

export default function RequirementsError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const { t } = useTranslation();

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "60vh",
        padding: "40px 24px",
        textAlign: "center",
      }}
    >
      <div
        style={{
          maxWidth: "420px",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "16px",
        }}
      >
        <div
          style={{
            width: "64px",
            height: "64px",
            borderRadius: "50%",
            backgroundColor: "rgba(239, 68, 68, 0.1)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "32px",
          }}
        >
          ⚠
        </div>
        <h1
          style={{
            margin: 0,
            fontSize: "24px",
            fontWeight: 700,
            color: "var(--text-primary)",
          }}
        >
          {t("errorPage.somethingWentWrong")}
        </h1>
        <p
          style={{
            margin: 0,
            fontSize: "15px",
            color: "var(--text-secondary)",
            lineHeight: 1.5,
          }}
        >
          {t("errorPageRequirements.description")}
        </p>
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "12px",
            justifyContent: "center",
            marginTop: "8px",
          }}
        >
          <button
            type="button"
            onClick={() => reset()}
            style={{
              padding: "10px 24px",
              fontSize: "14px",
              fontWeight: 500,
              color: "#ffffff",
              backgroundColor: "var(--brand-accent)",
              border: "none",
              borderRadius: "8px",
              cursor: "pointer",
            }}
          >
            {t("errorPageRequirements.refresh")}
          </button>
          <a
            href="/requirements"
            style={{
              padding: "10px 24px",
              fontSize: "14px",
              fontWeight: 500,
              color: "var(--text-primary)",
              backgroundColor: "transparent",
              border: "1px solid var(--border-default)",
              borderRadius: "8px",
              cursor: "pointer",
              textDecoration: "none",
            }}
          >
            {t("errorPageRequirements.reloadPage")}
          </a>
          <a
            href="/"
            style={{
              padding: "10px 24px",
              fontSize: "14px",
              fontWeight: 500,
              color: "var(--text-primary)",
              backgroundColor: "transparent",
              border: "1px solid var(--border-default)",
              borderRadius: "8px",
              cursor: "pointer",
              textDecoration: "none",
            }}
          >
            {t("errorPageRequirements.dashboard")}
          </a>
          <a
            href="https://forms.gle/gPebJ41P8r8sUEsW6"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              padding: "10px 24px",
              fontSize: "14px",
              fontWeight: 500,
              color: "var(--text-primary)",
              backgroundColor: "transparent",
              border: "1px solid var(--border-default)",
              borderRadius: "8px",
              cursor: "pointer",
              textDecoration: "none",
            }}
          >
            {t("errorPageRequirements.reportBug")}
          </a>
        </div>
      </div>
    </div>
  );
}
