"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { getPlanners, type Planner } from "@/lib/planner";

const YEAR_LABELS: Record<number, string> = {
  9: "Freshman",
  10: "Sophomore",
  11: "Junior",
  12: "Senior",
};

const cardStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  justifyContent: "center",
  minHeight: "160px",
  padding: "28px",
  backgroundColor: "#1f2937",
  border: "1px solid #374151",
  borderRadius: "16px",
  textDecoration: "none",
  transition: "transform 0.15s ease, box-shadow 0.15s ease",
  fontFamily:
    '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
};

export default function PlannerPage(): React.ReactElement {
  return (
    <ProtectedRoute>
      <PlannerContent />
    </ProtectedRoute>
  );
}

function PlannerContent(): React.ReactElement {
  const [planners, setPlanners] = useState<Planner[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getPlanners()
      .then(setPlanners)
      .catch(() => setPlanners([]))
      .finally(() => setLoading(false));
  }, []);

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
        My Planner
      </h1>
      <p
        style={{
          margin: "0 0 28px",
          fontSize: "16px",
          color: "#d1d5db",
        }}
      >
        Select a year to start planning your courses.
      </p>

      {loading ? (
        <p style={{ color: "#d1d5db" }}>Loading planners...</p>
      ) : (
        <div
          style={{
            display: "grid",
            gap: "24px",
            gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
          }}
        >
          {planners.map((planner) => (
            <Link
              key={planner.schoolYear}
              href={`/planner/${planner.schoolYear}`}
              style={cardStyle}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = "translateY(-2px)";
                e.currentTarget.style.boxShadow = "0 10px 20px rgba(0,0,0,0.25)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = "translateY(0)";
                e.currentTarget.style.boxShadow = "none";
              }}
            >
              <h2
                style={{
                  margin: "0 0 8px",
                  fontSize: "26px",
                  fontWeight: 700,
                  color: "#ffffff",
                }}
              >
                {YEAR_LABELS[planner.schoolYear]}
              </h2>
              <p
                style={{
                  margin: 0,
                  fontSize: "15px",
                  color: "#9ca3af",
                }}
              >
                {(planner.plannedCourses ?? []).length} course
                {(planner.plannedCourses ?? []).length === 1 ? "" : "s"} planned
              </p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
