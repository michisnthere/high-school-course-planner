import { getCourses } from "@/lib/api";
import { CatalogHeader } from "@/components/catalog/CatalogHeader";
import { CourseSearch } from "@/components/catalog/CourseSearch";
import { CourseFilters } from "@/components/catalog/CourseFilters";
import { EmptyState } from "@/components/catalog/EmptyState";
import { CourseGrid } from "@/components/catalog/CourseGrid";
import type { Course } from "@/types/course";

export default async function CatalogPage() {
  const courses: Course[] = await getCourses();
  const displayCourses = courses.slice(0, 20);

  return (
    <div
      style={{
        padding: "32px",
        fontFamily:
          '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
      }}
    >
      <CatalogHeader />
      <CourseSearch />
      <CourseFilters />

      {displayCourses.length === 0 ? (
        <EmptyState />
      ) : (
        <CourseGrid courses={displayCourses} />
      )}
    </div>
  );
}
