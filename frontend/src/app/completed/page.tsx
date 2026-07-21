"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/context/AuthContext";
import { useCompletedCoursesService } from "@/services/ServiceContext";
import {
  GRADE_COMPLETED_OPTIONS,
  LETTER_GRADE_OPTIONS,
  type CompletedCourse,
  type GradeCompleted,
} from "@/lib/completedCourses";
import { CompletedCoursePicker } from "@/components/planner/CompletedCoursePicker";
import { getDivisionColor, getDivisionBackgroundColor } from "@/lib/divisionColors";
import { breakpoints } from "@/lib/responsive";

const signInButtonStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  minHeight: "44px",
  padding: "8px 20px",
  fontSize: "15px",
  fontWeight: 500,
  color: "#FFFFFF",
  backgroundColor: "var(--brand-accent)",
  border: "none",
  borderRadius: "8px",
  cursor: "pointer",
  textDecoration: "none",
  boxSizing: "border-box",
};

export default function CompletedCoursesPage(): React.ReactElement {
  const { mode } = useAuth();

  if (!mode) {
    return (
      <>
        <style>{`
          @media (max-width: ${breakpoints.mobile - 1}px) {
            .rs-completed-guest-page {
              padding: 16px !important;
              padding-top: 0 !important;
              padding-bottom: calc(16px + var(--safe-area-bottom)) !important;
              padding-left: calc(16px + var(--safe-area-left)) !important;
              padding-right: calc(16px + var(--safe-area-right)) !important;
            }
          }
        `}</style>
        <div className="rs-completed-guest-page" style={{ padding: "32px", minHeight: "calc(100vh - 64px)" }}>
        <h1
          style={{
            margin: "0 0 16px",
            fontSize: "32px",
            fontWeight: 700,
            color: "var(--text-primary)",
            lineHeight: 1.2,
          }}
        >
          Completed Courses
        </h1>
        <div
          style={{
            padding: "24px",
            backgroundColor: "var(--bg-card)",
            borderRadius: "12px",
          }}
        >
          <h2
            style={{
              margin: "0 0 8px",
              fontSize: "20px",
              fontWeight: 700,
              color: "var(--text-primary)",
            }}
          >
            Sign in to track completed courses
          </h2>
          <p
            style={{
              margin: "0 0 16px",
              fontSize: "15px",
              color: "var(--text-secondary)",
              lineHeight: 1.5,
            }}
          >
            Your completed courses will be stored securely and synced across devices.
          </p>
          <a href="/login" style={signInButtonStyle}>
            Sign In
          </a>
        </div>
      </div>
    </>
    );
  }

  return <CompletedCoursesContent />;
}

function CompletedCoursesContent(): React.ReactElement {
  const completedService = useCompletedCoursesService();
  const [courses, setCourses] = useState<CompletedCourse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editGrade, setEditGrade] = useState<GradeCompleted>("Freshman (9)");
  const [editLetter, setEditLetter] = useState<string>("A");

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const data = await completedService.getCompletedCourses();
      setCourses(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load completed courses");
    } finally {
      setLoading(false);
    }
  }, [completedService]);

  useEffect(() => {
    load();
  }, [load]);

  const handleAdd = useCallback(
    async (selection: {
      courseId: number;
      gradeCompleted: GradeCompleted;
      letterGrade: string | null;
    }) => {
      try {
        await completedService.addCompletedCourse(selection.courseId, selection.gradeCompleted, selection.letterGrade);
        setPickerOpen(false);
        await load();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to add completed course");
      }
    },
    [load, completedService]
  );

  const handleUpdate = useCallback(
    async (id: number) => {
      try {
        await completedService.updateCompletedCourse(id, {
          gradeCompleted: editGrade,
          letterGrade: editLetter,
        });
        setEditingId(null);
        await load();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to update completed course");
      }
    },
    [load, editGrade, editLetter, completedService]
  );

  const handleRemove = useCallback(
    async (id: number) => {
      try {
        await completedService.removeCompletedCourse(id);
        await load();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to remove completed course");
      }
    },
    [load, completedService]
  );

  return (
    <>
      <style>{`
        @media (max-width: ${breakpoints.mobile - 1}px) {
          .rs-completed-page {
            padding: 16px !important;
            padding-top: 0 !important;
            padding-bottom: calc(16px + var(--safe-area-bottom)) !important;
            padding-left: calc(16px + var(--safe-area-left)) !important;
            padding-right: calc(16px + var(--safe-area-right)) !important;
          }
          .rs-completed-add-btn {
            width: 100% !important;
            min-height: 48px !important;
            font-size: 16px !important;
          }
          .rs-completed-card {
            flex-direction: column !important;
            gap: 12px !important;
          }
          .rs-completed-card-actions {
            width: 100% !important;
            justify-content: stretch !important;
          }
          .rs-completed-card-actions button,
          .rs-completed-card-actions select {
            min-height: 44px !important;
            flex: 1 !important;
            font-size: 14px !important;
          }
        }
      `}</style>
      <div
        className="rs-completed-page"
        style={{
          padding: "32px",
          minHeight: "calc(100vh - 64px)",
        }}
      >
        <h1
          style={{
            margin: "0 0 28px",
            fontSize: "32px",
            fontWeight: 700,
            color: "var(--text-primary)",
            lineHeight: 1.2,
          }}
        >
          Completed Courses
        </h1>

        {loading ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                style={{
                  height: "80px",
                  backgroundColor: "var(--bg-card)",
                  border: "1px solid var(--border-default)",
                  borderRadius: "12px",
                  animation: "skeleton-pulse 1.5s ease-in-out infinite",
                }}
              />
            ))}
            <style>{`@keyframes skeleton-pulse { 0%, 100% { opacity: 0.5; } 50% { opacity: 1; } }`}</style>
          </div>
        ) : error ? (
          <p style={{ color: "var(--status-error)" }}>{error}</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
            <button
              type="button"
              onClick={() => setPickerOpen(true)}
              className="rs-completed-add-btn"
              style={{
                alignSelf: "flex-start",
                padding: "12px 20px",
                fontSize: "15px",
                fontWeight: 500,
                color: "#FFFFFF",
                backgroundColor: "var(--brand-accent)",
                border: "none",
                borderRadius: "10px",
                cursor: "pointer",
              }}
            >
              + Add Completed Course
            </button>

            {courses.length === 0 ? (
              <div
                style={{
                  padding: "48px 24px",
                  textAlign: "center",
                  backgroundColor: "var(--bg-card)",
                  border: "1px solid var(--border-default)",
                  borderRadius: "12px",
                }}
              >
                <div
                  style={{
                    fontSize: "48px",
                    marginBottom: "16px",
                    lineHeight: 1,
                  }}
                >
                  {"\u2705"}
                </div>
                <h3
                  style={{
                    margin: "0 0 8px",
                    fontSize: "18px",
                    fontWeight: 600,
                    color: "var(--text-primary)",
                  }}
                >
                  No completed courses yet
                </h3>
                <p
                  style={{
                    margin: "0 0 20px",
                    fontSize: "15px",
                    color: "var(--text-muted)",
                    lineHeight: 1.5,
                    maxWidth: "400px",
                    marginLeft: "auto",
                    marginRight: "auto",
                  }}
                >
                  Add courses you have already finished to improve your planner warnings and
                  track your graduation progress.
                </p>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                {courses.map((cc) => {
                  const accentColor = getDivisionColor(cc.course.division);
                  const bgTint = getDivisionBackgroundColor(cc.course.division);
                  return (
                    <div
                      key={cc.id}
                      className="rs-completed-card"
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
                            fontWeight: 700,
                            color: accentColor,
                          }}
                        >
                          {cc.course.title}
                        </h3>
                        <p style={{ margin: 0, fontSize: "14px", color: "var(--text-secondary)" }}>
                          {editingId === cc.id ? (
                            <select
                              value={editGrade}
                              onChange={(e) => setEditGrade(e.target.value as GradeCompleted)}
                              style={{
                                padding: "4px 8px",
                                fontSize: "13px",
                                color: "var(--text-primary)",
                                backgroundColor: "var(--bg-card)",
                                border: "1px solid var(--border-default)",
                                borderRadius: "6px",
                                marginRight: "8px",
                              }}
                            >
                              {GRADE_COMPLETED_OPTIONS.map((g) => (
                                <option key={g} value={g}>{g}</option>
                              ))}
                            </select>
                          ) : (
                            cc.gradeCompleted
                          )}
                          {cc.course.credits != null && ` • ${cc.course.credits} credits`}
                          {cc.course.division && ` • ${cc.course.division}`}
                        </p>
                      </div>
                      <div className="rs-completed-card-actions" style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        {editingId === cc.id ? (
                          <select
                            value={editLetter}
                            onChange={(e) => setEditLetter(e.target.value)}
                            style={{
                              padding: "6px 10px",
                              fontSize: "14px",
                              color: "var(--text-primary)",
                              backgroundColor: "var(--bg-card)",
                              border: "1px solid var(--border-default)",
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
                              fontWeight: 600,
                              color: cc.letterGrade
                                ? cc.letterGrade === "A"
                                  ? "var(--status-success)"
                                  : cc.letterGrade === "B"
                                  ? "var(--status-info)"
                                  : cc.letterGrade === "C"
                                  ? "var(--status-warning)"
                                  : "var(--status-error)"
                                : "var(--text-muted)",
                              backgroundColor: "var(--bg-muted)",
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
                              onClick={() => handleUpdate(cc.id)}
                              style={{
                                padding: "6px 12px",
                                fontSize: "13px",
                                fontWeight: 500,
                                color: "var(--btn-primary-text)",
                                backgroundColor: "var(--brand-accent)",
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
                                fontWeight: 500,
                                color: "var(--text-secondary)",
                                backgroundColor: "transparent",
                                border: "1px solid var(--border-default)",
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
                                setEditGrade(cc.gradeCompleted);
                                setEditLetter(cc.letterGrade ?? "A");
                              }}
                              title="Edit"
                              style={{
                                padding: "6px 12px",
                                fontSize: "13px",
                                fontWeight: 500,
                                color: "var(--text-secondary)",
                                backgroundColor: "transparent",
                                border: "1px solid var(--border-default)",
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
                                fontWeight: 500,
                                color: "var(--btn-danger-text)",
                                backgroundColor: "transparent",
                                border: "1px solid var(--btn-danger-border)",
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
    </>
  );
}
