"use client";

import React from "react";
import { useTranslation } from "@/context/I18nContext";
import { ResponsivePage } from "@/components/responsive/ResponsivePage";
import { breakpoints } from "@/lib/responsive";

const cardStyle: React.CSSProperties = {
  padding: "20px 24px",
  backgroundColor: "var(--bg-card)",
  border: "1px solid var(--border-default)",
  borderRadius: "12px",
  marginBottom: "16px",
};

const headingStyle: React.CSSProperties = {
  fontSize: "18px",
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

const listStyle: React.CSSProperties = {
  listStyle: "none",
  padding: 0,
  margin: "12px 0 4px",
};

const listItemStyle: React.CSSProperties = {
  padding: "8px 0 8px 24px",
  fontSize: "15px",
  lineHeight: 1.5,
  color: "var(--text-secondary)",
  position: "relative",
};

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}): React.ReactElement {
  return (
    <div style={cardStyle}>
      <h2 style={headingStyle}>{title}</h2>
      {children}
    </div>
  );
}

function Paragraph({ textKey }: { textKey: string }): React.ReactElement {
  const { t } = useTranslation();
  return <p style={bodyStyle}>{t(textKey)}</p>;
}

export default function PrivacyPage(): React.ReactElement {
  const { t } = useTranslation();

  return (
    <>
      <style>{`
        @media (max-width: ${breakpoints.mobile - 1}px) {
          .rs-privacy-title {
            font-size: 1.5rem !important;
          }
        }
        .rs-privacy-list-item::before {
          content: "\\2022";
          position: absolute;
          left: 8px;
          color: var(--brand-accent);
        }
      `}</style>
      <ResponsivePage maxWidth={800}>
        <h1
          className="rs-privacy-title"
          style={{
            fontSize: "28px",
            fontWeight: 700,
            color: "var(--text-primary)",
            margin: "0 0 8px",
          }}
        >
          {t("privacy.heading")}
        </h1>
        <p
          style={{
            ...bodyStyle,
            marginBottom: "24px",
            fontSize: "13px",
          }}
        >
          {t("privacy.lastUpdated")}
        </p>

        <p
          style={{
            ...bodyStyle,
            marginBottom: "24px",
          }}
        >
          {t("privacy.intro")}
        </p>

        <Section title={t("privacy.signedInUsers")}>
          <Paragraph textKey="privacy.signedInDescription" />
          <ul style={listStyle}>
            <li className="rs-privacy-list-item" style={listItemStyle}>
              {t("privacy.signedInItem1")}
            </li>
            <li className="rs-privacy-list-item" style={listItemStyle}>
              {t("privacy.signedInItem2")}
            </li>
            <li className="rs-privacy-list-item" style={listItemStyle}>
              {t("privacy.signedInItem3")}
            </li>
            <li className="rs-privacy-list-item" style={listItemStyle}>
              {t("privacy.signedInItem4")}
            </li>
            <li className="rs-privacy-list-item" style={listItemStyle}>
              {t("privacy.signedInItem5")}
            </li>
            <li className="rs-privacy-list-item" style={listItemStyle}>
              {t("privacy.signedInItem6")}
            </li>
            <li className="rs-privacy-list-item" style={listItemStyle}>
              {t("privacy.signedInItem7")}
            </li>
          </ul>
          <Paragraph textKey="privacy.signedInNote" />
        </Section>

        <Section title={t("privacy.guestUsers")}>
          <Paragraph textKey="privacy.guestIntro" />
          <Paragraph textKey="privacy.guestMemory" />
          <Paragraph textKey="privacy.guestSaved" />
          <Paragraph textKey="privacy.guestLocal" />
          <Paragraph textKey="privacy.guestSignIn" />
        </Section>

        <Section title={t("privacy.howWeUse")}>
          <Paragraph textKey="privacy.howWeUseDescription" />
        </Section>

        <Section title={t("privacy.notCollected")}>
          <Paragraph textKey="privacy.notCollectedDescription" />
        </Section>

        <Section title={t("privacy.cookies")}>
          <Paragraph textKey="privacy.cookiesDescription" />
        </Section>

        <Section title={t("privacy.thirdParty")}>
          <Paragraph textKey="privacy.thirdPartyIntro" />
          <ul style={listStyle}>
            <li className="rs-privacy-list-item" style={listItemStyle}>
              {t("privacy.thirdPartyGoogleAuth")}
            </li>
            <li className="rs-privacy-list-item" style={listItemStyle}>
              {t("privacy.thirdPartyVercel")}
            </li>
            <li className="rs-privacy-list-item" style={listItemStyle}>
              {t("privacy.thirdPartyRender")}
            </li>
            <li className="rs-privacy-list-item" style={listItemStyle}>
              {t("privacy.thirdPartyNeon")}
            </li>
            <li className="rs-privacy-list-item" style={listItemStyle}>
              {t("privacy.thirdPartyForms")}
            </li>
          </ul>
          <Paragraph textKey="privacy.thirdPartyNote" />
        </Section>

        <Section title={t("privacy.dataSharing")}>
          <Paragraph textKey="privacy.dataSharingDescription" />
          <Paragraph textKey="privacy.dataSharingNote" />
        </Section>

        <Section title={t("privacy.security")}>
          <Paragraph textKey="privacy.securityDescription" />
        </Section>

        <Section title={t("privacy.retention")}>
          <Paragraph textKey="privacy.retentionDescription" />
        </Section>

        <Section title={t("privacy.accountDeletion")}>
          <Paragraph textKey="privacy.accountDeletionDescription" />
        </Section>

        <Section title={t("privacy.userChoices")}>
          <Paragraph textKey="privacy.userChoicesDescription" />
        </Section>

        <Section title={t("privacy.childrenUnder13")}>
          <Paragraph textKey="privacy.childrenUnder13Description" />
        </Section>

        <Section title={t("privacy.schoolRecords")}>
          <Paragraph textKey="privacy.schoolRecordsDescription" />
        </Section>

        <Section title={t("privacy.changes")}>
          <Paragraph textKey="privacy.changesDescription" />
        </Section>

        <Section title={t("privacy.contact")}>
          <Paragraph textKey="privacy.contactDescription" />
        </Section>
      </ResponsivePage>
    </>
  );
}
