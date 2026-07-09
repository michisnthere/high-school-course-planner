import { getCourses } from "@/lib/api";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { DashboardActions } from "@/components/dashboard/DashboardActions";
import { GraduationRequirementsSummary } from "@/components/dashboard/GraduationRequirementsSummary";
import { AcademicSnapshot } from "@/components/dashboard/AcademicSnapshot";
import { RecentCourses } from "@/components/dashboard/RecentCourses";
import type { Course } from "@/types/course";

export const dynamic = "force-dynamic";

export default async function Home() {
  const courses: Course[] = await getCourses();

  const requirementCounts = new Map<string, number>();
  for (const course of courses) {
    for (const requirement of course.fulfillsRequirements ?? []) {
      requirementCounts.set(
        requirement,
        (requirementCounts.get(requirement) || 0) + 1
      );
    }
  }

  const requirements = Array.from(requirementCounts.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([name, count]) => ({ name, count }));

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
        <GraduationRequirementsSummary requirements={requirements} />
        <AcademicSnapshot />
      </div>

      <RecentCourses courses={courses} />
    </div>
  );
}
