"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useSavedCourses } from "@/hooks/useSavedCourses";
import type { PlannerCourseDetails } from "@/lib/planner";

const BACKEND = typeof window !== "undefined" && window.location.hostname === "localhost"
  ? "http://localhost:4000"
  : "";

async function fetchAllCourses(): Promise<PlannerCourseDetails[]> {
  const res = await fetch(`${BACKEND}/courses`, { credentials: "include" });
  if (!res.ok) throw new Error("Failed to fetch courses");
  return res.json();
}

export function SavedCoursesSection(): React.ReactElement {
  const { savedIds, loading: idsLoading } = useSavedCourses();
  const [allCourses, setAllCourses] = useState<PlannerCourseDetails[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (idsLoading) return;
    if (savedIds.length === 0) {
      setLoading(false);
      return;
    }
    fetchAllCourses()
      .then(setAllCourses)
      .catch(() => setAllCourses([]))
      .finally(() => setLoading(false));
  }, [savedIds, idsLoading]);

  const savedCourses = allCourses.filter((c) => savedIds.includes(c.id)).slice(0, 3);

  if (loading || idsLoading) {
    return (
      <Section title="Recently Saved Courses">
        <p style={{ margin: 0, fontSize: "15px", color: "var(--text-muted)" }}>
          Loading saved courses...
        </p>
      </Section>
    );
  }

  return (
    <Section title="Recently Saved Courses">
      {savedCourses.length === 0 ? (
        <p style={{ margin: 0, fontSize: "15px", color: "var(--text-muted)" }}>
          No saved courses yet.
        </p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          {savedCourses.map((course) => {
            const slug = course.normalizedTitle || course.title.toLowerCase().replace(/\s+/g, "-");
            return (
              <Link
                key={course.id}
                href={`/catalog/${slug}`}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "14px 16px",
                  backgroundColor: "var(--bg-input)",
                  borderRadius: "10px",
                  textDecoration: "none",
                  color: "inherit",
                  transition: "background-color 0.15s ease",
                }}
              >
                <span
                  style={{
                    fontSize: "15px",
                    fontWeight: 600,
                    color: "var(--text-primary)",
                  }}
                >
                  {course.title}
                </span>
                <span style={{ fontSize: "13px", color: "var(--text-muted)" }}>
                  {course.courseCode || ""}
                </span>
              </Link>
            );
          })}
          {savedIds.length > 3 && (
            <Link
              href="/saved"
              style={{
                fontSize: "14px",
                fontWeight: 500,
                color: "var(--brand-accent)",
                textDecoration: "none",
                marginTop: "4px",
              }}
            >
              View all saved courses ({savedIds.length}) →
            </Link>
          )}
        </div>
      )}
    </Section>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }): React.ReactElement {
  return (
    <div
      style={{
        padding: "24px",
        backgroundColor: "var(--bg-card)",
        border: "1px solid var(--border-default)",
        borderRadius: "16px",
      }}
    >
      <h2
        style={{
          margin: "0 0 16px",
          fontSize: "20px",
          fontWeight: 700,
          color: "var(--text-primary)",
        }}
      >
        {title}
      </h2>
      {children}
    </div>
  );
}
