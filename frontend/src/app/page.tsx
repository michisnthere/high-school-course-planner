import { getCourses } from "@/lib/api";
import { StatCard } from "@/components/dashboard/StatCard";

export default async function Home() {
  const courses = await getCourses();

  return (
    <main
      style={{
        padding: "32px",
        fontFamily: "system-ui, sans-serif",
      }}
    >
      <h1
        style={{
          fontSize: "32px",
          fontWeight: 700,
          marginBottom: "8px",
        }}
      >
        Dashboard
      </h1>

      <p
        style={{
          color: "#6b7280",
          marginBottom: "32px",
        }}
      >
        Welcome to your High School Course Planner
      </p>

      <div
        style={{
          display: "flex",
          gap: "16px",
          flexWrap: "wrap",
        }}
      >
        <StatCard
          label="Total Courses"
          value={courses.length}
        />

        <StatCard
          label="Departments"
          value="22"
        />

        <StatCard
          label="Requirements"
          value="52"
        />
      </div>
    </main>
  );
}