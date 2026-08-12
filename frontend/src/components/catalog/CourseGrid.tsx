"use client";

import React, { useEffect, useState } from "react";
import type { Course } from "@/types/course";
import { CourseCard } from "./CourseCard";

type CourseGridProps = {
  courses: Course[];
  getCourseHref?: (course: Course) => string | null | undefined;
  showSaveButtons?: boolean;
};

function getColumnCount(width: number): number {
  if (width >= 1280) return 3;
  if (width >= 768) return 2;
  return 1;
}

function useColumnCount(): number {
  const [columns, setColumns] = useState(1);

  useEffect(() => {
    const handleResize = () => setColumns(getColumnCount(window.innerWidth));

    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  return columns;
}

export function CourseGrid({ courses, getCourseHref, showSaveButtons = true }: CourseGridProps): React.ReactElement {
  const columns = useColumnCount();

  return (
    <div
      className="rs-catalog-grid"
      style={{
        display: "grid",
        gap: "24px",
        width: "100%",
        gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
      }}
    >
      {courses.map((course) => (
        <CourseCard
          key={course.id}
          course={course}
          href={getCourseHref ? getCourseHref(course) : undefined}
          showSaveButton={showSaveButtons}
        />
      ))}
    </div>
  );
}
