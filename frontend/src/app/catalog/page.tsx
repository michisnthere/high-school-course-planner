import { Suspense } from "react";
import { getCourses } from "@/lib/api";
import { CatalogHeader } from "@/components/catalog/CatalogHeader";
import { CatalogContent } from "@/components/catalog/CatalogContent";
import { ResponsivePage } from "@/components/responsive/ResponsivePage";
import { breakpoints } from "@/lib/responsive";
import type { Course } from "@/types/course";

export const dynamic = "force-dynamic";

export default async function CatalogPage() {
  const courses: Course[] = await getCourses();

  return (
    <>
      <style>{`
        @media (max-width: ${breakpoints.mobile - 1}px) {
          .rs-catalog-header h1 {
            font-size: 1.5rem !important;
          }
          .rs-catalog-header p {
            font-size: 0.875rem !important;
          }
          .rs-catalog-header > a {
            display: none !important;
          }
          .rs-catalog-search {
            position: sticky;
            top: calc(56px + var(--safe-area-top, 0px));
            z-index: 50;
            background: var(--bg-page);
            padding: 12px 0;
            margin: 0 !important;
          }
          .rs-catalog-search input {
            max-width: none !important;
          }
          .rs-catalog-filters {
            padding: 16px !important;
            margin-bottom: 16px !important;
          }
          .rs-catalog-filters > div {
            gap: 16px !important;
          }
          .rs-catalog-divisions > div:last-child {
            display: flex;
            overflow-x: auto;
            flex-wrap: nowrap;
            gap: 8px;
            -webkit-overflow-scrolling: touch;
            scrollbar-width: none;
          }
          .rs-catalog-divisions > div:last-child::-webkit-scrollbar {
            display: none;
          }
          .rs-catalog-divisions > div:last-child > button {
            flex-shrink: 0;
          }
          .rs-catalog-grid {
            gap: 16px !important;
          }
          .rs-catalog-card {
            padding: 16px !important;
          }
          .rs-catalog-card h3 {
            font-size: 16px !important;
            margin-bottom: 8px !important;
          }
          .rs-catalog-card a:first-child {
            min-height: 44px;
          }
          .rs-catalog-card button {
            min-height: 44px;
          }
        }
      `}</style>
      <ResponsivePage>
        <div className="rs-catalog-header">
          <CatalogHeader />
        </div>
        <Suspense fallback={null}>
          <CatalogContent courses={courses} />
        </Suspense>
      </ResponsivePage>
    </>
  );
}
