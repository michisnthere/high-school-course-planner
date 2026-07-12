"use client";

import React, { useEffect, useState, useCallback } from "react";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import {
  getCompletedCourses,
  addCompletedCourse,
  updateCompletedCourse,
  removeCompletedCourse,
  LETTER_GRADE_OPTIONS,
  type CompletedCourse,
  type GradeCompleted,
} from "@/lib/completedCourses";
import { CompletedCoursePicker } from "@/components/planner/CompletedCoursePicker";
import { getDivisionColor, getDivisionBackgroundColor } from "@/lib/divisionColors";

export default function CompletedCoursesPage(): React.ReactElement {
  return (
    <ProtectedRoute>
      <CompletedCoursesContent />
    </ProtectedRoute>
  );
}

function CompletedCoursesContent(): React.ReactElement {
  const [courses, setCourses] = useState<CompletedCourse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editValue, setEditValue] = useState<string>("");

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const data = await getCompletedCourses();
      setCourses(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load completed courses");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleAdd = useCallback(
    async ({
      courseId,
      gradeCompleted,
      yearCompleted,
      letterGrade,
    }: {
      courseId: number;
      gradeCompleted: GradeCompleted;
      yearCompleted: string;
      letterGrade: string | null;
    }) => {
      try {
        await addCompletedCourse(courseId, gradeCompleted, yearCompleted, letterGrade);
        setPickerOpen(false);
        await load();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to add completed course");
      }
    },
    [load]
  );

  const handleUpdateGrade = useCallback(
    async (id: number, letterGrade: string | null) => {
      try {
        await updateCompletedCourse(id, { letterGrade });
        setEditingId(null);
        await load();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to update grade");
      }
    },
    [load]
  );

  const handleRemove = useCallback(
    async (id: number) => {
      try {
        await removeCompletedCourse(id);
        await load();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to remove completed course");
      }
    },
    [load]
  );

  return (
    <div
      style={{
        padding: "32px",
        fontFamily: `-apple-system, BlinkMacSystemFont, Segoe UI, Roboto, Helvetica, Arial, sans-serif`,
        minHeight: "calc(100vh - 64px)",
      }}
    >
      <h1
        style={{
          margin: "0 0 28px",
          fontSize: "32px",
          fontWeight: 700,
          color: "#ffffff",
          lineHeight: 1.2,
        }}
      >
        Completed Courses
      </h1>

      {loading ? (
        <p style={{ color: "#d1d5db" }}>Loading completed courses...</p>
      ) : error ? (
        <p style={{ color: "#ef4444" }}>{error}</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
          <button
            type="button"
            onClick={() => setPickerOpen(true)}
            style={{
              alignSelf: "flex-start",
              padding: "12px 20px",
              fontSize: "15px",
              fontWeight: 600,
              color: "#ffffff",
              backgroundColor: "#2563eb",
              border: "none",
              borderRadius: "10px",
              cursor: "pointer",
            }}
          >
            + Add Completed Course
          </button>

          {courses.length === 0 ? (
            <p style={{ color: "#9ca3af" }}>
              No completed courses yet. Add courses you have already finished to improve your
              planner warnings.
            </p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              {courses.map((cc) => {
                const accentColor = getDivisionColor(cc.course.division);
                const bgTint = getDivisionBackgroundColor(cc.course.division);
                return (
                  <div
                    key={cc.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: "16px",
                      padding: "16px",
                      backgroundColor: bgTint,
                      borderTopWidth: "1px",
                      borderRightWidth: "1px",
                      borderBottomWidth: "1px",
                      borderLeftWidth: "4px",
                      borderTopStyle: "solid",
                      borderRightStyle: "solid",
                      borderBottomStyle: "solid",
                      borderLeftStyle: "solid",
                      borderTopColor: accentColor,
                      borderRightColor: accentColor,
                      borderBottomColor: accentColor,
                      borderLeftColor: accentColor,
                      borderRadius: "12px",
                    }}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <h3
                        style={{
                          margin: "0 0 6px",
                          fontSize: "17px",
                          fontWeight: 600,
                          color: "#ffffff",
                        }}
                      >
                        {cc.course.title}
                      </h3>
                      <p style={{ margin: 0, fontSize: "14px", color: "#d1d5db" }}>
                        {cc.gradeCompleted}
                        {cc.course.credits != null && ` • ${cc.course.credits} credits`}
                        {cc.course.division && ` • ${cc.course.division}`}
                      </p>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      {editingId === cc.id ? (
                        <select
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          style={{
                            padding: "6px 10px",
                            fontSize: "14px",
                            color: "#ffffff",
                            backgroundColor: "#111827",
                            border: "1px solid #4b5563",
                            borderRadius: "8px",
                          }}
                          autoFocus
                        >
                          {LETTER_GRADE_OPTIONS.map((g) => (
                            <option key={g} value={g}>{g}</option>
                          ))}
                        </select>
                      ) : (
                        <span
                          style={{
                            padding: "4px 12px",
                            fontSize: "14px",
                            fontWeight: 700,
                            color: cc.letterGrade
                              ? cc.letterGrade === "A"
                                ? "#22c55e"
                                : cc.letterGrade === "B"
                                ? "#3b82f6"
                                : cc.letterGrade === "C"
                                ? "#f59e0b"
                                : "#ef4444"
                              : "#6b7280",
                            backgroundColor: "#111827",
                            borderRadius: "8px",
                            minWidth: "32px",
                            textAlign: "center",
                          }}
                        >
                          {cc.letterGrade ?? "—"}
                        </span>
                      )}
                      {editingId === cc.id ? (
                        <>
                          <button
                            type="button"
                            onClick={() => handleUpdateGrade(cc.id, editValue)}
                            style={{
                              padding: "6px 12px",
                              fontSize: "13px",
                              fontWeight: 600,
                              color: "#ffffff",
                              backgroundColor: "#2563eb",
                              border: "none",
                              borderRadius: "8px",
                              cursor: "pointer",
                            }}
                          >
                            Save
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingId(null)}
                            style={{
                              padding: "6px 12px",
                              fontSize: "13px",
                              fontWeight: 600,
                              color: "#9ca3af",
                              backgroundColor: "transparent",
                              border: "1px solid #4b5563",
                              borderRadius: "8px",
                              cursor: "pointer",
                            }}
                          >
                            Cancel
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            type="button"
                            onClick={() => {
                              setEditingId(cc.id);
                              setEditValue(cc.letterGrade ?? "A");
                            }}
                            title="Edit grade"
                            style={{
                              padding: "6px 12px",
                              fontSize: "13px",
                              fontWeight: 600,
                              color: "#d1d5db",
                              backgroundColor: "transparent",
                              border: "1px solid #4b5563",
                              borderRadius: "8px",
                              cursor: "pointer",
                            }}
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRemove(cc.id)}
                            style={{
                              padding: "6px 12px",
                              fontSize: "13px",
                              fontWeight: 600,
                              color: "#fca5a5",
                              backgroundColor: "transparent",
                              border: "1px solid #fca5a5",
                              borderRadius: "8px",
                              cursor: "pointer",
                            }}
                          >
                            Remove
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {pickerOpen && (
        <CompletedCoursePicker
          onClose={() => setPickerOpen(false)}
          onSubmit={handleAdd}
          excludeCourseIds={courses.map((c) => c.courseId)}
        />
      )}
    </div>
  );
}
