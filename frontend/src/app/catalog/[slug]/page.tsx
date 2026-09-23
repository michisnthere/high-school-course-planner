import Link from "next/link";
import { getCourses } from "@/lib/api";
import { normalizeTitle } from "@/lib/normalize";
import { CourseDetailHeader } from "@/components/catalog/CourseDetailHeader";
import { CourseDescription } from "@/components/catalog/CourseDescription";
import { CourseOfferings } from "@/components/catalog/CourseOfferings";
import { CoursePrerequisites } from "@/components/catalog/CoursePrerequisites";
import { CourseRequiredFor } from "@/components/catalog/CourseRequiredFor";
import { CourseAttributes } from "@/components/catalog/CourseAttributes";
import { ResponsivePage } from "@/components/responsive/ResponsivePage";
import { breakpoints } from "@/lib/responsive";
import type { Course } from "@/types/course";
import { CatalogNotFound } from "@/components/catalog/CatalogNotFound";

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
  let courses: Course[];
  try {
    courses = await getCourses();
  } catch (err) {
    console.error("Failed to load courses for catalog detail:", err);
    courses = [];
  }
  const course = findCourseBySlug(courses, slug);

  if (!course) {
    return <CatalogNotFound />;
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
          <CourseRequiredFor course={course} allCourses={courses} />
        </div>
        <div className="rs-detail-card">
          <CourseAttributes course={course} />
        </div>
      </ResponsivePage>
    </>
  );
}
