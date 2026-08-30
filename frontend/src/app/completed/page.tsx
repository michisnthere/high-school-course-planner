"use client";

import React, { useEffect, useState, useCallback, useMemo } from "react";
import { useAuth } from "@/context/AuthContext";
import { useCompletedCoursesService } from "@/services/ServiceContext";
import {
  type CompletedCourse,
  type CompletedCourseInput,
  type GradeCompleted,
} from "@/lib/completedCourses";
import { CompletedCoursePicker, type CompletedCourseSelection } from "@/components/planner/CompletedCoursePicker";
import { formatCredits } from "@/lib/courseCredits";
import {
  FILTER_ORDER,
  defaultGradeForContext,
  filterCompletedCoursesByPeriod,
  getAcademicPeriodLabel,
  gradeOptionsForContext,
  groupCompletedCoursesByPeriod,
  isSummerCompletedCourse,
  type CompletedCourseFilter,
} from "@/lib/completedCoursePeriods";
import { getDivisionColor, getDivisionBackgroundColor } from "@/lib/divisionColors";
import { breakpoints } from "@/lib/responsive";
import { GuestEmptyState } from "@/components/auth/GuestEmptyState";

export default function CompletedCoursesPage(): React.ReactElement {
  const { mode } = useAuth();

  if (!mode) {
    return (
      <GuestEmptyState
        title="Completed Courses"
        description="Sign in to view your completed coursework and prerequisite history. Your completed courses will be stored securely and synced across devices."
      />
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
  const [activeFilter, setActiveFilter] = useState<CompletedCourseFilter>("All");
  const [collapsedPeriods, setCollapsedPeriods] = useState<Set<string>>(new Set());
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editGrade, setEditGrade] = useState<GradeCompleted>("Freshman (9)");

  const filteredCourses = useMemo(
    () => filterCompletedCoursesByPeriod(courses, activeFilter),
    [courses, activeFilter]
  );
  const groupedCourses = useMemo(
    () => groupCompletedCoursesByPeriod(filteredCourses),
    [filteredCourses]
  );

  const togglePeriod = useCallback((period: string) => {
    setCollapsedPeriods((prev) => {
      const next = new Set(prev);
      if (next.has(period)) {
        next.delete(period);
      } else {
        next.add(period);
      }
      return next;
    });
  }, []);

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
    const handler = () => { load(); };
    window.addEventListener("completed-courses:changed", handler);
    return () => window.removeEventListener("completed-courses:changed", handler);
  }, [load]);

  const handleAdd = useCallback(
    async (selection: CompletedCourseSelection) => {
      try {
        await completedService.addCompletedCourse(selection as CompletedCourseInput);
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
        });
        setEditingId(null);
        await load();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to update completed course");
      }
    },
    [load, editGrade, completedService]
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
          .rs-completed-page h1 {
            margin-top: 8px !important;
          }
          .rs-completed-toolbar {
            align-items: stretch !important;
            flex-direction: column !important;
          }
          .rs-completed-filters {
            overflow-x: auto;
            padding-bottom: 2px;
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
          minHeight: "calc(100dvh - 64px)",
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
            <div
              className="rs-completed-toolbar"
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: "16px",
              }}
            >
              <div className="rs-completed-filters" style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                {(FILTER_ORDER as unknown as CompletedCourseFilter[]).map((filter) => {
                  const active = activeFilter === filter;
                  return (
                    <button
                      key={filter}
                      type="button"
                      onClick={() => setActiveFilter(filter)}
                      style={{
                        padding: "8px 14px",
                        fontSize: "14px",
                        fontWeight: 600,
                        color: active ? "#ffffff" : "var(--text-secondary)",
                        backgroundColor: active ? "var(--brand-accent)" : "var(--bg-card)",
                        border: `1px solid ${active ? "var(--brand-accent)" : "var(--border-default)"}`,
                        borderRadius: "9999px",
                        cursor: "pointer",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {filter}
                    </button>
                  );
                })}
              </div>
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
                  whiteSpace: "nowrap",
                }}
              >
                + Add Completed Course
              </button>
            </div>

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
            ) : filteredCourses.length === 0 ? (
              <div
                style={{
                  padding: "32px 24px",
                  textAlign: "center",
                  color: "var(--text-muted)",
                  backgroundColor: "var(--bg-card)",
                  border: "1px solid var(--border-default)",
                  borderRadius: "12px",
                }}
              >
                No completed courses match this filter.
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                {groupedCourses
                  .filter((group) => activeFilter === "All" ? group.courses.length > 0 : group.label === activeFilter)
                  .map((group) => {
                    const isCollapsed = collapsedPeriods.has(group.label);
                    return (
                      <section
                        key={group.label}
                        style={{
                          backgroundColor: "var(--bg-card)",
                          border: "1px solid var(--border-default)",
                          borderRadius: "12px",
                          overflow: "hidden",
                        }}
                      >
                        <button
                          type="button"
                          onClick={() => togglePeriod(group.label)}
                          aria-expanded={!isCollapsed}
                          style={{
                            width: "100%",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            gap: "16px",
                            padding: "16px 18px",
                            background: "transparent",
                            border: "none",
                            cursor: "pointer",
                            textAlign: "left",
                          }}
                        >
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <h2
                              style={{
                                margin: 0,
                                fontSize: "18px",
                                fontWeight: 700,
                                color: group.isSummer ? "var(--brand-accent)" : "var(--text-primary)",
                                lineHeight: 1.3,
                                overflowWrap: "break-word",
                                wordBreak: "break-word",
                              }}
                            >
                              {group.label}
                            </h2>
                            <p style={{ margin: "4px 0 0", fontSize: "13px", color: "var(--text-muted)" }}>
                              {group.courses.length} {group.courses.length === 1 ? "course" : "courses"}
                            </p>
                          </div>
                          <span
                            aria-hidden="true"
                            style={{
                              color: "var(--text-muted)",
                              fontSize: "14px",
                              transform: isCollapsed ? "rotate(0deg)" : "rotate(90deg)",
                              transition: "transform 160ms ease",
                              flexShrink: 0,
                            }}
                          >
                            ▶
                          </span>
                        </button>

                        {!isCollapsed && (
                          <div
                            style={{
                              display: "flex",
                              flexDirection: "column",
                              gap: group.isSummer ? "12px" : "10px",
                              padding: "0 16px 16px",
                            }}
                          >
                            {group.isSummer && group.summerSubSections
                              ? group.summerSubSections.map((sub) => (
                                  <div key={sub.yearLabel}>
                                    <div
                                      style={{
                                        display: "flex",
                                        justifyContent: "space-between",
                                        alignItems: "baseline",
                                        gap: "8px",
                                        marginBottom: "8px",
                                      }}
                                    >
                                      <h3
                                        style={{
                                          margin: 0,
                                          fontSize: "15px",
                                          fontWeight: 700,
                                          color: "var(--text-secondary)",
                                        }}
                                      >
                                        {sub.yearLabel}
                                      </h3>
                                      <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>
                                        {sub.courses.length} {sub.courses.length === 1 ? "course" : "courses"}
                                      </span>
                                    </div>
                                    {sub.courses.map((cc) => (
                                      <CompletedCourseCard
                                        key={cc.id}
                                        course={cc}
                                        editingId={editingId}
                                        editGrade={editGrade}
                                        onEditGrade={setEditGrade}
                                        onStartEdit={() => {
                                          setEditingId(cc.id);
                                          setEditGrade(defaultGradeForContext(cc.summerCourseId != null, cc.gradeCompleted));
                                        }}
                                        onCancelEdit={() => setEditingId(null)}
                                        onSave={() => handleUpdate(cc.id)}
                                        onRemove={() => handleRemove(cc.id)}
                                      />
                                    ))}
                                  </div>
                                ))
                              : group.courses.length === 0
                              ? (
                                <p style={{ margin: 0, padding: "4px 0", fontSize: "14px", color: "var(--text-muted)" }}>
                                  No courses recorded.
                                </p>
                              )
                              : group.courses.map((cc) => (
                                  <CompletedCourseCard
                                    key={cc.id}
                                    course={cc}
                                    editingId={editingId}
                                    editGrade={editGrade}
                                    onEditGrade={setEditGrade}
                                    onStartEdit={() => {
                                      setEditingId(cc.id);
                                      setEditGrade(defaultGradeForContext(cc.summerCourseId != null, cc.gradeCompleted));
                                    }}
                                    onCancelEdit={() => setEditingId(null)}
                                    onSave={() => handleUpdate(cc.id)}
                                    onRemove={() => handleRemove(cc.id)}
                                  />
                                ))}
                          </div>
                        )}
                      </section>
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
            excludeCourseIds={courses
              .map((c) => c.courseId)
              .filter((id): id is number => id != null)}
            excludeSummerCourseIds={courses
              .map((c) => c.summerCourseId)
              .filter((id): id is number => id != null)}
          />
        )}
      </div>
    </>
  );
}

type CompletedCourseCardProps = {
  course: CompletedCourse;
  editingId: number | null;
  editGrade: GradeCompleted;
  onEditGrade: (grade: GradeCompleted) => void;
  onStartEdit: () => void;
  onCancelEdit: () => void;
  onSave: () => void;
  onRemove: () => void;
};

function CompletedCourseCard({
  course: cc,
  editingId,
  editGrade,
  onEditGrade,
  onStartEdit,
  onCancelEdit,
  onSave,
  onRemove,
}: CompletedCourseCardProps): React.ReactElement {
  const courseTitle = cc.course?.title ?? cc.summerCourse?.title ?? "Unknown Course";
  const division = cc.course?.division ?? null;
  const credits = cc.credits ?? cc.course?.credits ?? null;
  const accentColor = getDivisionColor(division);
  const bgTint = getDivisionBackgroundColor(division);
  const isEditing = editingId === cc.id;
  const periodLabel = isSummerCompletedCourse(cc) ? cc.gradeCompleted : getAcademicPeriodLabel(cc.gradeCompleted);
  // Edit context follows the course type (summerCourseId vs courseId), not the
  // stored grade, so a Summer School record can never be edited into a regular
  // period (or vice versa). A stored value that is no longer offered (e.g. the
  // legacy generic "Summer School" grade) is kept as an option so editing never
  // silently drops it.
  const contextGradeOptions = gradeOptionsForContext(cc.summerCourseId != null);
  const editGradeOptions = contextGradeOptions.includes(editGrade)
    ? contextGradeOptions
    : [editGrade, ...contextGradeOptions];

  return (
    <div
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
        borderRadius: "10px",
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <h3
          style={{
            margin: "0 0 6px",
            fontSize: "17px",
            fontWeight: 700,
            color: accentColor,
            display: "flex",
            alignItems: "center",
            gap: "8px",
            flexWrap: "wrap",
          }}
        >
          {courseTitle}
          {cc.summerCourse != null && (
            <span
              style={{
                fontSize: "11px",
                fontWeight: 600,
                textTransform: "uppercase",
                letterSpacing: "0.04em",
                color: "var(--brand-accent)",
                backgroundColor: "var(--bg-hover, rgba(0,0,0,0.03))",
                border: "1px solid var(--brand-accent)",
                borderRadius: "9999px",
                padding: "2px 8px",
                whiteSpace: "nowrap",
              }}
            >
              Summer
            </span>
          )}
        </h3>
        <p style={{ margin: 0, fontSize: "14px", color: "var(--text-secondary)" }}>
          {isEditing ? (
            <select
              value={editGrade}
              onChange={(e) => onEditGrade(e.target.value as GradeCompleted)}
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
              {editGradeOptions.map((g) => (
                <option key={g} value={g}>{getAcademicPeriodLabel(g)}</option>
              ))}
            </select>
          ) : (
            periodLabel
          )}
          {credits != null && ` • ${formatCredits(credits)} credits`}
          {division && ` • ${division}`}
        </p>
      </div>
      <div className="rs-completed-card-actions" style={{ display: "flex", alignItems: "center", gap: "8px" }}>
        {isEditing ? (
          <>
            <button
              type="button"
              onClick={onSave}
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
              onClick={onCancelEdit}
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
              onClick={onStartEdit}
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
              onClick={onRemove}
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
}
