"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { usePlannerService } from "@/services/ServiceContext";
import { ResponsivePage } from "@/components/responsive/ResponsivePage";
import { useBreakpoint } from "@/hooks/useBreakpoint";
import type { Planner } from "@/lib/planner";

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
  backgroundColor: "var(--bg-card)",
  border: "1px solid var(--border-default)",
  borderRadius: "16px",
  textDecoration: "none",
  transition: "transform 0.15s ease, box-shadow 0.15s ease",
};

export default function PlannerPage(): React.ReactElement {
  return (
    <ProtectedRoute>
      <PlannerContent />
    </ProtectedRoute>
  );
}

function PlannerContent(): React.ReactElement {
  const plannerService = usePlannerService();
  const [planners, setPlanners] = useState<Planner[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    plannerService.getPlanners()
      .then(setPlanners)
      .catch(() => setPlanners([]))
      .finally(() => setLoading(false));
  }, [plannerService]);

  return (
    <ResponsivePage>
      <h1
        style={{
          margin: "0 0 8px",
          fontSize: "32px",
          fontWeight: 700,
          color: "var(--text-primary)",
          lineHeight: 1.2,
        }}
      >
        My Planner
      </h1>
      <p
        style={{
          margin: "0 0 28px",
          fontSize: "16px",
          color: "var(--text-secondary)",
        }}
      >
        Select a year to start planning your courses.
      </p>

      {loading ? (
        <p style={{ color: "var(--text-muted)" }}>Loading planners...</p>
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
                  color: "var(--text-primary)",
                }}
              >
                {YEAR_LABELS[planner.schoolYear]}
              </h2>
              {(() => {
                const uniqueIds = new Set<number | string>();
                for (const pc of planner.plannedCourses ?? []) {
                  if (pc.courseId != null) {
                    uniqueIds.add(pc.courseId);
                  } else {
                    uniqueIds.add(`opt-${pc.id}`);
                  }
                }
                const count = uniqueIds.size;
                return (
                  <p
                    style={{
                      margin: 0,
                      fontSize: "15px",
                      color: "var(--text-muted)",
                    }}
                  >
                    {count} course{count === 1 ? "" : "s"} planned
                  </p>
                );
              })()}
            </Link>
          ))}
        </div>
      )}
    </ResponsivePage>
  );
}
