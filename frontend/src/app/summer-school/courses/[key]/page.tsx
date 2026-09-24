import { getSummerCourses } from "@/lib/summerCourse";
import { findSummerCourseBySlug } from "@/lib/summerCatalog";
import { SummerCourseDetailPage } from "@/components/catalog/SummerCourseDetailPage";
import { SummerNotFound } from "@/components/catalog/SummerNotFound";
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
    return <SummerNotFound />;
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