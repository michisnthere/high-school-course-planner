"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { getCourses } from "@/lib/api";
import {
  addCompletedCourse,
  getCompletedCourses,
  removeCompletedCourse,
  type CompletedCourse,
} from "@/lib/completedCourses";
import { getCourseSlug } from "@/lib/normalize";
import type { Course } from "@/types/course";

const YEAR_LABELS: Record<number, string> = {
  9: "Freshman",
  10: "Sophomore",
  11: "Junior",
  12: "Senior",
};

export default function CompletedCoursesPage(): React.ReactElement {
  return (
    <ProtectedRoute>
      <CompletedCoursesContent />
    </ProtectedRoute>
  );
}

function getCourseCredits(course: Course): number | null {
  const option = course.options?.[0];
  if (option?.credits != null) {
    return option.credits;
  }
  const offering = option?.offerings?.[0];
  if (offering?.credits != null) {
    return offering.credits;
  }
  return null;
}

function CompletedCoursesContent(): React.ReactElement {
  const [completed, setCompleted] = useState<CompletedCourse[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedCourseId, setSelectedCourseId] = useState("");
  const [gradeLevel, setGradeLevel] = useState("9");
  const [year, setYear] = useState("");
  const [credits, setCredits] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([getCompletedCourses(), getCourses()])
      .then(([completedData, coursesData]) => {
        setCompleted(completedData);
        setCourses(coursesData);
      })
      .catch(() => setError("Failed to load data"))
      .finally(() => setLoading(false));
  }, []);

  const selectedCourse = useMemo(
    () => courses.find((course) => course.id === Number(selectedCourseId)),
    [courses, selectedCourseId]
  );

  useEffect(() => {
    if (selectedCourse && credits === "") {
      const defaultCredits = getCourseCredits(selectedCourse);
      if (defaultCredits != null) {
        setCredits(String(defaultCredits));
      }
    }
  }, [selectedCourse, credits]);

  const sortedCompleted = useMemo(
    () =>
      [...completed].sort((a, b) => {
        if (a.yearTaken !== b.yearTaken) return a.yearTaken - b.yearTaken;
        return a.gradeLevelTaken - b.gradeLevelTaken;
      }),
    [completed]
  );

  const handleAdd = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedCourseId || !gradeLevel || !year) return;

    setSaving(true);
    setError(null);

    try {
      const added = await addCompletedCourse({
        courseId: Number(selectedCourseId),
        gradeLevelTaken: Number(gradeLevel),
        yearTaken: Number(year),
        credits: credits ? Number(credits) : undefined,
      });
      setCompleted((prev) => [...prev, added]);
      setSelectedCourseId("");
      setGradeLevel("9");
      setYear("");
      setCredits("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add completed course");
    } finally {
      setSaving(false);
    }
  };

  const handleRemove = async (id: number) => {
    try {
      await removeCompletedCourse(id);
      setCompleted((prev) => prev.filter((item) => item.id !== id));
    } catch {
      setError("Failed to remove completed course");
    }
  };

  if (loading) {
    return (
      <div style={{ padding: "32px", color: "#d1d5db" }}>
        Loading completed courses...
      </div>
    );
  }

  return (
    <div
      style={{
        padding: "32px",
        fontFamily:
          '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
      }}
    >
      <h1
        style={{
          margin: "0 0 8px",
          fontSize: "32px",
          fontWeight: 700,
          color: "#ffffff",
          lineHeight: 1.2,
        }}
      >
        Completed Courses
      </h1>
      <p
        style={{
          margin: "0 0 24px",
          fontSize: "16px",
          color: "#d1d5db",
        }}
      >
        Track courses you have already finished.
      </p>

      <form
        onSubmit={handleAdd}
        style={{
          marginBottom: "32px",
          padding: "20px",
          backgroundColor: "#ffffff",
          border: "1px solid #e5e7eb",
          borderRadius: "12px",
          display: "flex",
          flexWrap: "wrap",
          gap: "16px",
          alignItems: "flex-end",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: "6px", minWidth: "220px", flex: "1 1 0" }}>
          <label htmlFor="course" style={{ fontSize: "14px", fontWeight: 600, color: "#374151" }}>
            Course
          </label>
          <select
            id="course"
            value={selectedCourseId}
            onChange={(e) => setSelectedCourseId(e.target.value)}
            required
            style={{
              padding: "10px 12px",
              fontSize: "15px",
              border: "1px solid #d1d5db",
              borderRadius: "8px",
              backgroundColor: "#ffffff",
              color: "#111827",
            }}
          >
            <option value="">Select a course</option>
            {courses
              .slice()
              .sort((a, b) => a.title.localeCompare(b.title))
              .map((course) => (
                <option key={course.id} value={course.id}>
                  {course.title}
                </option>
              ))}
          </select>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "6px", minWidth: "120px" }}>
          <label htmlFor="grade" style={{ fontSize: "14px", fontWeight: 600, color: "#374151" }}>
            Grade Level
          </label>
          <select
            id="grade"
            value={gradeLevel}
            onChange={(e) => setGradeLevel(e.target.value)}
            required
            style={{
              padding: "10px 12px",
              fontSize: "15px",
              border: "1px solid #d1d5db",
              borderRadius: "8px",
              backgroundColor: "#ffffff",
              color: "#111827",
            }}
          >
            {Object.entries(YEAR_LABELS).map(([grade, label]) => (
              <option key={grade} value={grade}>
                {label} ({grade}th)
              </option>
            ))}
          </select>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "6px", minWidth: "120px" }}>
          <label htmlFor="year" style={{ fontSize: "14px", fontWeight: 600, color: "#374151" }}>
            Year Taken
          </label>
          <input
            id="year"
            type="number"
            value={year}
            onChange={(e) => setYear(e.target.value)}
            required
            placeholder="2026"
            style={{
              padding: "10px 12px",
              fontSize: "15px",
              border: "1px solid #d1d5db",
              borderRadius: "8px",
              backgroundColor: "#ffffff",
              color: "#111827",
            }}
          />
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "6px", minWidth: "100px" }}>
          <label htmlFor="credits" style={{ fontSize: "14px", fontWeight: 600, color: "#374151" }}>
            Credits
          </label>
          <input
            id="credits"
            type="number"
            step="0.5"
            value={credits}
            onChange={(e) => setCredits(e.target.value)}
            placeholder="Auto"
            style={{
              padding: "10px 12px",
              fontSize: "15px",
              border: "1px solid #d1d5db",
              borderRadius: "8px",
              backgroundColor: "#ffffff",
              color: "#111827",
            }}
          />
        </div>

        <button
          type="submit"
          disabled={saving}
          style={{
            padding: "10px 18px",
            fontSize: "15px",
            fontWeight: 600,
            color: "#ffffff",
            backgroundColor: saving ? "#9ca3af" : "#2563eb",
            border: "none",
            borderRadius: "8px",
            cursor: saving ? "not-allowed" : "pointer",
          }}
        >
          {saving ? "Adding..." : "Add Completed Course"}
        </button>
      </form>

      {error && (
        <div
          style={{
            marginBottom: "24px",
            padding: "12px 16px",
            backgroundColor: "rgba(239, 68, 68, 0.12)",
            border: "1px solid rgba(239, 68, 68, 0.3)",
            borderRadius: "8px",
            color: "#fca5a5",
          }}
        >
          {error}
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
        {sortedCompleted.length === 0 ? (
          <p style={{ color: "#9ca3af", fontSize: "15px" }}>
            No completed courses recorded yet.
          </p>
        ) : (
          sortedCompleted.map((item) => {
            const slug = getCourseSlug({
              title: item.course.title,
              normalizedTitle: item.course.normalizedTitle,
            });
            return (
              <div
                key={item.id}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: "16px",
                  padding: "20px",
                  backgroundColor: "#ffffff",
                  border: "1px solid #e5e7eb",
                  borderRadius: "12px",
                }}
              >
                <div>
                  <Link
                    href={`/catalog/${slug}`}
                    style={{
                      fontSize: "18px",
                      fontWeight: 600,
                      color: "#111827",
                      textDecoration: "none",
                    }}
                  >
                    {item.course.title}
                  </Link>
                  <p style={{ margin: "6px 0 0", fontSize: "14px", color: "#6b7280" }}>
                    {YEAR_LABELS[item.gradeLevelTaken]} (Grade {item.gradeLevelTaken}),{" "}
                    {item.yearTaken}
                    {item.credits != null && ` • ${item.credits} credits`}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleRemove(item.id)}
                  style={{
                    padding: "8px 16px",
                    fontSize: "14px",
                    fontWeight: 600,
                    color: "#dc2626",
                    backgroundColor: "#ffffff",
                    border: "1px solid #e5e7eb",
                    borderRadius: "8px",
                    cursor: "pointer",
                  }}
                >
                  Remove
                </button>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
