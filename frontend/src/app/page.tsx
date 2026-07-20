import { getCourses } from "@/lib/api";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { DashboardActions } from "@/components/dashboard/DashboardActions";
import { ExploreCoursesSection } from "@/components/dashboard/ExploreCoursesSection";
import { AcademicSnapshot } from "@/components/dashboard/AcademicSnapshot";
import { GuestUpgradePrompt } from "@/components/auth/GuestUpgradePrompt";
import { ResponsivePage } from "@/components/responsive/ResponsivePage";
import { breakpoints } from "@/lib/responsive";
import type { Course } from "@/types/course";

export const dynamic = "force-dynamic";

export default async function Home() {
  const courses: Course[] = await getCourses();

  return (
    <>
      <style>{`
        @media (max-width: ${breakpoints.mobile - 1}px) {
          .rs-dash-header h1 {
            font-size: 1.5rem !important;
          }
          .rs-dash-header p {
            font-size: 0.875rem !important;
          }
          .rs-dash-actions > div {
            flex-direction: column !important;
          }
          .rs-dash-actions a {
            flex: none !important;
            min-width: 100% !important;
          }
          .rs-dash-sections {
            flex-direction: column !important;
          }
        }
      `}</style>
      <ResponsivePage>
        <GuestUpgradePrompt />

        <div
          style={{
            padding: "16px 20px",
            marginBottom: "24px",
            backgroundColor: "#FCF5DF",
            border: "1px solid #ECBA2B",
            borderRadius: "12px",
            fontSize: "14px",
            color: "#111827",
            lineHeight: 1.5,
          }}
        >
          <strong style={{ color: "#ECBA2B" }}>Note:</strong> This is a planning tool and is not
          affiliated with or endorsed by the school district. Course offerings, graduation requirements,
          and all other information may not reflect the most current data. Always consult your school
          counselor or the official course catalog for authoritative information.
        </div>

        <div className="rs-dash-header">
          <DashboardHeader />
        </div>

        <div className="rs-dash-actions">
          <DashboardActions />
        </div>

        <div
          className="rs-dash-sections"
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
      </ResponsivePage>
    </>
  );
}
