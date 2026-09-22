import Link from "next/link";
import type { CSSProperties, ReactElement } from "react";
import { useTranslation } from "@/context/I18nContext";
import type { SummerCourse } from "@/lib/summerCourse";
import {
  formatSummerCreditType,
  formatSummerCredits,
  formatSummerDates,
  formatSummerGrades,
  formatSummerSessionsRaw,
  formatSummerTimes,
  getSummerCost,
  getSummerPassFail,
  normalizeSummerTitle,
} from "@/lib/summerCatalog";

type SummerCourseDetailPageProps = {
  course: SummerCourse;
  returnUrl?: string;
};

type DetailRowData = {
  label: string;
  value: string;
};

const cardStyle: CSSProperties = {
  padding: "24px",
  backgroundColor: "var(--bg-card)",
  border: "1px solid var(--border-default)",
  borderRadius: "12px",
  marginBottom: "24px",
};

const additionalInfoCardStyle: CSSProperties = {
  padding: "32px 36px",
  backgroundColor: "var(--bg-card)",
  border: "1px solid var(--border-default)",
  borderRadius: "12px",
  marginBottom: "24px",
};

const cardHeadingStyle: CSSProperties = {
  margin: "0 0 16px",
  fontSize: "20px",
  fontWeight: 700,
  color: "var(--text-primary)",
};

const pillStyle: CSSProperties = {
  padding: "6px 12px",
  backgroundColor: "var(--brand-accent-light)",
  borderRadius: "9999px",
  fontSize: "14px",
  fontWeight: 600,
  color: "var(--text-primary)",
};

function DetailRow({ label, value }: DetailRowData): ReactElement {
  return (
    <div
      className="rs-detail-row"
      style={{
        display: "flex",
        flexWrap: "wrap",
        columnGap: "32px",
        rowGap: "10px",
        padding: "18px 0",
        borderTop: "1px solid var(--border-default)",
      }}
    >
      <span
        className="rs-detail-label"
        style={{
          minWidth: "200px",
          fontSize: "14px",
          fontWeight: 700,
          letterSpacing: "0.01em",
          color: "var(--text-primary)",
        }}
      >
        {label}
      </span>
      <span
        className="rs-detail-value"
        style={{
          flex: 1,
          minWidth: "260px",
          fontSize: "16px",
          color: "var(--text-secondary)",
          lineHeight: 1.6,
        }}
      >
        {value}
      </span>
    </div>
  );
}

function SummerCourseDetailHeader({
  course,
  returnUrl,
}: {
  course: SummerCourse;
  returnUrl?: string;
}): ReactElement {
  const { t } = useTranslation();
  const backHref = returnUrl && returnUrl.startsWith("/") ? returnUrl : "/catalog?source=summer";

  let backLabel = t("summerCourseDetail.backToSummerCatalog");
  if (returnUrl === "/") {
    backLabel = t("summerCourseDetail.backToDashboard");
  } else if (returnUrl?.startsWith("/catalog")) {
    backLabel = returnUrl.includes("source=summer") ? t("summerCourseDetail.backToSummerCatalog") : t("summerCourseDetail.backToCatalog");
  } else if (returnUrl?.startsWith("/requirements")) {
    backLabel = t("summerCourseDetail.backToRequirements");
  } else if (returnUrl) {
    backLabel = t("summerCourseDetail.back");
  }

  const division = course.division ?? t("summerCourseDetail.summerSchool");

  return (
    <div style={{ marginBottom: "32px" }}>
      <Link
        href={backHref}
        style={{
          display: "inline-block",
          marginBottom: "16px",
          fontSize: "14px",
          color: "var(--text-muted)",
          textDecoration: "none",
          fontWeight: 500,
        }}
      >
        {backLabel}
      </Link>

      <h1
        style={{
          margin: "0 0 12px",
          fontSize: "32px",
          fontWeight: 700,
          color: "var(--text-primary)",
          lineHeight: 1.2,
        }}
      >
        {normalizeSummerTitle(course.title)}
      </h1>

      <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", alignItems: "center" }}>
        <span style={pillStyle}>{division}</span>
        <span style={pillStyle}>{formatSummerCreditType(course)}</span>
      </div>
    </div>
  );
}

function additionalInformationRows(course: SummerCourse, t: (key: string, params?: Record<string, string>) => string): DetailRowData[] {
  const cost = getSummerCost(course);
  const passFail = getSummerPassFail(course);
  const sessions = formatSummerSessionsRaw(course);
  const duration = course.durationNote || (course.duration === "full_summer" ? t("summerCourseDetail.fullSummer") : null);
  const dates = formatSummerDates(course);
  const times = formatSummerTimes(course);
  const openTo = formatSummerGrades(course);
  const prereqs = course.prerequisites ?? [];
  const coreqs = course.corequisites ?? [];
  const requirements = course.fulfillsRequirements ?? [];

  const rows: Array<DetailRowData | null> = [
    course.courseCode ? { label: t("summerCourseDetail.courseCode"), value: course.courseCode } : null,
    sessions ? { label: t("summerCourseDetail.session"), value: sessions } : null,
    duration ? { label: t("summerCourseDetail.duration"), value: duration } : null,
    dates ? { label: t("summerCourseDetail.dates"), value: dates } : null,
    times ? { label: t("summerCourseDetail.time"), value: times } : null,
    openTo ? { label: t("summerCourseDetail.openTo"), value: openTo } : null,
    { label: t("summerCourseDetail.credit"), value: formatSummerCredits(course) },
    passFail ? { label: t("summerCourseDetail.grading"), value: t("summerCourseDetail.passFail") } : null,
    cost ? { label: t("summerCourseDetail.cost"), value: cost } : null,
    prereqs.length > 0
      ? { label: t("summerCourseDetail.prerequisite"), value: prereqs.join("; ") }
      : { label: t("summerCourseDetail.prerequisite"), value: t("coursePrerequisites.none") },
    coreqs.length > 0 ? { label: t("summerCourseDetail.corequisite"), value: coreqs.join("; ") } : null,
    requirements.length > 0 ? { label: t("summerCourseDetail.graduationRequirement"), value: requirements.join(", ") } : null,
  ];

  return rows.filter((row): row is DetailRowData => row !== null);
}

export function SummerCourseDetailPage({
  course,
  returnUrl,
}: SummerCourseDetailPageProps): ReactElement {
  const { t } = useTranslation();
  const notes = (course.notes ?? []).filter(
    (note): note is string => typeof note === "string" && note.trim().length > 0
  );
  const additionalInformation = additionalInformationRows(course, t);

  return (
    <div
      className="rs-summer-detail"
      style={{
        display: "flex",
        flexDirection: "column",
        maxWidth: "880px",
        width: "100%",
      }}
    >
      <div className="rs-detail-header">
        <SummerCourseDetailHeader course={course} returnUrl={returnUrl} />
      </div>

      <div style={cardStyle}>
        <h2 style={cardHeadingStyle}>{t("summerCourseDetail.description")}</h2>
        {course.description ? (
          <p
            style={{
              margin: "0 0 16px",
              fontSize: "16px",
              color: "var(--text-secondary)",
              lineHeight: 1.6,
            }}
          >
            {course.description}
          </p>
        ) : (
          <p style={{ margin: 0, fontSize: "15px", color: "var(--text-muted)" }}>
            {t("summerCourseDetail.noDescription")}
          </p>
        )}
        {notes.length > 0 && (
          <div>
            <h3
              style={{
                margin: "0 0 10px",
                fontSize: "16px",
                fontWeight: 700,
                color: "var(--text-primary)",
              }}
            >
              {t("summerCourseDetail.notes")}
            </h3>
            <ul
              style={{
                margin: 0,
                paddingLeft: "20px",
                fontSize: "15px",
                color: "var(--text-secondary)",
                lineHeight: 1.6,
              }}
            >
              {notes.map((note, index) => (
                <li key={`${note}-${index}`}>{note}</li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {additionalInformation.length > 0 && (
        <div className="rs-additional-info" style={additionalInfoCardStyle}>
          <h2 style={cardHeadingStyle}>{t("summerCourseDetail.additionalInfo")}</h2>
          <div className="rs-detail-rows">
            {additionalInformation.map((row) => (
              <DetailRow key={row.label} label={row.label} value={row.value} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}