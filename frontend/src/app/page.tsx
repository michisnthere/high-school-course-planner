import { getCourses } from "@/lib/api";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { DashboardActions } from "@/components/dashboard/DashboardActions";
import { ExploreCoursesSection } from "@/components/dashboard/ExploreCoursesSection";
import { AcademicSnapshot } from "@/components/dashboard/AcademicSnapshot";
import type { Course } from "@/types/course";

export const dynamic = "force-dynamic";

export default async function Home() {
  const courses: Course[] = await getCourses();

  return (
    <div
      style={{
        padding: "32px",
        fontFamily:
          '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
      }}
    >
      <DashboardHeader />

      <DashboardActions />

      <div
        style={{
          display: "flex",
          gap: "24px",
          flexWrap: "wrap",
          marginBottom: "32px",
        }}
      >
        <ExploreCoursesSection courses={courses} />
        <AcademicSnapshot />
      </div>

    </div>
  );
}
