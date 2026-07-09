import { getCourses } from "@/lib/api";

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
          marginBottom: "24px",
        }}
      >
        Course Catalog
      </h1>

      <p style={{ marginBottom: "24px" }}>
        Total courses: {courses.length}
      </p>

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "16px",
        }}
      >
        {courses.map((course: any) => (
          <div
            key={course.id}
            style={{
              border: "1px solid #e5e7eb",
              borderRadius: "12px",
              padding: "16px",
            }}
          >
            <h2
              style={{
                fontSize: "20px",
                fontWeight: 600,
              }}
            >
              {course.title}
            </h2>

            <p>
              Department: {course.department?.name}
            </p>

            <p>
              Options: {course.options?.length ?? 0}
            </p>
          </div>
        ))}
      </div>
    </main>
  );
}