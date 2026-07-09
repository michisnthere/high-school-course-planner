import { getCourses } from "@/lib/api";
import { CatalogHeader } from "@/components/catalog/CatalogHeader";
import { CatalogContent } from "@/components/catalog/CatalogContent";
import type { Course } from "@/types/course";

export const dynamic = "force-dynamic";

export default async function CatalogPage() {
  const courses: Course[] = await getCourses();

  return (
    <div
      style={{
        padding: "32px",
        fontFamily:
          '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
      }}
    >
      <CatalogHeader />
      <CatalogContent courses={courses} />
    </div>
  );
}
