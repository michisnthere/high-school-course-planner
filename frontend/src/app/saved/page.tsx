import { getCourses } from "@/lib/api";
import { SavedCoursesContent } from "@/components/catalog/SavedCoursesContent";
import type { Course } from "@/types/course";

export const dynamic = "force-dynamic";

export default async function SavedCoursesPage() {
  const courses: Course[] = await getCourses();

  return (
    <div
      style={{
        padding: "32px",
        fontFamily:
          '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
      }}
    >
      <h1
        style={{
          margin: "0 0 8px",
          fontSize: "32px",
          fontWeight: 700,
          color: "#ffffff",
          lineHeight: 1.2,
        }}
      >
        Saved Courses
      </h1>
      <p
        style={{
          margin: "0 0 24px",
          fontSize: "16px",
          color: "#d1d5db",
        }}
      >
        Courses you have saved for later.
      </p>
      <SavedCoursesContent courses={courses} />
    </div>
  );
}
