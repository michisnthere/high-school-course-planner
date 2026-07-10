"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { useSavedCourses } from "@/hooks/useSavedCourses";
import {
  getPlanner,
  addPlannedCourse,
  removePlannedCourse,
  searchPlannerCourses,
  type Planner,
  type PlannerCourseDetails,
  type PlannedCourse,
  type CourseDuration,
} from "@/lib/planner";

const YEAR_LABELS: Record<number, string> = {
  9: "Freshman",
  10: "Sophomore",
  11: "Junior",
  12: "Senior",
};

export default function PlannerYearPage(): React.ReactElement {
  return (
    <ProtectedRoute>
      <PlannerYearContent />
    </ProtectedRoute>
  );
}

function PlannerYearContent(): React.ReactElement {
  const params = useParams();
  const year = Number(params.year);
  const [planner, setPlanner] = useState<Planner | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeSlot, setActiveSlot] = useState<{
    semester: number;
    slot: number;
  } | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const { isSaved } = useSavedCourses();

  useEffect(() => {
    if (!year || !YEAR_LABELS[year]) {
      setError("Invalid school year.");
      setLoading(false);
      return;
    }

    setLoading(true);
    getPlanner(year)
      .then(setPlanner)
      .catch(() => setPlanner(null))
      .finally(() => setLoading(false));
  }, [year, refreshKey]);

  const handleOpenModal = useCallback((semester: number, slot: number) => {
    setActiveSlot({ semester, slot });
  }, []);

  const handleCloseModal = useCallback(() => {
    setActiveSlot(null);
  }, []);

  const handleCourseSelected = useCallback(
    async (courseId: number) => {
      if (!planner || !activeSlot) return;

      try {
        await addPlannedCourse(
          planner.id,
          courseId,
          activeSlot.semester,
          activeSlot.slot
        );
        setRefreshKey((k) => k + 1);
        handleCloseModal();
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to add course";
        alert(message);
      }
    },
    [planner, activeSlot, handleCloseModal]
  );

  const handleRemoveCourse = useCallback(async (plannedCourseId: number) => {
    try {
      await removePlannedCourse(plannedCourseId);
      setRefreshKey((k) => k + 1);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to remove course";
      alert(message);
    }
  }, []);

  const renderSlot = (semester: number, slot: number) => {
    const planned = planner?.plannedCourses.find(
      (course) => course.semester === semester && course.slot === slot
    );

    if (planned) {
      return (
        <PlannedCourseCard
          key={`${semester}-${slot}`}
          planned={planned}
          onRemove={() => handleRemoveCourse(planned.id)}
        />
      );
    }

    return (
      <AddCourseCard
        key={`${semester}-${slot}`}
        semester={semester}
        slot={slot}
        onClick={() => handleOpenModal(semester, slot)}
      />
    );
  };

  return (
    <div
      style={{
        padding: "32px",
        fontFamily:
          '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
      }}
    >
      <Link
        href="/planner"
        style={{
          display: "inline-block",
          marginBottom: "16px",
          fontSize: "14px",
          color: "#d1d5db",
          textDecoration: "none",
          fontWeight: 500,
        }}
      >
        ← Back to Planner
      </Link>

      <h1
        style={{
          margin: "0 0 28px",
          fontSize: "32px",
          fontWeight: 700,
          color: "#ffffff",
          lineHeight: 1.2,
        }}
      >
        {YEAR_LABELS[year] ?? "Year"} Planner
      </h1>

      {loading ? (
        <p style={{ color: "#d1d5db" }}>Loading planner...</p>
      ) : error ? (
        <p style={{ color: "#ef4444" }}>{error}</p>
      ) : !planner ? (
        <p style={{ color: "#d1d5db" }}>Planner not found.</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "32px" }}>
          {[1, 2].map((semester) => (
            <section key={semester}>
              <h2
                style={{
                  margin: "0 0 16px",
                  fontSize: "22px",
                  fontWeight: 600,
                  color: "#ffffff",
                }}
              >
                Semester {semester}
              </h2>
              <div
                style={{
                  display: "grid",
                  gap: "16px",
                  gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
                }}
              >
                {Array.from({ length: 7 }, (_, i) => renderSlot(semester, i + 1))}
              </div>
            </section>
          ))}
        </div>
      )}

      {activeSlot && planner && (
        <CourseSearchModal
          onClose={handleCloseModal}
          onSelect={handleCourseSelected}
          isSaved={isSaved}
        />
      )}
    </div>
  );
}

function AddCourseCard({
  semester,
  slot,
  onClick,
}: {
  semester: number;
  slot: number;
  onClick: () => void;
}): React.ReactElement {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: "8px",
        padding: "20px",
        minHeight: "120px",
        backgroundColor: "#1f2937",
        border: "2px dashed #4b5563",
        borderRadius: "12px",
        cursor: "pointer",
        color: "#9ca3af",
        fontFamily:
          '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
        transition: "all 0.2s ease",
        textAlign: "center",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = "#6b7280";
        e.currentTarget.style.color = "#d1d5db";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = "#4b5563";
        e.currentTarget.style.color = "#9ca3af";
      }}
    >
      <div
        style={{
          fontSize: "13px",
          fontWeight: 600,
          textTransform: "uppercase",
          letterSpacing: "0.02em",
        }}
      >
        Slot {slot}
      </div>
      <div
        style={{
          fontSize: "16px",
          fontWeight: 500,
        }}
      >
        + Add Course
      </div>
    </button>
  );
}

function PlannedCourseCard({
  planned,
  onRemove,
}: {
  planned: PlannedCourse;
  onRemove: () => void;
}): React.ReactElement {
  const { course } = planned;

  return (
    <div
      style={{
        padding: "16px",
        backgroundColor: "#111827",
        border: "1px solid #374151",
        borderRadius: "12px",
        fontFamily:
          '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
        display: "flex",
        flexDirection: "column",
        gap: "8px",
        minHeight: "120px",
      }}
    >
      <div
        style={{
          fontSize: "13px",
          fontWeight: 600,
          color: "#9ca3af",
          textTransform: "uppercase",
          letterSpacing: "0.02em",
        }}
      >
        Slot {planned.slot}
      </div>

      <div
        style={{
          fontSize: "16px",
          fontWeight: 600,
          color: "#ffffff",
          lineHeight: 1.3,
        }}
      >
        {course.title}
      </div>

      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "8px",
          fontSize: "13px",
          color: "#9ca3af",
        }}
      >
        {course.creditType && (
          <span
            style={{
              padding: "4px 10px",
              backgroundColor: "#1f2937",
              borderRadius: "9999px",
              fontWeight: 500,
            }}
          >
            {course.creditType}
          </span>
        )}
        {course.credits != null && (
          <span
            style={{
              padding: "4px 10px",
              backgroundColor: "#1f2937",
              borderRadius: "9999px",
              fontWeight: 500,
            }}
          >
            {course.credits} credits
          </span>
        )}
        {course.duration === "Full Year" && (
          <span
            style={{
              padding: "4px 10px",
              backgroundColor: "#1f2937",
              borderRadius: "9999px",
              fontWeight: 500,
            }}
          >
            Full Year
          </span>
        )}
      </div>

      <button
        type="button"
        onClick={onRemove}
        style={{
          alignSelf: "flex-start",
          marginTop: "auto",
          padding: "6px 12px",
          fontSize: "13px",
          fontWeight: 600,
          color: "#fca5a5",
          backgroundColor: "transparent",
          border: "1px solid #7f1d1d",
          borderRadius: "6px",
          cursor: "pointer",
        }}
      >
        Remove
      </button>
    </div>
  );
}

function CourseSearchModal({
  onClose,
  onSelect,
  isSaved,
}: {
  onClose: () => void;
  onSelect: (courseId: number) => void;
  isSaved: (courseId: number) => boolean;
}): React.ReactElement {
  const [query, setQuery] = useState("");
  const [allCourses, setAllCourses] = useState<PlannerCourseDetails[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    searchPlannerCourses("")
      .then(setAllCourses)
      .catch(() => setAllCourses([]))
      .finally(() => setLoading(false));
  }, []);

  const filteredResults = allCourses.filter((course) =>
    course.title.toLowerCase().includes(query.trim().toLowerCase())
  );

  const sortedResults = [...filteredResults].sort((a, b) => {
    const aSaved = isSaved(a.id) ? 1 : 0;
    const bSaved = isSaved(b.id) ? 1 : 0;
    return bSaved - aSaved;
  });

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(0, 0, 0, 0.7)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 50,
        padding: "24px",
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "600px",
          maxHeight: "80vh",
          backgroundColor: "#1f2937",
          border: "1px solid #374151",
          borderRadius: "16px",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          fontFamily:
            '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            padding: "24px 24px 16px",
            borderBottom: "1px solid #374151",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: "16px",
            }}
          >
            <h2
              style={{
                margin: 0,
                fontSize: "22px",
                fontWeight: 600,
                color: "#ffffff",
              }}
            >
              Add a Course
            </h2>
            <button
              type="button"
              onClick={onClose}
              style={{
                fontSize: "24px",
                color: "#9ca3af",
                background: "none",
                border: "none",
                cursor: "pointer",
                padding: "4px",
                lineHeight: 1,
              }}
              aria-label="Close"
            >
              ×
            </button>
          </div>

          <input
            type="text"
            placeholder="Search by course title..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoFocus
            style={{
              width: "100%",
              padding: "14px 16px",
              fontSize: "16px",
              color: "#ffffff",
              backgroundColor: "#111827",
              border: "1px solid #4b5563",
              borderRadius: "10px",
              outline: "none",
              boxSizing: "border-box",
            }}
          />
        </div>

        <div
          style={{
            flex: 1,
            overflowY: "auto",
            padding: "16px 24px 24px",
          }}
        >
          {loading ? (
            <p style={{ color: "#9ca3af", textAlign: "center" }}>Loading courses...</p>
          ) : sortedResults.length === 0 ? (
            <p style={{ color: "#9ca3af", textAlign: "center" }}>
              {query.trim() === "" ? "No courses available." : "No courses match your search."}
            </p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              {sortedResults.map((course) => (
                <button
                  key={course.id}
                  type="button"
                  onClick={() => onSelect(course.id)}
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    justifyContent: "space-between",
                    gap: "12px",
                    padding: "16px",
                    backgroundColor: "#111827",
                    border: "1px solid #374151",
                    borderRadius: "12px",
                    cursor: "pointer",
                    textAlign: "left",
                    color: "inherit",
                    width: "100%",
                  }}
                >
                  <div style={{ flex: 1 }}>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                        marginBottom: "6px",
                      }}
                    >
                      <span
                        style={{
                          fontSize: "16px",
                          fontWeight: 600,
                          color: "#ffffff",
                        }}
                      >
                        {course.title}
                      </span>
                      {isSaved(course.id) && (
                        <span
                          style={{
                            fontSize: "18px",
                            color: "#fbbf24",
                          }}
                          aria-label="Saved"
                        >
                          ★
                        </span>
                      )}
                    </div>
                    <div
                      style={{
                        display: "flex",
                        flexWrap: "wrap",
                        gap: "8px",
                        fontSize: "13px",
                        color: "#9ca3af",
                      }}
                    >
                      {course.creditType && (
                        <span
                          style={{
                            padding: "3px 8px",
                            backgroundColor: "#1f2937",
                            borderRadius: "9999px",
                          }}
                        >
                          {course.creditType}
                        </span>
                      )}
                      {course.credits != null && (
                        <span
                          style={{
                            padding: "3px 8px",
                            backgroundColor: "#1f2937",
                            borderRadius: "9999px",
                          }}
                        >
                          {course.credits} credits
                        </span>
                      )}
                      {course.duration && (
                        <span
                          style={{
                            padding: "3px 8px",
                            backgroundColor: "#1f2937",
                            borderRadius: "9999px",
                          }}
                        >
                          {course.duration}
                        </span>
                      )}
                    </div>
                  </div>
                  <span
                    style={{
                      fontSize: "14px",
                      fontWeight: 600,
                      color: "#3b82f6",
                      whiteSpace: "nowrap",
                    }}
                  >
                    Add →
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
