import React, { useState } from "react";
import type { PeWaiver } from "@/lib/plannerWaivers";
import {
  computeWaiverEligibility,
  computeAthleticVariantEligibility,
  getCreditBearingCount,
  type WaiverEligibility,
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

  const creditBearing = getCreditBearingCount(plannedCourses);
  const eligibility = computeWaiverEligibility(grade, creditBearing);

  const handleAddClick = () => {
    setShowAddFlow(true);
    setShowSportQuestion(false);
    setShowSportCount(false);
    setConfirmMessage(null);
  };

  const handleCancel = () => {
    setShowAddFlow(false);
    setShowSportQuestion(false);
    setShowSportCount(false);
    setConfirmMessage(null);
  };

  const handleAcademicConfirm = () => {
    onAddWaiver({ type: "academic" });
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
        borderTop: "1px solid #374151",
      }}
    >
      <h3
        style={{
          margin: "0 0 12px",
          fontSize: "16px",
          fontWeight: 700,
          color: "#ffffff",
        }}
      >
        Waivers
      </h3>

      {waivers.length === 0 ? (
        <p style={{ margin: "0 0 12px", fontSize: "14px", color: "#9ca3af" }}>
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
                color: "#22c55e",
              }}
            >
              <span>✓ {waiverLabel(w)}</span>
              <button
                onClick={() => onRemoveWaiver(i)}
                style={{
                  background: "none",
                  border: "1px solid #6b7280",
                  borderRadius: "4px",
                  color: "#9ca3af",
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

      {!showAddFlow ? (
        <button
          onClick={handleAddClick}
          style={{
            background: "none",
            border: "1px solid #6b7280",
            borderRadius: "6px",
            color: "#d1d5db",
            fontSize: "13px",
            padding: "6px 14px",
            cursor: "pointer",
          }}
        >
          + Add Waiver
        </button>
      ) : confirmMessage ? (
        <div
          style={{
            padding: "12px",
            backgroundColor: "#374151",
            borderRadius: "8px",
            fontSize: "13px",
            color: "#fbbf24",
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
      ) : showSportCount ? (
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
      ) : showSportQuestion ? (
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
      ) : (
        <div
          style={{
            padding: "12px",
            backgroundColor: "#374151",
            borderRadius: "8px",
            display: "flex",
            flexDirection: "column",
            gap: "6px",
            fontSize: "13px",
          }}
        >
          {eligibility.academic.eligible && (
            <div>
              <p style={{ margin: "0 0 4px", color: "#22c55e" }}>
                {eligibility.academic.reason}
              </p>
              <p style={{ margin: "0 0 8px", color: "#d1d5db" }}>
                Do you want to apply an Academic PE Waiver?
              </p>
              <div style={{ display: "flex", gap: "8px" }}>
                <button
                  onClick={handleAcademicConfirm}
                  style={{
                    background: "none",
                    border: "1px solid #22c55e",
                    borderRadius: "4px",
                    color: "#22c55e",
                    fontSize: "12px",
                    padding: "4px 12px",
                    cursor: "pointer",
                  }}
                >
                  Yes
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
          {eligibility.athletic.eligible && !eligibility.academic.eligible && (
            <div>
              <p style={{ margin: "0 0 4px", color: "#22c55e" }}>
                {eligibility.athletic.reason}
              </p>
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
            </div>
          )}
          {!eligibility.academic.eligible && !eligibility.athletic.eligible && (
            <div>
              <p style={{ margin: "0 0 4px", color: "#9ca3af" }}>
                {eligibility.academic.reason}
              </p>
              <p style={{ margin: 0, color: "#9ca3af" }}>
                {eligibility.athletic.reason}
              </p>
            </div>
          )}
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
              marginTop: "4px",
            }}
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  );
}
