import { getCourses } from "@/lib/api";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { StatCard } from "@/components/dashboard/StatCard";
import { QuickActions } from "@/components/dashboard/QuickActions";
import { RecentCourses } from "@/components/dashboard/RecentCourses";
import type { Course } from "@/types/course";import { RequirementProgress } from "@/components/dashboard/RequirementProgress";



export default async function Home() {
  const courses: Course[] = await getCourses();

  const departments = new Set(courses.map((course) => course.department).filter(Boolean));

  return (
    <div
      style={{
        padding: "32px",
        fontFamily:
          '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
      }}
    >
      <DashboardHeader />

      <div
        style={{
          display: "flex",
          gap: "16px",
          flexWrap: "wrap",
          marginBottom: "32px",
        }}
      >
        <StatCard label="Total Courses" value={courses.length} />
        <StatCard label="Departments" value={departments.size} />
        <StatCard label="Graduation Requirements" value={52} />
      </div>

      <div
        style={{
          display: "flex",
          gap: "24px",
          flexWrap: "wrap",
          marginBottom: "32px",
        }}
      >
        <RecentCourses courses={courses} />
        <RequirementProgress />
      </div>

      <QuickActions />
    </div>
  );
}
