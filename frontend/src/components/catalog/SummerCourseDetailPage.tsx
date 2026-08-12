import Link from "next/link";
import type { CSSProperties, ReactElement } from "react";
import type { SummerCourse } from "@/lib/summerCourse";
import {
  formatSummerCreditType,
  formatSummerCredits,
  formatSummerOpenTo,
  formatSummerSessionsRaw,
  getSummerCost,
  getSummerDurationLabel,
  getSummerPassFail,
  getSummerScheduleNotes,
  normalizeSummerTitle,
} from "@/lib/summerCatalog";

type SummerCourseDetailPageProps = {
  course: SummerCourse;
  returnUrl?: string;
};

const cardStyle: CSSProperties = {
  padding: "24px",
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

function DetailRow({ label, value }: { label: string; value: string }): ReactElement {
  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        gap: "8px 24px",
        padding: "10px 0",
        borderTop: value ? "1px solid var(--border-default)" : "none",
      }}
    >
      <span
        style={{
          minWidth: "180px",
          fontSize: "14px",
          fontWeight: 700,
          color: "var(--text-primary)",
        }}
      >
        {label}
      </span>
      <span style={{ fontSize: "15px", color: "var(--text-secondary)", lineHeight: 1.5 }}>{value}</span>
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
  const backHref = returnUrl && returnUrl.startsWith("/") ? returnUrl : "/catalog?source=summer";

  let backLabel = "← Back to Summer Catalog";
  if (returnUrl === "/") {
    backLabel = "← Back to Dashboard";
  } else if (returnUrl?.startsWith("/catalog")) {
    backLabel = returnUrl.includes("source=summer") ? "← Back to Summer Catalog" : "← Back to Catalog";
  } else if (returnUrl?.startsWith("/requirements")) {
    backLabel = "← Back to Graduation Requirements";
  } else if (returnUrl) {
    backLabel = "← Back";
  }

  const division = course.division ?? "Summer School";
  const passFail = getSummerPassFail(course);

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
        {passFail && <span style={pillStyle}>Pass/Fail</span>}
      </div>

      {course.regularCourse && (
        <p
          style={{
            margin: "12px 0 0",
            fontSize: "13px",
            color: "var(--text-secondary)",
            backgroundColor: "var(--bg-input)",
            display: "inline-block",
            padding: "6px 12px",
            borderRadius: "8px",
          }}
        >
          Matches the regular course &quot;{course.regularCourse.title}&quot;
        </p>
      )}
    </div>
  );
}

export function SummerCourseDetailPage({
  course,
  returnUrl,
}: SummerCourseDetailPageProps): ReactElement {
  const notes = (course.notes ?? []).filter(
    (note): note is string => typeof note === "string" && note.trim().length > 0
  );
  const scheduleNotes = getSummerScheduleNotes(course);
  const generalNotes = notes.filter((note) => !scheduleNotes.includes(note));
  const cost = getSummerCost(course);
  const passFail = getSummerPassFail(course);
  const prereqs = course.prerequisites ?? [];
  const coreqs = course.corequisites ?? [];
  const requirements = course.fulfillsRequirements ?? [];

  const hasEnrollment = prereqs.length > 0 || coreqs.length > 0;

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
        <h2 style={cardHeadingStyle}>Description</h2>
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
            No description available.
          </p>
        )}
        {generalNotes.length > 0 && (
          <div>
            <h3
              style={{
                margin: "0 0 10px",
                fontSize: "16px",
                fontWeight: 700,
                color: "var(--text-primary)",
              }}
            >
              Notes
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
              {generalNotes.map((note, index) => (
                <li key={`${note}-${index}`}>{note}</li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <div style={cardStyle}>
        <h2 style={cardHeadingStyle}>Course Details</h2>
        {course.courseCode && <DetailRow label="Course Code" value={course.courseCode} />}
        <DetailRow label="Credit" value={formatSummerCredits(course)} />
        <DetailRow label="Duration" value={getSummerDurationLabel(course)} />
        {(() => {
          const sessions = formatSummerSessionsRaw(course);
          return sessions ? <DetailRow label="Session" value={sessions} /> : null;
        })()}
        {(() => {
          const openTo = formatSummerOpenTo(course);
          return openTo ? <DetailRow label="Open to Grades" value={`Grade ${openTo}`} /> : null;
        })()}
        {cost && <DetailRow label="Cost" value={cost} />}
        {passFail && <DetailRow label="Grading" value="Pass/Fail" />}
        {requirements.length > 0 && (
          <DetailRow label="Graduation Requirement" value={requirements.join(", ")} />
        )}
      </div>

      {hasEnrollment && (
        <div style={cardStyle}>
          <h2 style={cardHeadingStyle}>Enrollment</h2>
          {prereqs.length > 0 && <DetailRow label="Prerequisites" value={prereqs.join("; ")} />}
          {coreqs.length > 0 && <DetailRow label="Corequisites" value={coreqs.join("; ")} />}
        </div>
      )}

      {scheduleNotes.length > 0 && (
        <div style={cardStyle}>
          <h2 style={cardHeadingStyle}>Schedule</h2>
          <ul
            style={{
              margin: 0,
              paddingLeft: "20px",
              fontSize: "15px",
              color: "var(--text-secondary)",
              lineHeight: 1.6,
            }}
          >
            {scheduleNotes.map((note, index) => (
              <li key={`${note}-${index}`}>{note}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}