import Link from "next/link";
import { getSummerCourses } from "@/lib/summerCourse";
import { findSummerCourseBySlug } from "@/lib/summerCatalog";
import { SummerCourseDetailPage } from "@/components/catalog/SummerCourseDetailPage";
import { ResponsivePage } from "@/components/responsive/ResponsivePage";
import { breakpoints } from "@/lib/responsive";

type SummerCourseDetailRouteProps = {
  params: Promise<{ key: string }>;
  searchParams: Promise<{ return?: string }>;
};

export const dynamic = "force-dynamic";

export default async function SummerCourseDetailRoute({
  params,
  searchParams,
}: SummerCourseDetailRouteProps) {
  const { key } = await params;
  const { return: returnUrl } = await searchParams;
  const courses = await getSummerCourses();
  const course = findSummerCourseBySlug(courses, key);

  if (!course) {
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
            Course not found
          </h1>
          <p
            style={{
              margin: "0 0 24px",
              fontSize: "16px",
              color: "#6b7280",
            }}
          >
            We could not find a Summer School course matching that link. It may have been removed or
            renamed.
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
            Back to Summer Catalog
          </Link>
        </div>
      </div>
    );
  }

  return (
    <>
      <style>{`
        .rs-detail-rows {
          margin-top: 4px;
        }
        .rs-detail-row {
          display: flex;
          flex-wrap: wrap;
        }
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
          .rs-detail-header a {
            min-height: 44px;
          }
          .rs-summer-detail > div:not(.rs-detail-header) {
            padding: 16px !important;
            margin-bottom: 16px !important;
          }
          .rs-summer-detail > .rs-additional-info {
            padding: 20px 18px !important;
          }
          .rs-detail-row {
            flex-direction: column;
            row-gap: 6px;
            padding: 16px 0;
          }
          .rs-detail-label,
          .rs-detail-value {
            min-width: 0 !important;
          }
          .rs-summer-detail h2 {
            font-size: 18px !important;
            margin-bottom: 12px !important;
          }
        }
      `}</style>
      <ResponsivePage>
        <SummerCourseDetailPage course={course} returnUrl={returnUrl} />
      </ResponsivePage>
    </>
  );
}