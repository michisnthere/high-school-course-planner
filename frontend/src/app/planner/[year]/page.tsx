"use client";

import React, { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { getPlanner, type Planner } from "@/lib/planner";

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

  useEffect(() => {
    if (!year || !YEAR_LABELS[year]) {
      setError("Invalid school year.");
      setLoading(false);
      return;
    }

    getPlanner(year)
      .then(setPlanner)
      .catch(() => setPlanner(null))
      .finally(() => setLoading(false));
  }, [year]);

  const renderSlot = (semester: number, slot: number) => {
    const planned = planner?.plannedCourses.find(
      (course) => course.semester === semester && course.slot === slot
    );

    return (
      <div
        key={`${semester}-${slot}`}
        style={{
          padding: "20px",
          backgroundColor: "#1f2937",
          border: "1px solid #374151",
          borderRadius: "12px",
          fontFamily:
            '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
        }}
      >
        <div
          style={{
            fontSize: "13px",
            fontWeight: 600,
            color: "#9ca3af",
            textTransform: "uppercase",
            letterSpacing: "0.02em",
            marginBottom: "8px",
          }}
        >
          Slot {slot}
        </div>
        <div
          style={{
            fontSize: "16px",
            fontWeight: 500,
            color: planned ? "#ffffff" : "#6b7280",
          }}
        >
          {planned ? `Course ${planned.courseId}` : "Empty"}
        </div>
      </div>
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
                  gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
                }}
              >
                {Array.from({ length: 7 }, (_, i) => renderSlot(semester, i + 1))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
