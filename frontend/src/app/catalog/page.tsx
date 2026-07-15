import { Suspense } from "react";
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

      }}
    >
      <CatalogHeader />
      <Suspense fallback={null}>
        <CatalogContent courses={courses} />
      </Suspense>
    </div>
  );
}
