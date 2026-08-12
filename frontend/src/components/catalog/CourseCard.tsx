"use client";

import React, { useCallback } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import type { Course } from "@/types/course";
import { getCourseSlug } from "@/lib/normalize";
import { formatCreditType } from "@/lib/catalog";
import { SaveCourseButton } from "./SaveCourseButton";

type CourseCardProps = {
  course: Course;
  href?: string | null;
  showSaveButton?: boolean;
};

function truncateDescription(text: string | null | undefined, maxLength = 150): string {
  if (!text) return "";
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength)}...`;
}

const CourseCardInner = React.memo(function CourseCardInner({
  course,
  href,
  showSaveButton = true,
}: CourseCardProps): React.ReactElement {
  const searchParams = useSearchParams();
  const creditType = course.options?.[0]?.creditType ?? null;
  const description = truncateDescription(course.description);
  const slug = getCourseSlug(course);

  const filterQuery = searchParams.toString();
  const returnParam = filterQuery
    ? `?return=${encodeURIComponent("/catalog?" + filterQuery)}`
    : "";
  const courseHref = href === undefined ? `/catalog/${slug}${returnParam}` : href;

  const handleMouseEnter = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    e.currentTarget.style.borderColor = "var(--border-light)";
  }, []);

  const handleMouseLeave = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    e.currentTarget.style.borderColor = "var(--border-default)";
  }, []);

  return (
    <div
      className="rs-catalog-card"
      style={{
        backgroundColor: "var(--bg-card)",
        border: "1px solid var(--border-default)",
        borderRadius: "12px",
        padding: "20px",
        transition: "border-color 0.2s ease",
      }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {courseHref ? (
        <Link
          href={courseHref}
          style={{
            display: "block",
            textDecoration: "none",
            color: "inherit",
            marginBottom: "12px",
          }}
        >
          <CourseCardSummary course={course} creditType={creditType} description={description} />
        </Link>
      ) : (
        <div
        style={{
          display: "block",
          textDecoration: "none",
          color: "inherit",
          marginBottom: "12px",
        }}
      >
          <CourseCardSummary course={course} creditType={creditType} description={description} />
        </div>
      )}

      {showSaveButton && <SaveCourseButton course={course} />}
    </div>
  );
});

function CourseCardSummary({
  course,
  creditType,
  description,
}: {
  course: Course;
  creditType: string | null;
  description: string;
}): React.ReactElement {
  return (
    <>
      <h3
        style={{
          margin: "0 0 10px",
          fontSize: "18px",
          fontWeight: 700,
          color: "var(--text-primary)",
          lineHeight: 1.3,
        }}
      >
        {course.title}
      </h3>

      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "8px",
          marginBottom: "12px",
          fontSize: "14px",
          color: "var(--text-muted)",
        }}
      >
        {course.department?.name && (
          <span
            style={{
              padding: "4px 10px",
              backgroundColor: "var(--bg-input)",
              borderRadius: "9999px",
              fontWeight: 600,
            }}
          >
            {course.department.name}
          </span>
        )}

        {creditType && (
          <span
            style={{
              padding: "4px 10px",
              backgroundColor: "var(--bg-input)",
              borderRadius: "9999px",
              fontWeight: 600,
            }}
          >
            {formatCreditType(creditType)}
          </span>
        )}
      </div>

      {description && (
        <p
          style={{
            margin: 0,
            fontSize: "15px",
            color: "var(--text-secondary)",
            lineHeight: 1.5,
          }}
        >
          {description}
        </p>
      )}
    </>
  );
}

export { CourseCardInner as CourseCard };
