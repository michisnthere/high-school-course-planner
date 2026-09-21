"use client";

import React from "react";
import { useTranslation } from "@/context/I18nContext";
import { ResponsivePage } from "@/components/responsive/ResponsivePage";
import { breakpoints } from "@/lib/responsive";

const sectionStyle: React.CSSProperties = {
  marginBottom: "32px",
};

const headingStyle: React.CSSProperties = {
  fontSize: "20px",
  fontWeight: 600,
  color: "var(--text-primary)",
  margin: "0 0 12px",
};

const bodyStyle: React.CSSProperties = {
  fontSize: "15px",
  lineHeight: 1.7,
  color: "var(--text-secondary)",
  margin: "0 0 8px",
};

const cardStyle: React.CSSProperties = {
  padding: "20px 24px",
  backgroundColor: "var(--bg-card)",
  border: "1px solid var(--border-default)",
  borderRadius: "12px",
  marginBottom: "16px",
};

const statusGridStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "12px",
};

export default function AboutPage(): React.ReactElement {
  const { t } = useTranslation();

  return (
    <>
      <style>{`
        @media (max-width: ${breakpoints.mobile - 1}px) {
          .rs-about-title {
            font-size: 1.5rem !important;
          }
        }
      `}</style>
      <ResponsivePage maxWidth={800}>
        <h1
          className="rs-about-title"
          style={{
            fontSize: "28px",
            fontWeight: 700,
            color: "var(--text-primary)",
            margin: "0 0 28px",
          }}
        >
          {t("about.heading")}
        </h1>

        <div style={cardStyle}>
          <p style={bodyStyle}>
            {t("about.introParagraph1")}
          </p>
          <p style={bodyStyle}>
            {t("about.introParagraph2")}
          </p>
          <p style={bodyStyle}>
            {t("about.introParagraph3")}
          </p>
        </div>

        <div style={sectionStyle}>
          <h2 style={headingStyle}>{t("about.howItWorks")}</h2>
          <div style={cardStyle}>
            <p style={bodyStyle}>
              {t("about.howItWorksParagraph1")}
            </p>
            <p style={bodyStyle}>
              {t("about.howItWorksParagraph2")}
            </p>
          </div>
        </div>

        <div style={sectionStyle}>
          <h2 style={headingStyle}>{t("about.projectStatus")}</h2>
          <div style={{ ...cardStyle, ...statusGridStyle }}>
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <span
                style={{
                  display: "inline-flex",
                  padding: "4px 10px",
                  fontSize: "12px",
                  fontWeight: 600,
                  borderRadius: "6px",
                  backgroundColor: "var(--brand-accent-light)",
                  color: "var(--brand-primary)",
                  textTransform: "uppercase",
                  letterSpacing: "0.03em",
                }}
              >
                {t("about.beta")}
              </span>
              <span style={{ fontSize: "14px", color: "var(--text-secondary)" }}>
                {t("about.activeDevelopment")}
              </span>
            </div>

            <p style={bodyStyle}>
              {t("about.builtBy")}
            </p>

            <p style={bodyStyle}>
              {t("about.feedbackPrompt")}
            </p>
          </div>
        </div>
      </ResponsivePage>
    </>
  );
}
