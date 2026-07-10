"use client";

import React, { useEffect, useState } from "react";
import type { Course } from "@/types/course";
import { CourseCard } from "./CourseCard";

type CourseGridProps = {
  courses: Course[];
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

export function CourseGrid({ courses }: CourseGridProps): React.ReactElement {
  const columns = useColumnCount();

  return (
    <div
      style={{
        display: "grid",
        gap: "24px",
        width: "100%",
        gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
      }}
    >
      {courses.map((course, index) => (
        <CourseCard key={`${course.title}-${index}`} course={course} />
      ))}
    </div>
  );
}
