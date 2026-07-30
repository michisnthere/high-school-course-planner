import React, { useState } from "react";
import { computeWaiverEligibility, computeAthleticVariantEligibility, getCreditBearingCount } from "@/lib/plannerWaivers";
import type { PlannedCourse } from "@/lib/planner";
import type { RequirementResolution } from "@/lib/api";

type WaiverVariant = "academic" | "athletic" | "marching-band";

type WaiverSectionProps = {
  grade: number;
  plannedCourses: PlannedCourse[];
  resolutions: RequirementResolution[];
  onAddResolution: (data: { type: string; courseId?: number; metadata?: Record<string, unknown> }) => void;
  onRemoveResolution: (id: number) => void;
};

const VARIANT_INFO: Record<WaiverVariant, { label: string; subtitle: string }> = {
  academic: { label: "Academic PE Waiver", subtitle: "Only available to Seniors with 6 credit-bearing classes" },
  athletic: { label: "Athletic PE Waiver", subtitle: "Available to Juniors and Seniors" },
  "marching-band": { label: "Marching Band PE Waiver", subtitle: "Available Grades 9–12" },
};

function findVariant(r: RequirementResolution): WaiverVariant | null {
  if (r.type !== "pe_waiver") return null;
  const v = r.metadata?.variant as string | undefined;
  if (v === "academic" || v === "athletic" || v === "marching-band") return v;
  return null;
}

function athleticSubLabel(r: RequirementResolution): string {
  const sub = r.metadata?.athleticVariant as string;
  return sub === "credit" ? " (Credit)" : " (Non-Credit)";
}

export function WaiverSection({
  grade,
  plannedCourses,
  resolutions,
  onAddResolution,
  onRemoveResolution,
}: WaiverSectionProps): React.ReactElement {
  const [addingVariant, setAddingVariant] = useState<WaiverVariant | null>(null);
  const [academicConfirmed, setAcademicConfirmed] = useState(false);
  const [showSportQuestion, setShowSportQuestion] = useState(false);
  const [confirmMessage, setConfirmMessage] = useState<string | null>(null);
  const [showBandModal, setShowBandModal] = useState(false);

  const creditBearing = getCreditBearingCount(plannedCourses);
  const eligibility = computeWaiverEligibility(grade, creditBearing, plannedCourses);

  const yearWaivers = resolutions.filter(
    (r) => r.type === "pe_waiver" && r.metadata?.year === grade
  );
  const hasVariant = (v: WaiverVariant) => yearWaivers.some((r) => findVariant(r) === v);

  const handleAdd = (v: WaiverVariant) => {
    setAddingVariant(v);
    setAcademicConfirmed(false);
    setShowSportQuestion(false);
    setConfirmMessage(null);
  };

  const handleCancel = () => {
    setAddingVariant(null);
    setAcademicConfirmed(false);
    setShowSportQuestion(false);
    setConfirmMessage(null);
  };

  const handleAcademicConfirm = () => {
    onAddResolution({ type: "pe_waiver", metadata: { variant: "academic", year: grade } });
    handleCancel();
  };

  const handleMarchingBandConfirm = () => {
    onAddResolution({ type: "pe_waiver", metadata: { variant: "marching-band", year: grade } });
    handleCancel();
  };

  const handleSportAnswer = (yes: boolean) => {
    if (!yes) { handleCancel(); return; }
    setShowSportQuestion(false);
    const result = computeAthleticVariantEligibility("one", creditBearing);
    if (!result.eligible) {
      setConfirmMessage(result.reason);
      return;
    }
    onAddResolution({ type: "pe_waiver", metadata: { variant: "athletic", athleticVariant: result.variant, year: grade } });
    handleCancel();
  };

  return (
    <div style={{ marginTop: "24px", paddingTop: "20px", borderTop: "1px solid var(--border-default)" }}>
      <h3 style={{ margin: "0 0 12px", fontSize: "16px", fontWeight: 700, color: "#275D38" }}>
        PE Waivers
      </h3>

      <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
        {(["academic", "athletic", "marching-band"] as WaiverVariant[]).map((variant) => {
          const applied = hasVariant(variant);
          const active = addingVariant === variant;
          const info = VARIANT_INFO[variant];
          const elig =
            variant === "academic" ? eligibility.academic :
            variant === "athletic" ? eligibility.athletic :
            eligibility.marchingBand;

          return (
            <div
              key={variant}
              style={{
                padding: "10px 12px",
                backgroundColor: applied ? "rgba(5, 150, 105, 0.08)" : "#1f2937",
                borderRadius: "8px",
                border: applied ? "1px solid rgba(5, 150, 105, 0.3)" : "1px solid #374151",
              }}
            >
              {applied ? (
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px" }}>
                  <div>
                    <span style={{ fontSize: "13px", fontWeight: 600, color: "var(--brand-accent)" }}>
                      ✓ {info.label}{variant === "athletic" ? athleticSubLabel(yearWaivers.find((r) => findVariant(r) === "athletic")!) : ""}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => onRemoveResolution(yearWaivers.find((r) => findVariant(r) === variant)!.id)}
                    style={{
                      background: "none",
                      border: "1px solid var(--border-default)",
                      borderRadius: "4px",
                      color: "var(--text-secondary)",
                      fontSize: "11px",
                      padding: "2px 8px",
                      cursor: "pointer",
                      whiteSpace: "nowrap",
                    }}
                  >
                    Remove
                  </button>
                </div>
              ) : active ? (
                <AddVariantFlow
                  variant={variant}
                  grade={grade}
                  eligibility={eligibility}
                  academicConfirmed={academicConfirmed}
                  setAcademicConfirmed={setAcademicConfirmed}
                  showSportQuestion={showSportQuestion}
                  setShowSportQuestion={setShowSportQuestion}
                  confirmMessage={confirmMessage}
                  setConfirmMessage={setConfirmMessage}
                  creditBearing={creditBearing}
                  onConfirm={() => {
                    if (variant === "academic") handleAcademicConfirm();
                    else if (variant === "marching-band") handleMarchingBandConfirm();
                    else handleSportAnswer(true);
                  }}
                  onCancel={handleCancel}
                  showBandModal={showBandModal}
                  setShowBandModal={setShowBandModal}
                  onAddResolution={onAddResolution}
                />
              ) : (
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px" }}>
                  <div>
                    <div style={{ fontSize: "13px", fontWeight: 600, color: "#d1d5db" }}>{info.label}</div>
                    <div style={{ fontSize: "11px", color: elig.eligible ? "var(--brand-accent)" : "#6b7280", marginTop: "2px" }}>
                      {elig.reason}
                    </div>
                  </div>
                  <button
                    type="button"
                    disabled={!elig.eligible}
                    onClick={() => handleAdd(variant)}
                    style={{
                      background: "none",
                      border: `1px solid ${elig.eligible ? "#6b7280" : "var(--border-default)"}`,
                      borderRadius: "4px",
                      color: elig.eligible ? "#d1d5db" : "var(--text-muted)",
                      fontSize: "11px",
                      padding: "4px 10px",
                      cursor: elig.eligible ? "pointer" : "not-allowed",
                      whiteSpace: "nowrap",
                      opacity: elig.eligible ? 1 : 0.5,
                    }}
                  >
                    Apply
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {showBandModal && (
        <div
          onClick={() => setShowBandModal(false)}
          style={{
            position: "fixed", inset: 0, zIndex: 1000,
            display: "flex", alignItems: "center", justifyContent: "center",
            backgroundColor: "rgba(0,0,0,0.6)", padding: "24px",
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              maxWidth: "480px", width: "100%",
              backgroundColor: "#1f2937", border: "1px solid #374151",
              borderRadius: "16px", padding: "28px",
            }}
          >
            <h3 style={{ margin: "0 0 16px", fontSize: "20px", fontWeight: 700, color: "#ffffff" }}>
              Marching Band PE Waiver
            </h3>
            <p style={{ margin: "0 0 16px", fontSize: "14px", color: "#d1d5db", lineHeight: 1.6 }}>
              Any student in grades 9–12 who is enrolled in one of these courses
              and is a member of the Marching Band may waive their Physical
              Education requirement during first semester.
            </p>
            <p style={{ margin: "0 0 8px", fontSize: "14px", fontWeight: 600, color: "#ffffff" }}>
              Eligible courses:
            </p>
            <ul style={{ margin: "0 0 20px", padding: "0 0 0 20px", fontSize: "14px", color: "#d1d5db", lineHeight: 1.8 }}>
              <li>Freshman Band</li>
              <li>Wind Ensemble</li>
              <li>Symphonic Band</li>
              <li>Wind Symphony</li>
              <li>Color Guard</li>
            </ul>
            <button
              type="button"
              onClick={() => setShowBandModal(false)}
              style={{
                background: "none", border: "1px solid #6b7280", borderRadius: "6px",
                color: "#d1d5db", fontSize: "13px", padding: "6px 16px", cursor: "pointer",
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

function AddVariantFlow({
  variant, grade, eligibility, academicConfirmed, setAcademicConfirmed,
  showSportQuestion, setShowSportQuestion, confirmMessage, setConfirmMessage,
  creditBearing, onConfirm, onCancel, showBandModal, setShowBandModal,
  onAddResolution,
}: {
  variant: WaiverVariant;
  grade: number;
  eligibility: ReturnType<typeof computeWaiverEligibility>;
  academicConfirmed: boolean;
  setAcademicConfirmed: (v: boolean) => void;
  showSportQuestion: boolean;
  setShowSportQuestion: (v: boolean) => void;
  confirmMessage: string | null;
  setConfirmMessage: (v: string | null) => void;
  creditBearing: ReturnType<typeof getCreditBearingCount>;
  onConfirm: () => void;
  onCancel: () => void;
  showBandModal: boolean;
  setShowBandModal: (v: boolean) => void;
  onAddResolution: (data: { type: string; courseId?: number; metadata?: Record<string, unknown> }) => void;
}): React.ReactElement | null {
  if (variant === "academic") {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
        <label style={{ display: "flex", alignItems: "flex-start", gap: "6px", color: "#d1d5db", fontSize: "12px", cursor: "pointer" }}>
          <input type="checkbox" checked={academicConfirmed} onChange={(e) => setAcademicConfirmed(e.target.checked)} style={{ marginTop: "2px" }} />
          <span>I confirm these courses are required for graduation and/or post-secondary admission.</span>
        </label>
        <div style={{ display: "flex", gap: "8px" }}>
          <button type="button" disabled={!academicConfirmed} onClick={onConfirm}
            style={{
              background: "none", border: `1px solid ${academicConfirmed ? "var(--brand-accent)" : "var(--border-default)"}`,
              borderRadius: "4px", color: academicConfirmed ? "var(--brand-accent)" : "var(--text-secondary)",
              fontSize: "11px", padding: "4px 10px", cursor: academicConfirmed ? "pointer" : "not-allowed",
            }}>
            Apply Waiver
          </button>
          <button type="button" onClick={onCancel}
            style={{ background: "none", border: "1px solid #6b7280", borderRadius: "4px", color: "#9ca3af", fontSize: "11px", padding: "4px 10px", cursor: "pointer" }}>
            Cancel
          </button>
        </div>
      </div>
    );
  }

  if (variant === "marching-band") {
    const elig = eligibility.marchingBand;
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
        <div style={{ fontSize: "12px", color: elig.eligible ? "var(--brand-accent)" : "#6b7280" }}>
          {elig.reason}
        </div>
        {elig.eligible && (
          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
            <button type="button" onClick={onConfirm}
              style={{ background: "none", border: "1px solid #6b7280", borderRadius: "4px", color: "#d1d5db", fontSize: "11px", padding: "4px 10px", cursor: "pointer" }}>
              Apply Waiver
            </button>
            <button type="button" onClick={() => setShowBandModal(true)}
              style={{ background: "none", border: "1px solid #6b7280", borderRadius: "4px", color: "#93c5fd", fontSize: "11px", padding: "4px 10px", cursor: "pointer" }}>
              Learn More
            </button>
          </div>
        )}
        <button type="button" onClick={onCancel}
          style={{ background: "none", border: "1px solid #6b7280", borderRadius: "4px", color: "#9ca3af", fontSize: "11px", padding: "4px 10px", cursor: "pointer", alignSelf: "flex-start" }}>
          Cancel
        </button>
      </div>
    );
  }

  if (variant === "athletic") {
    if (confirmMessage) {
      return (
        <div>
          <p style={{ margin: "0 0 8px", fontSize: "12px", color: "var(--brand-accent)" }}>{confirmMessage}</p>
          <button type="button" onClick={onCancel}
            style={{ background: "none", border: "1px solid #6b7280", borderRadius: "4px", color: "#9ca3af", fontSize: "11px", padding: "4px 10px", cursor: "pointer" }}>
            OK
          </button>
        </div>
      );
    }

    if (showSportQuestion) {
      return (
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          <p style={{ margin: 0, fontSize: "12px", color: "#d1d5db" }}>Are you participating in a JV or Varsity sport?</p>
          <div style={{ display: "flex", gap: "8px" }}>
            <button type="button" onClick={() => { setShowSportQuestion(false); onConfirm(); }}
              style={{ background: "none", border: "1px solid #6b7280", borderRadius: "4px", color: "#d1d5db", fontSize: "11px", padding: "4px 10px", cursor: "pointer" }}>
              Yes
            </button>
            <button type="button" onClick={onCancel}
              style={{ background: "none", border: "1px solid #6b7280", borderRadius: "4px", color: "#9ca3af", fontSize: "11px", padding: "4px 10px", cursor: "pointer" }}>
              No
            </button>
          </div>
        </div>
      );
    }

    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
        <div style={{ fontSize: "12px", color: "var(--brand-accent)" }}>
          How many JV/Varsity sports do you participate in?
        </div>
        <div style={{ display: "flex", gap: "8px" }}>
          {(["one", "two-or-more"] as const).map((count) => (
            <button key={count} type="button"
              onClick={() => {
                const result = computeAthleticVariantEligibility(count, creditBearing);
                if (!result.eligible) { setConfirmMessage(result.reason); return; }
                onAddResolution({ type: "pe_waiver", metadata: { variant: "athletic", athleticVariant: result.variant, year: grade } });
              }}
              style={{ background: "none", border: "1px solid #6b7280", borderRadius: "4px", color: "#d1d5db", fontSize: "11px", padding: "4px 10px", cursor: "pointer" }}>
              {count === "one" ? "One sport" : "Two or more sports"}
            </button>
          ))}
          <button type="button" onClick={onCancel}
            style={{ background: "none", border: "1px solid #6b7280", borderRadius: "4px", color: "#9ca3af", fontSize: "11px", padding: "4px 10px", cursor: "pointer" }}>
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return null;
}
