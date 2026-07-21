"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { useServices } from "@/services/ServiceContext";
import { DashboardOverview } from "@/components/dashboard/DashboardOverview";
import { SavedCoursesSection } from "@/components/dashboard/SavedCoursesSection";
import { GuestUpgradePrompt } from "@/components/auth/GuestUpgradePrompt";
import { ResponsivePage } from "@/components/responsive/ResponsivePage";
import { getGpaProjection } from "@/lib/gpaProjection";
import { breakpoints } from "@/lib/responsive";
import type { PlannerAnalysis } from "@/lib/plannerAnalysis";

export default function Home() {
  const { user, isGuest } = useAuth();
  const services = useServices();
  const [analysis, setAnalysis] = useState<PlannerAnalysis | null>(null);
  const [grade, setGrade] = useState<string>("");
  const [gpa, setGpa] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const planners = await services.planner.getPlanners();
        const analysisData = await services.analysis.getAnalysis({
          planners,
          completedCourses: [],
          resolutions: [],
          allCourses: [],
        });
        if (!cancelled) setAnalysis(analysisData);

        const active = planners.find((p) => p.schoolYear != null);
        if (active && !cancelled) {
          const labels: Record<number, string> = { 9: "Freshman", 10: "Sophomore", 11: "Junior", 12: "Senior" };
          setGrade(labels[active.schoolYear] ?? "");
        }
      } catch {
        // analysis not available
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [services]);

  useEffect(() => {
    getGpaProjection()
      .then((p) => setGpa(p.current?.unweighted ?? null))
      .catch(() => {});
  }, []);

  const totalCredits = analysis?.credits.total ?? 0;
  const totalRequired = 45;
  const gradProgress = Math.min(Math.round((totalCredits / totalRequired) * 100), 100);

  const progressBarBlocks = Math.floor(gradProgress / 10);
  const progressBar = "\u2588".repeat(progressBarBlocks) + "\u2591".repeat(10 - progressBarBlocks);

  return (
    <>
      <style>{`
        @media (max-width: ${breakpoints.mobile - 1}px) {
          .dash-welcome h1 { font-size: 1.5rem !important; }
          .dash-welcome p { font-size: 0.875rem !important; }
          .dash-summary-grid { grid-template-columns: 1fr 1fr !important; }
          .dash-actions-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
      <ResponsivePage>
        <GuestUpgradePrompt />

        {/* Disclaimer */}
        <div
          style={{
            padding: "16px 20px",
            marginBottom: "24px",
            backgroundColor: "#FCF5DF",
            border: "1px solid #ECBA2B",
            borderRadius: "12px",
            fontSize: "14px",
            color: "#111827",
            lineHeight: 1.5,
          }}
        >
          <strong style={{ color: "#ECBA2B" }}>Note:</strong> This is a planning tool and is not
          affiliated with or endorsed by the school district. Course offerings, graduation requirements,
          and all other information may not reflect the most current data. Always consult your school
          counselor or the official course catalog for authoritative information.
        </div>

        {/* Welcome section */}
        <div className="dash-welcome" style={{ marginBottom: "32px" }}>
          <h1
            style={{
              margin: 0,
              fontSize: "32px",
              fontWeight: 700,
              color: "var(--text-primary)",
              lineHeight: 1.2,
            }}
          >
            {isGuest
              ? "Welcome to Stevenson Course Planner \uD83D\uDC4B"
              : `Welcome back, ${displayName(user?.name)} \uD83D\uDC4B`}
          </h1>
          <p
            style={{
              margin: "8px 0 0",
              fontSize: "16px",
              color: "var(--text-secondary)",
            }}
          >
            Plan your four years, explore courses, and track your graduation progress.
          </p>
        </div>

        {/* Student summary */}
        <div
          className="dash-summary-grid"
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, 1fr)",
            gap: "16px",
            marginBottom: "32px",
          }}
        >
          <SummaryCard label="Grade Level" value={grade || "\u2014"} />
          <SummaryCard
            label="GPA"
            value={gpa !== null ? gpa.toFixed(2) : "\u2014"}
          />
          <SummaryCard
            label="Credits"
            value={`${totalCredits.toFixed(1)} / ${totalRequired}`}
          />
          <SummaryCard label="Graduation Progress" value={`${gradProgress}%`}>
            <span
              style={{
                display: "block",
                marginTop: "8px",
                fontSize: "16px",
                letterSpacing: "2px",
                fontFamily: "monospace",
                color: gradProgress >= 100 ? "var(--green, #166534)" : "var(--brand-accent)",
              }}
            >
              {progressBar}
            </span>
          </SummaryCard>
        </div>

        {/* Quick actions */}
        <div
          className="dash-actions-grid"
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(5, 1fr)",
            gap: "12px",
            marginBottom: "40px",
          }}
        >
          <ActionCard label="Explore Courses" href="/catalog" />
          <ActionCard label="Open Planner" href="/planner" />
          <ActionCard label="Graduation Requirements" href="/requirements" />
          <ActionCard label="Completed Courses" href="/completed-courses" />
          <ActionCard label="Saved Courses" href="/saved" />
        </div>

        {/* Four-Year Plan Overview */}
        <div style={{ marginBottom: "40px" }}>
          <h2
            style={{
              margin: "0 0 20px",
              fontSize: "22px",
              fontWeight: 700,
              color: "var(--text-primary)",
            }}
          >
            Your Four-Year Plan
          </h2>
          <DashboardOverview />
        </div>

        {/* Recently Saved Courses */}
        <SavedCoursesSection />
      </ResponsivePage>
    </>
  );
}

function displayName(name: string | null | undefined): string {
  if (!name) return "Student";
  if (name === "Guest") return "Student";
  return name.includes(" ") ? name.split(" ")[0] : name;
}

function SummaryCard({
  label,
  value,
  children,
}: {
  label: string;
  value: string;
  children?: React.ReactNode;
}): React.ReactElement {
  return (
    <div
      style={{
        padding: "20px",
        backgroundColor: "var(--bg-card)",
        border: "1px solid var(--border-default)",
        borderRadius: "12px",
      }}
    >
      <p
        style={{
          margin: "0 0 8px",
          fontSize: "14px",
          color: "var(--text-muted)",
        }}
      >
        {label}
      </p>
      <p
        style={{
          margin: 0,
          fontSize: "24px",
          fontWeight: 600,
          color: "var(--text-primary)",
        }}
      >
        {value}
      </p>
      {children}
    </div>
  );
}

function ActionCard({ label, href }: { label: string; href: string }): React.ReactElement {
  const [hovered, setHovered] = useState(false);

  return (
    <Link
      href={href}
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "20px 12px",
        backgroundColor: hovered ? "var(--brand-accent-hover)" : "var(--brand-accent)",
        borderRadius: "12px",
        textDecoration: "none",
        transition: "background-color 0.2s ease",
        minHeight: "56px",
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <span
        style={{
          fontSize: "15px",
          fontWeight: 500,
          color: "#ffffff",
          textAlign: "center",
          lineHeight: 1.3,
        }}
      >
        {label}
      </span>
    </Link>
  );
}
