import React, { useState } from "react";
import {
  computeWaiverEligibility,
  computeAthleticVariantEligibility,
  getCreditBearingCount,
  getAvailableWaiverVariants,
  ALL_WAIVER_VARIANTS,
} from "@/lib/plannerWaivers";
import type { WaiverVariant } from "@/lib/plannerWaivers";
import type { PlannedCourse } from "@/lib/planner";
import type { RequirementResolution } from "@/lib/api";

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

// Existing app palette accents preserved per waiver type.
const VARIANT_ACCENT: Record<WaiverVariant, string> = {
  academic: "#275D38",
  athletic: "#ECBA2B",
  "marching-band": "#14b8a6",
};

function hexToRgba(hex: string, alpha: number): string {
  const value = hex.replace("#", "");
  const r = parseInt(value.slice(0, 2), 16);
  const g = parseInt(value.slice(2, 4), 16);
  const b = parseInt(value.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

// Light-tinted action buttons with dark text for readability.
function waiverButtonStyle(accent: string, enabled = true): React.CSSProperties {
  return {
    background: enabled ? hexToRgba(accent, 0.14) : "rgba(0, 0, 0, 0.05)",
    border: `1px solid ${enabled ? hexToRgba(accent, 0.4) : "var(--border-default)"}`,
    borderRadius: "6px",
    color: enabled ? "#111827" : "var(--text-muted)",
    fontSize: "11px",
    fontWeight: 700,
    padding: "4px 10px",
    cursor: enabled ? "pointer" : "not-allowed",
    whiteSpace: "nowrap",
    opacity: enabled ? 1 : 0.6,
  };
}

function secondaryButtonStyle(): React.CSSProperties {
  return {
    background: "#ffffff",
    border: "1px solid var(--border-default)",
    borderRadius: "6px",
    color: "var(--text-secondary)",
    fontSize: "11px",
    fontWeight: 600,
    padding: "4px 10px",
    cursor: "pointer",
    whiteSpace: "nowrap",
  };
}

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
  const [showSportQuestion, setShowSportQuestion] = useState(false);
  const [confirmMessage, setConfirmMessage] = useState<string | null>(null);
  const [showBandModal, setShowBandModal] = useState(false);

  const creditBearing = getCreditBearingCount(plannedCourses);
  const eligibility = computeWaiverEligibility(grade, creditBearing, plannedCourses);

  const yearWaivers = resolutions.filter(
    (r) => r.type === "pe_waiver" && r.metadata?.year === grade
  );
  const hasVariant = (v: WaiverVariant) => yearWaivers.some((r) => findVariant(r) === v);

  // Only show waivers available for this grade. Applied waivers stay visible so
  // the student can always remove them.
  const displayedVariants = Array.from(
    new Set<WaiverVariant>([
      ...getAvailableWaiverVariants(grade),
      ...ALL_WAIVER_VARIANTS.filter(hasVariant),
    ])
  );

  const handleAdd = (v: WaiverVariant) => {
    if (v === "academic") {
      onAddResolution({ type: "pe_waiver", metadata: { variant: "academic", year: grade } });
      return;
    }
    setAddingVariant(v);
    setShowSportQuestion(false);
    setConfirmMessage(null);
  };

  const handleCancel = () => {
    setAddingVariant(null);
    setShowSportQuestion(false);
    setConfirmMessage(null);
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
        {displayedVariants.map((variant) => {
          const applied = hasVariant(variant);
          const active = addingVariant === variant;
          const info = VARIANT_INFO[variant];
          const accent = VARIANT_ACCENT[variant];
          const elig =
            variant === "academic" ? eligibility.academic :
            variant === "athletic" ? eligibility.athletic :
            eligibility.marchingBand;

          return (
            <div
              key={variant}
              style={{
                padding: "10px 12px",
                backgroundColor: applied ? hexToRgba(accent, 0.08) : "#ffffff",
                borderRadius: "8px",
                border: `1px solid ${applied ? hexToRgba(accent, 0.3) : "var(--border-default)"}`,
              }}
            >
              {applied ? (
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px" }}>
                  <div>
                    <span style={{ fontSize: "13px", fontWeight: 700, color: "#111827" }}>
                      ✓ {info.label}{variant === "athletic" ? athleticSubLabel(yearWaivers.find((r) => findVariant(r) === "athletic")!) : ""}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => onRemoveResolution(yearWaivers.find((r) => findVariant(r) === variant)!.id)}
                    style={secondaryButtonStyle()}
                  >
                    Remove
                  </button>
                </div>
              ) : active && variant !== "academic" ? (
                <AddVariantFlow
                  variant={variant}
                  accent={accent}
                  grade={grade}
                  eligibility={eligibility}
                  showSportQuestion={showSportQuestion}
                  setShowSportQuestion={setShowSportQuestion}
                  confirmMessage={confirmMessage}
                  setConfirmMessage={setConfirmMessage}
                  creditBearing={creditBearing}
                  onConfirm={() => {
                    if (variant === "marching-band") handleMarchingBandConfirm();
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
                    <div style={{ fontSize: "13px", fontWeight: 600, color: "#111827" }}>{info.label}</div>
                    <div style={{ fontSize: "11px", color: elig.eligible ? "#4B5563" : "#9CA3AF", marginTop: "2px" }}>
                      {elig.reason}
                    </div>
                  </div>
                  <button
                    type="button"
                    disabled={!elig.eligible}
                    onClick={() => handleAdd(variant)}
                    style={waiverButtonStyle(accent, elig.eligible)}
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
              style={secondaryButtonStyle()}
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
  variant, accent, grade, eligibility,
  showSportQuestion, setShowSportQuestion, confirmMessage, setConfirmMessage,
  creditBearing, onConfirm, onCancel, showBandModal, setShowBandModal,
  onAddResolution,
}: {
  variant: WaiverVariant;
  accent: string;
  grade: number;
  eligibility: ReturnType<typeof computeWaiverEligibility>;
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
  if (variant === "marching-band") {
    const elig = eligibility.marchingBand;
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
        <div style={{ fontSize: "12px", color: elig.eligible ? "#4B5563" : "#9CA3AF" }}>
          {elig.reason}
        </div>
        {elig.eligible && (
          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
            <button type="button" onClick={onConfirm} style={waiverButtonStyle(accent, true)}>
              Apply Waiver
            </button>
            <button type="button" onClick={() => setShowBandModal(true)} style={secondaryButtonStyle()}>
              Learn More
            </button>
          </div>
        )}
        <button type="button" onClick={onCancel} style={{ ...secondaryButtonStyle(), alignSelf: "flex-start" }}>
          Cancel
        </button>
      </div>
    );
  }

  if (variant === "athletic") {
    if (confirmMessage) {
      return (
        <div>
          <p style={{ margin: "0 0 8px", fontSize: "12px", color: "#4B5563" }}>{confirmMessage}</p>
          <button type="button" onClick={onCancel} style={secondaryButtonStyle()}>
            OK
          </button>
        </div>
      );
    }

    if (showSportQuestion) {
      return (
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          <p style={{ margin: 0, fontSize: "12px", color: "#374151" }}>Are you participating in a JV or Varsity sport?</p>
          <div style={{ display: "flex", gap: "8px" }}>
            <button type="button" onClick={() => { setShowSportQuestion(false); onConfirm(); }} style={waiverButtonStyle(accent, true)}>
              Yes
            </button>
            <button type="button" onClick={onCancel} style={secondaryButtonStyle()}>
              No
            </button>
          </div>
        </div>
      );
    }

    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
        <div style={{ fontSize: "12px", color: "#374151" }}>
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
              style={waiverButtonStyle(accent, true)}>
              {count === "one" ? "One sport" : "Two or more sports"}
            </button>
          ))}
          <button type="button" onClick={onCancel} style={secondaryButtonStyle()}>
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return null;
}
