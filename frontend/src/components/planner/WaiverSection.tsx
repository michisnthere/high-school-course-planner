import React, { useState } from "react";
import type { PeWaiver } from "@/lib/plannerWaivers";
import {
  computeWaiverEligibility,
  computeAthleticVariantEligibility,
  getCreditBearingCount,
} from "@/lib/plannerWaivers";
import type { PlannedCourse } from "@/lib/planner";

type WaiverSectionProps = {
  grade: number;
  plannedCourses: PlannedCourse[];
  waivers: PeWaiver[];
  onAddWaiver: (waiver: PeWaiver) => void;
  onRemoveWaiver: (index: number) => void;
};

function waiverLabel(waiver: PeWaiver): string {
  if (waiver.type === "academic") return "Academic PE Waiver";
  if (waiver.type === "marching-band") return "Marching Band PE Waiver";
  if (waiver.variant === "non-credit") return "Athletic PE Waiver (Non-Credit)";
  return "Athletic PE Waiver (Credit)";
}

export function WaiverSection({
  grade,
  plannedCourses,
  waivers,
  onAddWaiver,
  onRemoveWaiver,
}: WaiverSectionProps): React.ReactElement {
  const [showAddFlow, setShowAddFlow] = useState(false);
  const [showSportQuestion, setShowSportQuestion] = useState(false);
  const [showSportCount, setShowSportCount] = useState(false);
  const [confirmMessage, setConfirmMessage] = useState<string | null>(null);
  const [academicConfirmed, setAcademicConfirmed] = useState(false);
  const [showBandModal, setShowBandModal] = useState(false);

  const creditBearing = getCreditBearingCount(plannedCourses);
  const eligibility = computeWaiverEligibility(grade, creditBearing, plannedCourses);

  const hasWaiver = waivers.length > 0;

  const handleAddClick = () => {
    setShowAddFlow(true);
    setShowSportQuestion(false);
    setShowSportCount(false);
    setConfirmMessage(null);
    setAcademicConfirmed(false);
  };

  const handleCancel = () => {
    setShowAddFlow(false);
    setShowSportQuestion(false);
    setShowSportCount(false);
    setConfirmMessage(null);
    setAcademicConfirmed(false);
  };

  const handleAcademicConfirm = () => {
    onAddWaiver({ type: "academic" });
    handleCancel();
  };

  const handleMarchingBandConfirm = () => {
    onAddWaiver({ type: "marching-band" });
    handleCancel();
  };

  const handleAthleticStart = () => {
    setShowSportQuestion(true);
  };

  const handleSportAnswer = (yes: boolean) => {
    if (!yes) {
      handleCancel();
      return;
    }
    setShowSportCount(true);
  };

  const handleSportCount = (count: "one" | "two-or-more") => {
    const result = computeAthleticVariantEligibility(count, creditBearing);
    if (!result.eligible) {
      setConfirmMessage(result.reason);
      return;
    }
    onAddWaiver({ type: "athletic", variant: result.variant! });
    handleCancel();
  };

  return (
    <div
      style={{
        marginTop: "24px",
        paddingTop: "20px",
        borderTop: "1px solid var(--border-default)",
      }}
    >
      <h3
        style={{
          margin: "0 0 12px",
          fontSize: "16px",
          fontWeight: 700,
          color: "#275D38",
        }}
      >
        Waivers
      </h3>

      {!hasWaiver ? (
        <p style={{ margin: "0 0 12px", fontSize: "14px", color: "var(--text-secondary)" }}>
          No waivers applied.
        </p>
      ) : (
        <ul
          style={{
            listStyle: "none",
            margin: "0 0 12px",
            padding: 0,
            display: "flex",
            flexDirection: "column",
            gap: "6px",
          }}
        >
          {waivers.map((w, i) => (
            <li
              key={i}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                fontSize: "14px",
                color: "var(--brand-accent)",
              }}
            >
              <span>✓ {waiverLabel(w)}</span>
              <button
                onClick={() => onRemoveWaiver(i)}
                style={{
                  background: "none",
                  border: "1px solid var(--border-default)",
                  borderRadius: "4px",
                  color: "var(--text-secondary)",
                  fontSize: "12px",
                  padding: "2px 8px",
                  cursor: "pointer",
                }}
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}

      {!hasWaiver && !showAddFlow && (
        <button
          onClick={handleAddClick}
          style={{
            backgroundColor: "var(--brand-accent)",
            border: "none",
            borderRadius: "8px",
            color: "#ffffff",
            fontSize: "13px",
            fontWeight: 600,
            padding: "8px 16px",
            cursor: "pointer",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = "var(--brand-accent-hover)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = "var(--brand-accent)";
          }}
        >
          + Add Waiver
        </button>
      )}

      {!hasWaiver && showAddFlow && !confirmMessage && !showSportQuestion && !showSportCount && (
        <div
          style={{
            padding: "12px",
            backgroundColor: "#374151",
            borderRadius: "8px",
            display: "flex",
            flexDirection: "column",
            gap: "12px",
            fontSize: "13px",
          }}
        >
          {/* Academic waiver option */}
          <div>
            <p style={{ margin: "0 0 2px", fontWeight: 600, color: "#d1d5db" }}>
              Academic Waiver
            </p>
            <p style={{ margin: "0 0 6px", color: eligibility.academic.eligible ? "var(--brand-accent)" : "#9ca3af" }}>
              {eligibility.academic.reason}
            </p>
            {eligibility.academic.eligible && (
              <>
                <label
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: "6px",
                    color: "#d1d5db",
                    marginBottom: "8px",
                    cursor: "pointer",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={academicConfirmed}
                    onChange={(e) => setAcademicConfirmed(e.target.checked)}
                    style={{ marginTop: "2px" }}
                  />
                  <span>
                    I confirm these courses are required for graduation and/or post-secondary admission.
                  </span>
                </label>
                <div style={{ display: "flex", gap: "8px" }}>
                  <button
                    onClick={handleAcademicConfirm}
                    disabled={!academicConfirmed}
                    style={{
                      background: "none",
                      border: `1px solid ${academicConfirmed ? "var(--brand-accent)" : "var(--border-default)"}`,
                      borderRadius: "4px",
                      color: academicConfirmed ? "var(--brand-accent)" : "var(--text-secondary)",
                      fontSize: "12px",
                      padding: "4px 12px",
                      cursor: academicConfirmed ? "pointer" : "not-allowed",
                    }}
                  >
                    Apply Academic Waiver
                  </button>
                  <button
                    onClick={handleAthleticStart}
                    style={{
                      background: "none",
                      border: "1px solid #6b7280",
                      borderRadius: "4px",
                      color: "#d1d5db",
                      fontSize: "12px",
                      padding: "4px 12px",
                      cursor: "pointer",
                    }}
                  >
                    No (check Athletic)
                  </button>
                </div>
              </>
            )}
          </div>

          <div style={{ borderTop: "1px solid #4b5563" }} />

          {/* Athletic waiver option */}
          <div>
            <p style={{ margin: "0 0 2px", fontWeight: 600, color: "#d1d5db" }}>
              Athletic Waiver
            </p>
            <p style={{ margin: "0 0 6px", color: eligibility.athletic.eligible ? "var(--brand-accent)" : "#9ca3af" }}>
              {eligibility.athletic.reason}
            </p>
            {eligibility.athletic.eligible && (
              <button
                onClick={handleAthleticStart}
                style={{
                  background: "none",
                  border: "1px solid #6b7280",
                  borderRadius: "4px",
                  color: "#d1d5db",
                  fontSize: "12px",
                  padding: "4px 12px",
                  cursor: "pointer",
                }}
              >
                Apply Athletic Waiver
              </button>
            )}
          </div>

          <div style={{ borderTop: "1px solid #4b5563" }} />

          {/* Marching Band waiver option */}
          <div>
            <p style={{ margin: "0 0 2px", fontWeight: 600, color: "#d1d5db" }}>
              Marching Band Waiver
            </p>
            <p style={{ margin: "0 0 2px", color: "#9ca3af" }}>
              Available Grades 9–12
            </p>
            <p style={{ margin: "0 0 6px", color: eligibility.marchingBand.eligible ? "var(--brand-accent)" : "var(--brand-accent-hover)" }}>
              {eligibility.marchingBand.reason}
            </p>
            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
              {eligibility.marchingBand.eligible && (
                <button
                  onClick={handleMarchingBandConfirm}
                  style={{
                    background: "none",
                    border: "1px solid #6b7280",
                    borderRadius: "4px",
                    color: "#d1d5db",
                    fontSize: "12px",
                    padding: "4px 12px",
                    cursor: "pointer",
                  }}
                >
                  Apply Marching Band Waiver
                </button>
              )}
              <button
                onClick={() => setShowBandModal(true)}
                style={{
                  background: "none",
                  border: "1px solid #6b7280",
                  borderRadius: "4px",
                  color: "#93c5fd",
                  fontSize: "12px",
                  padding: "4px 12px",
                  cursor: "pointer",
                }}
              >
                Learn More
              </button>
            </div>
          </div>

          <button
            onClick={handleCancel}
            style={{
              background: "none",
              border: "1px solid #6b7280",
              borderRadius: "4px",
              color: "#9ca3af",
              fontSize: "12px",
              padding: "4px 12px",
              cursor: "pointer",
              alignSelf: "flex-start",
            }}
          >
            Cancel
          </button>
        </div>
      )}

      {!hasWaiver && showAddFlow && showSportQuestion && !showSportCount && (
        <div
          style={{
            padding: "12px",
            backgroundColor: "#374151",
            borderRadius: "8px",
            fontSize: "13px",
          }}
        >
          <p style={{ margin: "0 0 8px", color: "#d1d5db" }}>
            Are you participating in a JV or Varsity sport?
          </p>
          <div style={{ display: "flex", gap: "8px" }}>
            <button
              onClick={() => handleSportAnswer(true)}
              style={{
                background: "none",
                border: "1px solid #6b7280",
                borderRadius: "4px",
                color: "#d1d5db",
                fontSize: "12px",
                padding: "4px 12px",
                cursor: "pointer",
              }}
            >
              Yes
            </button>
            <button
              onClick={() => handleSportAnswer(false)}
              style={{
                background: "none",
                border: "1px solid #6b7280",
                borderRadius: "4px",
                color: "#9ca3af",
                fontSize: "12px",
                padding: "4px 12px",
                cursor: "pointer",
              }}
            >
              No
            </button>
            <button
              onClick={handleCancel}
              style={{
                background: "none",
                border: "1px solid #6b7280",
                borderRadius: "4px",
                color: "#9ca3af",
                fontSize: "12px",
                padding: "4px 12px",
                cursor: "pointer",
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {!hasWaiver && showAddFlow && showSportCount && (
        <div
          style={{
            padding: "12px",
            backgroundColor: "#374151",
            borderRadius: "8px",
            fontSize: "13px",
          }}
        >
          <p style={{ margin: "0 0 8px", color: "#d1d5db" }}>
            How many JV/Varsity sports do you participate in?
          </p>
          <div style={{ display: "flex", gap: "8px" }}>
            <button
              onClick={() => handleSportCount("one")}
              style={{
                background: "none",
                border: "1px solid #6b7280",
                borderRadius: "4px",
                color: "#d1d5db",
                fontSize: "12px",
                padding: "4px 12px",
                cursor: "pointer",
              }}
            >
              One sport
            </button>
            <button
              onClick={() => handleSportCount("two-or-more")}
              style={{
                background: "none",
                border: "1px solid #6b7280",
                borderRadius: "4px",
                color: "#d1d5db",
                fontSize: "12px",
                padding: "4px 12px",
                cursor: "pointer",
              }}
            >
              Two or more sports
            </button>
            <button
              onClick={handleCancel}
              style={{
                background: "none",
                border: "1px solid #6b7280",
                borderRadius: "4px",
                color: "#9ca3af",
                fontSize: "12px",
                padding: "4px 12px",
                cursor: "pointer",
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {!hasWaiver && showAddFlow && confirmMessage && (
        <div
          style={{
            padding: "12px",
            backgroundColor: "#374151",
            borderRadius: "8px",
            fontSize: "13px",
            color: "var(--brand-accent)",
          }}
        >
          <p style={{ margin: "0 0 8px" }}>{confirmMessage}</p>
          <button
            onClick={handleCancel}
            style={{
              background: "none",
              border: "1px solid #6b7280",
              borderRadius: "4px",
              color: "#9ca3af",
              fontSize: "12px",
              padding: "4px 12px",
              cursor: "pointer",
            }}
          >
            OK
          </button>
        </div>
      )}

      {/* Marching Band info modal */}
      {showBandModal && (
        <div
          onClick={() => setShowBandModal(false)}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 1000,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: "rgba(0,0,0,0.6)",
            padding: "24px",
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              maxWidth: "480px",
              width: "100%",
              backgroundColor: "#1f2937",
              border: "1px solid #374151",
              borderRadius: "16px",
              padding: "28px",
              fontFamily: `-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif`,
            }}
          >
            <h3
              style={{
                margin: "0 0 16px",
                fontSize: "20px",
                fontWeight: 700,
                color: "#ffffff",
              }}
            >
              Marching Band PE Waiver
            </h3>

            <p
              style={{
                margin: "0 0 16px",
                fontSize: "14px",
                color: "#d1d5db",
                lineHeight: 1.6,
              }}
            >
              Any student in grades 9–12 who is enrolled in one of these courses
              and is a member of the Marching Band may waive their Physical
              Education requirement during first semester.
            </p>

            <p
              style={{
                margin: "0 0 8px",
                fontSize: "14px",
                fontWeight: 600,
                color: "#ffffff",
              }}
            >
              Eligible courses:
            </p>

            <ul
              style={{
                margin: "0 0 20px",
                padding: "0 0 0 20px",
                fontSize: "14px",
                color: "#d1d5db",
                lineHeight: 1.8,
              }}
            >
              <li>Freshman Band</li>
              <li>Wind Ensemble</li>
              <li>Symphonic Band</li>
              <li>Wind Symphony</li>
              <li>Color Guard</li>
            </ul>

            <button
              onClick={() => setShowBandModal(false)}
              style={{
                background: "none",
                border: "1px solid #6b7280",
                borderRadius: "6px",
                color: "#d1d5db",
                fontSize: "13px",
                padding: "6px 16px",
                cursor: "pointer",
              }}
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
