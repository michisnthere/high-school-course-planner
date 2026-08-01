import { getCourses } from "@/lib/api";
import { SavedCoursesContent } from "@/components/catalog/SavedCoursesContent";
import type { Course } from "@/types/course";
import { breakpoints } from "@/lib/responsive";

export const dynamic = "force-dynamic";

export default async function SavedCoursesPage() {
  const courses: Course[] = await getCourses();

  return (
    <>
      <style>{`
        @media (max-width: ${breakpoints.mobile - 1}px) {
          .rs-saved-page {
            padding: 16px !important;
            padding-top: 0 !important;
            padding-bottom: calc(16px + var(--safe-area-bottom)) !important;
            padding-left: calc(16px + var(--safe-area-left)) !important;
            padding-right: calc(16px + var(--safe-area-right)) !important;
          }
          .rs-saved-page h1 {
            margin-top: 8px !important;
            margin-bottom: 24px !important;
          }
          .rs-saved-grid {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
      <SavedCoursesContent courses={courses} />
    </>
  );
}
