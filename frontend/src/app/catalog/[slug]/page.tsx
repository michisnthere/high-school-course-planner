import Link from "next/link";
import { getCourses } from "@/lib/api";
import { normalizeTitle } from "@/lib/normalize";
import { CourseDetailHeader } from "@/components/catalog/CourseDetailHeader";
import { CourseDescription } from "@/components/catalog/CourseDescription";
import { CourseOfferings } from "@/components/catalog/CourseOfferings";
import { CoursePrerequisites } from "@/components/catalog/CoursePrerequisites";
import { CourseAttributes } from "@/components/catalog/CourseAttributes";
import { ResponsivePage } from "@/components/responsive/ResponsivePage";
import { breakpoints } from "@/lib/responsive";
import type { Course } from "@/types/course";

type CatalogDetailPageProps = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ return?: string; fromRequirement?: string }>;
};

function findCourseBySlug(courses: Course[], slug: string): Course | undefined {
  return courses.find((course) => {
    if (course.normalizedTitle) {
      return course.normalizedTitle === slug;
    }
    return normalizeTitle(course.title) === slug;
  });
}

export const dynamic = "force-dynamic";

export default async function CatalogDetailPage({ params, searchParams }: CatalogDetailPageProps) {
  const { slug } = await params;
  const { return: returnUrl, fromRequirement } = await searchParams;
  const courses: Course[] = await getCourses();
  const course = findCourseBySlug(courses, slug);

  if (!course) {
    return (
      <div
        style={{
          padding: "32px",

        }}
      >
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
            Course not found
          </h1>
          <p
            style={{
              margin: "0 0 24px",
              fontSize: "16px",
              color: "#6b7280",
            }}
          >
            We could not find a course matching that link. It may have been removed or renamed.
          </p>
          <Link
            href="/catalog"
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
            Back to Catalog
          </Link>
        </div>
      </div>
    );
  }

  return (
    <>
      <style>{`
        @media (max-width: ${breakpoints.mobile - 1}px) {
          .rs-detail-header {
            position: sticky;
            top: calc(56px + var(--safe-area-top, 0px));
            z-index: 40;
            background: var(--bg-page);
            padding: 16px 0 16px;
            margin-bottom: 24px !important;
          }
          .rs-detail-header h1 {
            font-size: 1.5rem !important;
          }
          .rs-detail-header button {
            min-height: 44px;
          }
          .rs-detail-card {
            padding: 16px !important;
            margin-bottom: 16px !important;
          }
          .rs-detail-card h2 {
            font-size: 18px !important;
            margin-bottom: 12px !important;
          }
          .rs-detail-offerings > div > div {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
      <ResponsivePage>
        <div className="rs-detail-header">
          <CourseDetailHeader course={course} returnUrl={returnUrl} fromRequirement={fromRequirement} />
        </div>
        <div className="rs-detail-card">
          <CourseDescription course={course} />
        </div>
        <div className="rs-detail-card rs-detail-offerings">
          <CourseOfferings course={course} />
        </div>
        <div className="rs-detail-card">
          <CoursePrerequisites course={course} allCourses={courses} />
        </div>
        <div className="rs-detail-card">
          <CourseAttributes course={course} />
        </div>
      </ResponsivePage>
    </>
  );
}
