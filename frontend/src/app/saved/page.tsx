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
          .rs-saved-grid {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
      <div className="rs-saved-page" style={{ padding: "32px" }}>
        <h1
          style={{
            margin: "0 0 8px",
            fontSize: "32px",
            fontWeight: 700,
            color: "var(--text-primary)",
            lineHeight: 1.2,
          }}
        >
          Saved Courses
        </h1>
        <p
          style={{
            margin: "0 0 24px",
            fontSize: "16px",
            color: "var(--text-secondary)",
          }}
        >
          Courses you have saved for later.
        </p>
        <SavedCoursesContent courses={courses} />
      </div>
    </>
  );
}
