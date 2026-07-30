"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { useServices } from "@/services/ServiceContext";
import { GuestUpgradePrompt } from "@/components/auth/GuestUpgradePrompt";
import { SavedCoursesSection } from "@/components/dashboard/SavedCoursesSection";
import { ResponsivePage } from "@/components/responsive/ResponsivePage";
import { breakpoints } from "@/lib/responsive";
import type { PlannerAnalysis } from "@/lib/plannerAnalysis";
import type { Planner } from "@/lib/planner";
import { formatCredits } from "@/lib/courseCredits";

const SLOTS_PER_SEMESTER = 7;
const SEMESTERS_PER_YEAR = 2;
const TOTAL_SLOTS_PER_YEAR = SLOTS_PER_SEMESTER * SEMESTERS_PER_YEAR;
const YEARS = [9, 10, 11, 12] as const;
const YEAR_LABELS: Record<number, string> = { 9: "Freshman", 10: "Sophomore", 11: "Junior", 12: "Senior" };

export default function Home() {
  const { user, isGuest } = useAuth();
  const services = useServices();
  const [analysis, setAnalysis] = useState<PlannerAnalysis | null>(null);
  const [planners, setPlanners] = useState<Planner[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const plannersData = await services.planner.getPlanners();
        if (cancelled) return;
        setPlanners(plannersData);

        const analysisData = await services.analysis.getAnalysis({
          planners: plannersData,
          completedCourses: [],
          resolutions: [],
          allCourses: [],
        });
        if (!cancelled) setAnalysis(analysisData);
      } catch {
        // analysis not available
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [services]);

  const totalCredits = analysis?.credits.total ?? 0;
  const totalRequired = 45;
  const gradProgress = Math.min(Math.round((totalCredits / totalRequired) * 100), 100);

  const totalPlannedCourses = planners.reduce((sum, p) => sum + p.plannedCourses.length, 0);
  const totalSlots = YEARS.length * TOTAL_SLOTS_PER_YEAR;
  const plannerCompletion = Math.min(Math.round((totalPlannedCourses / totalSlots) * 100), 100);

  function yearCompletion(year: number): number {
    const planner = planners.find((p) => p.schoolYear === year);
    const filled = planner ? planner.plannedCourses.length : 0;
    return Math.min(Math.round((filled / TOTAL_SLOTS_PER_YEAR) * 100), 100);
  }

  return (
    <>
      <style>{`
        @media (max-width: ${breakpoints.mobile - 1}px) {
          .dash-welcome h1 { font-size: 1.5rem !important; }
          .dash-welcome p { font-size: 0.875rem !important; }
          .dash-progress-grid { grid-template-columns: 1fr 1fr !important; }
          .dash-actions-grid { grid-template-columns: 1fr 1fr !important; }
          .dash-year-grid { grid-template-columns: 1fr !important; }
        }
        @media (min-width: ${breakpoints.mobile}px) {
          .dash-actions-grid { grid-template-columns: repeat(5, 1fr) !important; }
          .dash-year-grid { grid-template-columns: repeat(4, 1fr) !important; }
        }
      `}</style>
      <ResponsivePage>
        <GuestUpgradePrompt />

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
            Plan your courses, track graduation progress, and explore opportunities.
          </p>
        </div>

        {!loading && (
          <>
            <section style={{ marginBottom: "40px" }}>
              <h2
                style={{
                  margin: "0 0 16px",
                  fontSize: "20px",
                  fontWeight: 700,
                  color: "var(--text-primary)",
                }}
              >
                Quick Actions
              </h2>
              <div
                className="dash-actions-grid"
                style={{
                  display: "grid",
                  gap: "12px",
                }}
              >
                <ActionCard label="Planner" href="/planner" />
                <ActionCard label="Explore Courses" href="/catalog" />
                <ActionCard label="Graduation Requirements" href="/requirements" />
                <ActionCard label="Completed Courses" href="/completed-courses" />
                <ActionCard label="Saved Courses" href="/saved" />
              </div>
            </section>

            <section style={{ marginBottom: "40px" }}>
              <h2
                style={{
                  margin: "0 0 16px",
                  fontSize: "20px",
                  fontWeight: 700,
                  color: "var(--text-primary)",
                }}
              >
                Graduation Progress
              </h2>
              <div
                className="dash-progress-grid"
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(3, 1fr)",
                  gap: "16px",
                }}
              >
                <SummaryCard label="Completed Credits" value={`${formatCredits(totalCredits)} / ${formatCredits(totalRequired)}`} />
                <SummaryCard label="Graduation Progress" value={`${gradProgress}%`}>
                  <ProgressBar value={gradProgress} />
                </SummaryCard>
                <SummaryCard label="Planner Completion" value={`${plannerCompletion}%`}>
                  <ProgressBar value={plannerCompletion} />
                </SummaryCard>
              </div>
            </section>

            <section style={{ marginBottom: "40px" }}>
              <h2
                style={{
                  margin: "0 0 16px",
                  fontSize: "20px",
                  fontWeight: 700,
                  color: "var(--text-primary)",
                }}
              >
                Planner Completion
              </h2>
              <div
                className="dash-year-grid"
                style={{
                  display: "grid",
                  gap: "16px",
                }}
              >
                {YEARS.map((year) => (
                  <YearCard
                    key={year}
                    year={year}
                    label={YEAR_LABELS[year]}
                    percentage={yearCompletion(year)}
                  />
                ))}
              </div>
            </section>

            <section style={{ marginBottom: "40px" }}>
              <h2
                style={{
                  margin: "0 0 16px",
                  fontSize: "20px",
                  fontWeight: 700,
                  color: "var(--text-primary)",
                }}
              >
                Recent Activity
              </h2>
              <SavedCoursesSection />
            </section>
          </>
        )}
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
      {children && <div style={{ marginTop: "12px" }}>{children}</div>}
    </div>
  );
}

function ProgressBar({ value }: { value: number }): React.ReactElement {
  return (
    <div
      style={{
        width: "100%",
        height: "8px",
        backgroundColor: "var(--border-default)",
        borderRadius: "4px",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          width: `${value}%`,
          height: "100%",
          backgroundColor: value >= 100 ? "#166534" : "var(--brand-accent)",
          borderRadius: "4px",
          transition: "width 0.3s ease",
        }}
      />
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
        padding: "24px 12px",
        backgroundColor: hovered ? "var(--brand-accent-hover)" : "var(--brand-accent)",
        borderRadius: "12px",
        textDecoration: "none",
        transition: "background-color 0.2s ease",
        minHeight: "64px",
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <span
        style={{
          fontSize: "16px",
          fontWeight: 600,
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

function YearCard({
  year,
  label,
  percentage,
}: {
  year: number;
  label: string;
  percentage: number;
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
          margin: "0 0 12px",
          fontSize: "28px",
          fontWeight: 700,
          color: "var(--text-primary)",
        }}
      >
        {percentage}%
      </p>
      <ProgressBar value={percentage} />
      <Link
        href={`/planner/${year}`}
        style={{
          display: "inline-block",
          marginTop: "12px",
          fontSize: "14px",
          fontWeight: 500,
          color: "var(--brand-accent)",
          textDecoration: "none",
        }}
      >
        Open Planner &rarr;
      </Link>
    </div>
  );
}
