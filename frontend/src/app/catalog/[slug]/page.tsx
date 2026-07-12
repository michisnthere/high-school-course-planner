import Link from "next/link";
import { getCourses } from "@/lib/api";
import { normalizeTitle } from "@/lib/normalize";
import { CourseDetailHeader } from "@/components/catalog/CourseDetailHeader";
import { CourseDescription } from "@/components/catalog/CourseDescription";
import { CourseOfferings } from "@/components/catalog/CourseOfferings";
import { CoursePrerequisites } from "@/components/catalog/CoursePrerequisites";
import { CourseAttributes } from "@/components/catalog/CourseAttributes";
import type { Course } from "@/types/course";

type CatalogDetailPageProps = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ return?: string }>;
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
  const { return: returnUrl } = await searchParams;
  const courses: Course[] = await getCourses();
  const course = findCourseBySlug(courses, slug);

  if (!course) {
    return (
      <div
        style={{
          padding: "32px",
          fontFamily:
            `-apple-system, BlinkMacSystemFont, Segoe UI, Roboto, Helvetica, Arial, sans-serif`,
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
    <div
      style={{
        padding: "32px",
        fontFamily:
          `-apple-system, BlinkMacSystemFont, Segoe UI, Roboto, Helvetica, Arial, sans-serif`,
      }}
    >
      <CourseDetailHeader course={course} returnUrl={returnUrl} />
      <CourseDescription course={course} />
      <CourseOfferings course={course} />
      <CoursePrerequisites course={course} allCourses={courses} />
      <CourseAttributes course={course} />
    </div>
  );
}
