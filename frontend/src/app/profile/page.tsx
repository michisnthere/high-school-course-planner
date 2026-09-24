"use client";

import React, { useState, useCallback, useRef } from "react";
import Link from "next/link";
import { User } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useTranslation } from "@/context/I18nContext";
import { usePreferences } from "@/context/PreferencesContext";
import { ResponsivePage } from "@/components/responsive/ResponsivePage";
import { DeleteAccountSection } from "@/components/profile/DeleteAccountSection";
import { breakpoints } from "@/lib/responsive";
import { findTutorialTarget } from "@/lib/tutorial";
import type { ProfileUpdateData } from "@/lib/auth";

type ProfileFormData = {
  firstName: string;
  lastName: string;
  preferredName: string;
  grade: string;
  graduationYear: string;
};

const GRADE_OPTIONS = [
  { value: "9", labelKey: "profile.grade9" },
  { value: "10", labelKey: "profile.grade10" },
  { value: "11", labelKey: "profile.grade11" },
  { value: "12", labelKey: "profile.grade12" },
  { value: "other", labelKey: "profile.gradeOther" },
];

function getGradeLabel(grade: string | null, t: (key: string) => string): string {
  if (!grade) return "";
  const option = GRADE_OPTIONS.find((o) => o.value === grade);
  return option ? t(option.labelKey) : grade;
}

function getDisplayYear(user: { graduationYear: number | null; grade: string | null } | null, t: (key: string) => string): string {
  if (!user) return "";
  if (user.graduationYear) {
    return `${t("profile.classOf")} ${user.graduationYear}`;
  }
  if (user.grade) {
    return getGradeLabel(user.grade, t);
  }
  return "";
}

export default function ProfilePage(): React.ReactElement {
  const { user, mode, loading, isAuthenticated, isGuest, updateProfile } = useAuth();
  const { t } = useTranslation();
  const { resetTutorial } = usePreferences();

  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState<ProfileFormData>({
    firstName: "",
    lastName: "",
    preferredName: "",
    grade: "",
    graduationYear: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const firstNameRef = useRef<HTMLInputElement>(null);

  // Guest profile from localStorage
  const guestProfileKey = "stevenson-guest-profile";
  const loadGuestProfile = useCallback((): ProfileFormData => {
    try {
      const raw = localStorage.getItem(guestProfileKey);
      if (raw) return JSON.parse(raw);
    } catch {}
    return { firstName: "", lastName: "", preferredName: "", grade: "", graduationYear: "" };
  }, []);

  const saveGuestProfile = useCallback((data: ProfileFormData) => {
    try {
      localStorage.setItem(guestProfileKey, JSON.stringify(data));
    } catch {}
  }, []);

  // Get effective user data (authenticated from server, guest from localStorage)
  const getEffectiveData = useCallback((): {
    firstName: string | null;
    lastName: string | null;
    preferredName: string | null;
    grade: string | null;
    graduationYear: number | null;
  } => {
    if (isAuthenticated && user) {
      return {
        firstName: user.firstName,
        lastName: user.lastName,
        preferredName: user.preferredName,
        grade: user.grade,
        graduationYear: user.graduationYear,
      };
    }
    if (isGuest) {
      const guest = loadGuestProfile();
      return {
        firstName: guest.firstName || null,
        lastName: guest.lastName || null,
        preferredName: guest.preferredName || null,
        grade: guest.grade || null,
        graduationYear: guest.graduationYear ? Number(guest.graduationYear) : null,
      };
    }
    return { firstName: null, lastName: null, preferredName: null, grade: null, graduationYear: null };
  }, [isAuthenticated, isGuest, user, loadGuestProfile]);

  const effectiveData = getEffectiveData();
  const hasProfile = effectiveData.firstName && effectiveData.lastName;

  const openEditForm = useCallback(() => {
    setFormData({
      firstName: effectiveData.firstName || "",
      lastName: effectiveData.lastName || "",
      preferredName: effectiveData.preferredName || "",
      grade: effectiveData.grade || "",
      graduationYear: effectiveData.graduationYear?.toString() || "",
    });
    setErrors({});
    setSaveError(null);
    setSuccessMessage(null);
    setIsEditing(true);
    setTimeout(() => firstNameRef.current?.focus(), 100);
  }, [effectiveData]);

  const closeEditForm = useCallback(() => {
    setIsEditing(false);
    setErrors({});
    setSaveError(null);
  }, []);

  const validateForm = useCallback((): boolean => {
    const newErrors: Record<string, string> = {};
    if (!formData.firstName.trim()) {
      newErrors.firstName = t("profile.errorFirstNameRequired");
    }
    if (!formData.lastName.trim()) {
      newErrors.lastName = t("profile.errorLastNameRequired");
    }
    if (formData.graduationYear) {
      const year = Number(formData.graduationYear);
      if (isNaN(year) || year < 2020 || year > 2035) {
        newErrors.graduationYear = t("profile.errorInvalidYear");
      }
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [formData, t]);

  const handleSave = useCallback(async () => {
    if (!validateForm()) return;
    setSaving(true);
    setSaveError(null);
    try {
      const data: ProfileUpdateData = {
        firstName: formData.firstName.trim(),
        lastName: formData.lastName.trim(),
        preferredName: formData.preferredName.trim() || undefined,
        grade: formData.grade || undefined,
        graduationYear: formData.graduationYear ? Number(formData.graduationYear) : undefined,
      };
      if (isAuthenticated) {
        await updateProfile(data);
      } else if (isGuest) {
        saveGuestProfile({
          ...formData,
          preferredName: formData.preferredName,
        });
      }
      setIsEditing(false);
      setSuccessMessage(t("profile.changesSaved"));
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : t("profile.errorSaving"));
    } finally {
      setSaving(false);
    }
  }, [formData, validateForm, isAuthenticated, isGuest, updateProfile, saveGuestProfile, t]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Escape") closeEditForm();
  }, [closeEditForm]);

  // Redirect if not logged in at all
  if (!loading && !mode) {
    return (
      <ResponsivePage>
        <div style={{ padding: "48px 0", textAlign: "center" }}>
          <p style={{ fontSize: "16px", color: "var(--text-secondary)" }}>
            {t("profile.signInRequired")}
          </p>
          <Link
            href="/login"
            style={{
              display: "inline-block",
              marginTop: "16px",
              padding: "10px 24px",
              fontSize: "16px",
              fontWeight: 600,
              color: "#FFFFFF",
              backgroundColor: "var(--brand-accent)",
              border: "none",
              borderRadius: "8px",
              textDecoration: "none",
              cursor: "pointer",
            }}
          >
            {t("auth.signIn")}
          </Link>
        </div>
      </ResponsivePage>
    );
  }

  if (loading) {
    return (
      <ResponsivePage>
        <div style={{ padding: "48px 0", textAlign: "center", color: "var(--text-secondary)" }}>
          {t("auth.loading")}
        </div>
      </ResponsivePage>
    );
  }

  const displayName = effectiveData.preferredName || effectiveData.firstName || user?.name || "";
  const displayLastName = effectiveData.lastName || "";
  const gradeLabel = getGradeLabel(effectiveData.grade, t);
  const yearLabel = getDisplayYear(effectiveData, t);

  return (
    <ResponsivePage>
      <style>{`
        .rs-profile-field { margin-bottom: 16px; }
        .rs-profile-field label { display: block; margin-bottom: 6px; font-size: 14px; font-weight: 600; color: var(--text-primary); }
        .rs-profile-field input, .rs-profile-field select {
          width: 100%;
          padding: 10px 12px;
          font-size: 15px;
          border: 1px solid var(--border-default);
          border-radius: 8px;
          background-color: var(--bg-page);
          color: var(--text-primary);
          box-sizing: border-box;
          outline: none;
          transition: border-color 0.15s;
        }
        .rs-profile-field input:focus, .rs-profile-field select:focus {
          border-color: var(--brand-accent);
          box-shadow: 0 0 0 2px rgba(26, 92, 176, 0.15);
        }
        .rs-profile-field-error input, .rs-profile-field-error select {
          border-color: #dc3545;
        }
        .rs-profile-field-error-msg { font-size: 13px; color: #dc3545; margin-top: 4px; }
        @media (max-width: ${breakpoints.mobile}px) {
          .rs-profile-header { flex-direction: column; text-align: center; }
          .rs-profile-header-info { align-items: center; }
        }
      `}</style>

      {/* Success/Error messages */}
      {successMessage && (
        <div
          role="status"
          style={{
            padding: "12px 16px",
            marginBottom: "20px",
            fontSize: "14px",
            fontWeight: 500,
            color: "#0f766e",
            backgroundColor: "#f0fdfa",
            border: "1px solid #99f6e4",
            borderRadius: "8px",
          }}
        >
          {successMessage}
        </div>
      )}
      {saveError && (
        <div
          role="alert"
          style={{
            padding: "12px 16px",
            marginBottom: "20px",
            fontSize: "14px",
            fontWeight: 500,
            color: "#dc3545",
            backgroundColor: "#fff5f5",
            border: "1px solid #fecaca",
            borderRadius: "8px",
          }}
        >
          {saveError}
        </div>
      )}

      {/* Profile Header */}
      <div
        className="rs-profile-header"
        style={{
          display: "flex",
          alignItems: "center",
          gap: "20px",
          padding: "32px",
          marginBottom: "24px",
          backgroundColor: "var(--bg-card)",
          borderRadius: "12px",
          border: "1px solid var(--border-default)",
        }}
      >
        <div
          style={{
            width: "72px",
            height: "72px",
            borderRadius: "50%",
            backgroundColor: "var(--a11y-button-bg)",
            border: "2px solid var(--border-default)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          <User size={36} color="var(--a11y-icon-color)" strokeWidth={1.8} />
        </div>
        <div className="rs-profile-header-info" style={{ flex: 1, display: "flex", flexDirection: "column", gap: "4px" }}>
          <h1 style={{ margin: 0, fontSize: "24px", fontWeight: 700, color: "var(--text-primary)" }}>
            {displayName} {displayLastName}
          </h1>
          {(gradeLabel || yearLabel) && (
            <p style={{ margin: 0, fontSize: "15px", color: "var(--text-secondary)" }}>
              {gradeLabel}{gradeLabel && yearLabel ? " \u00B7 " : ""}{yearLabel}
            </p>
          )}
          {isGuest && (
            <span
              style={{
                display: "inline-block",
                marginTop: "4px",
                padding: "2px 10px",
                fontSize: "12px",
                fontWeight: 500,
                color: "var(--brand-accent)",
                backgroundColor: "var(--brand-accent-light)",
                borderRadius: "12px",
                width: "fit-content",
              }}
            >
              {t("profile.guestMode")}
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={openEditForm}
          style={{
            padding: "10px 20px",
            fontSize: "14px",
            fontWeight: 600,
            color: "#FFFFFF",
            backgroundColor: "var(--brand-accent)",
            border: "none",
            borderRadius: "8px",
            cursor: "pointer",
            flexShrink: 0,
            minHeight: "44px",
          }}
        >
          {hasProfile ? t("profile.editProfile") : t("profile.completeProfile")}
        </button>
      </div>

      {/* Description */}
      <p style={{ margin: "0 0 24px", fontSize: "15px", color: "var(--text-secondary)" }}>
        {t("profile.headerDescription")}
      </p>

      {/* Edit Form Modal */}
      {isEditing && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="profile-edit-title"
          onKeyDown={handleKeyDown}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 1000,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: "rgba(0, 0, 0, 0.5)",
          }}
          onClick={(e) => { if (e.target === e.currentTarget) closeEditForm(); }}
        >
          <div
            style={{
              width: "100%",
              maxWidth: "480px",
              maxHeight: "90vh",
              overflowY: "auto",
              backgroundColor: "var(--bg-card)",
              borderRadius: "12px",
              border: "1px solid var(--border-default)",
              padding: "28px",
              margin: "16px",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2
              id="profile-edit-title"
              style={{ margin: "0 0 24px", fontSize: "20px", fontWeight: 700, color: "var(--text-primary)" }}
            >
              {t("profile.editProfile")}
            </h2>

            <div className={`rs-profile-field${errors.firstName ? " rs-profile-field-error" : ""}`}>
              <label htmlFor="profile-firstName">{t("profile.firstName")} *</label>
              <input
                ref={firstNameRef}
                id="profile-firstName"
                type="text"
                value={formData.firstName}
                onChange={(e) => setFormData((prev) => ({ ...prev, firstName: e.target.value }))}
                aria-invalid={!!errors.firstName}
                aria-describedby={errors.firstName ? "profile-firstName-error" : undefined}
              />
              {errors.firstName && (
                <div id="profile-firstName-error" className="rs-profile-field-error-msg" role="alert">
                  {errors.firstName}
                </div>
              )}
            </div>

            <div className={`rs-profile-field${errors.lastName ? " rs-profile-field-error" : ""}`}>
              <label htmlFor="profile-lastName">{t("profile.lastName")} *</label>
              <input
                id="profile-lastName"
                type="text"
                value={formData.lastName}
                onChange={(e) => setFormData((prev) => ({ ...prev, lastName: e.target.value }))}
                aria-invalid={!!errors.lastName}
                aria-describedby={errors.lastName ? "profile-lastName-error" : undefined}
              />
              {errors.lastName && (
                <div id="profile-lastName-error" className="rs-profile-field-error-msg" role="alert">
                  {errors.lastName}
                </div>
              )}
            </div>

            <div className="rs-profile-field">
              <label htmlFor="profile-preferredName">{t("profile.preferredName")}</label>
              <input
                id="profile-preferredName"
                type="text"
                value={formData.preferredName}
                onChange={(e) => setFormData((prev) => ({ ...prev, preferredName: e.target.value }))}
              />
            </div>

            <div className="rs-profile-field">
              <label htmlFor="profile-grade">{t("profile.grade")}</label>
              <select
                id="profile-grade"
                value={formData.grade}
                onChange={(e) => setFormData((prev) => ({ ...prev, grade: e.target.value }))}
              >
                <option value="">{t("profile.selectGrade")}</option>
                {GRADE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{t(opt.labelKey)}</option>
                ))}
              </select>
            </div>

            <div className={`rs-profile-field${errors.graduationYear ? " rs-profile-field-error" : ""}`}>
              <label htmlFor="profile-graduationYear">{t("profile.expectedGraduationYear")}</label>
              <input
                id="profile-graduationYear"
                type="number"
                min={2020}
                max={2035}
                value={formData.graduationYear}
                onChange={(e) => setFormData((prev) => ({ ...prev, graduationYear: e.target.value }))}
                aria-invalid={!!errors.graduationYear}
                aria-describedby={errors.graduationYear ? "profile-graduationYear-error" : undefined}
              />
              {errors.graduationYear && (
                <div id="profile-graduationYear-error" className="rs-profile-field-error-msg" role="alert">
                  {errors.graduationYear}
                </div>
              )}
            </div>

            <div style={{ display: "flex", gap: "12px", justifyContent: "flex-end", marginTop: "24px" }}>
              <button
                type="button"
                onClick={closeEditForm}
                style={{
                  padding: "10px 20px",
                  fontSize: "14px",
                  fontWeight: 500,
                  color: "var(--text-secondary)",
                  backgroundColor: "transparent",
                  border: "1px solid var(--border-default)",
                  borderRadius: "8px",
                  cursor: "pointer",
                  minHeight: "44px",
                }}
              >
                {t("common.cancel")}
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                style={{
                  padding: "10px 20px",
                  fontSize: "14px",
                  fontWeight: 600,
                  color: "#FFFFFF",
                  backgroundColor: "var(--brand-accent)",
                  border: "none",
                  borderRadius: "8px",
                  cursor: saving ? "not-allowed" : "pointer",
                  opacity: saving ? 0.7 : 1,
                  minHeight: "44px",
                }}
              >
                {saving ? t("profile.saving") : t("profile.saveChanges")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Profile Information Card */}
      <Section title={t("profile.profileInformation")}>
        <InfoRow label={t("profile.firstName")} value={effectiveData.firstName} />
        <InfoRow label={t("profile.lastName")} value={effectiveData.lastName} />
        <InfoRow label={t("profile.preferredName")} value={effectiveData.preferredName} fallback={t("profile.notSet")} />
        <InfoRow label={t("profile.grade")} value={effectiveData.grade ? getGradeLabel(effectiveData.grade, t) : null} fallback={t("profile.notSet")} />
        <InfoRow label={t("profile.expectedGraduationYear")} value={effectiveData.graduationYear?.toString()} fallback={t("profile.notSet")} />
      </Section>

      {/* Account Card */}
      <Section title={t("profile.account")}>
        {isAuthenticated && user ? (
          <>
            <InfoRow label={t("profile.email")} value={user.email} />
            <InfoRow label={t("profile.name")} value={user.name} />
            <DeleteAccountSection />
          </>
        ) : isGuest ? (
          <p style={{ margin: 0, fontSize: "14px", color: "var(--text-secondary)" }}>
            {t("profile.guestAccountDescription")}
          </p>
        ) : null}
      </Section>

      {/* Personalization Card */}
      <Section title={t("profile.personalization")}>
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          <Link
            href="/profile"
            onClick={(e) => {
              e.preventDefault();
              (findTutorialTarget("[data-tour='language-settings']") as HTMLElement | null)?.click();
            }}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "12px 16px",
              fontSize: "14px",
              color: "var(--text-primary)",
              backgroundColor: "var(--bg-page)",
              border: "1px solid var(--border-default)",
              borderRadius: "8px",
              textDecoration: "none",
              cursor: "pointer",
            }}
          >
            <span>{t("profile.language")}</span>
            <span style={{ color: "var(--text-muted)" }}>&rsaquo;</span>
          </Link>
          <Link
            href="/profile"
            onClick={(e) => {
              e.preventDefault();
              (findTutorialTarget("[data-tour='a11y-settings']") as HTMLElement | null)?.click();
            }}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "12px 16px",
              fontSize: "14px",
              color: "var(--text-primary)",
              backgroundColor: "var(--bg-page)",
              border: "1px solid var(--border-default)",
              borderRadius: "8px",
              textDecoration: "none",
              cursor: "pointer",
            }}
          >
            <span>{t("profile.accessibility")}</span>
            <span style={{ color: "var(--text-muted)" }}>&rsaquo;</span>
          </Link>
          <button
            type="button"
            onClick={() => {
              resetTutorial();
              window.location.href = "/";
            }}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "12px 16px",
              fontSize: "14px",
              color: "var(--text-primary)",
              backgroundColor: "var(--bg-page)",
              border: "1px solid var(--border-default)",
              borderRadius: "8px",
              cursor: "pointer",
              textAlign: "left",
              width: "100%",
            }}
          >
            <span>{t("profile.tutorial")}</span>
            <span style={{ color: "var(--text-muted)" }}>&rsaquo;</span>
          </button>
        </div>
      </Section>

      {/* Academic Overview Card */}
      <Section title={t("profile.academicOverview")}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: "12px" }}>
          <Link
            href="/planner"
            style={{
              display: "block",
              padding: "16px",
              fontSize: "14px",
              fontWeight: 500,
              color: "var(--text-primary)",
              backgroundColor: "var(--bg-page)",
              border: "1px solid var(--border-default)",
              borderRadius: "8px",
              textDecoration: "none",
            }}
          >
            {t("profile.myPlanner")}
          </Link>
          <Link
            href="/saved"
            style={{
              display: "block",
              padding: "16px",
              fontSize: "14px",
              fontWeight: 500,
              color: "var(--text-primary)",
              backgroundColor: "var(--bg-page)",
              border: "1px solid var(--border-default)",
              borderRadius: "8px",
              textDecoration: "none",
            }}
          >
            {t("profile.savedCourses")}
          </Link>
          <Link
            href="/completed"
            style={{
              display: "block",
              padding: "16px",
              fontSize: "14px",
              fontWeight: 500,
              color: "var(--text-primary)",
              backgroundColor: "var(--bg-page)",
              border: "1px solid var(--border-default)",
              borderRadius: "8px",
              textDecoration: "none",
            }}
          >
            {t("profile.completedCourses")}
          </Link>
          <Link
            href="/catalog"
            style={{
              display: "block",
              padding: "16px",
              fontSize: "14px",
              fontWeight: 500,
              color: "var(--text-primary)",
              backgroundColor: "var(--bg-page)",
              border: "1px solid var(--border-default)",
              borderRadius: "8px",
              textDecoration: "none",
            }}
          >
            {t("profile.courseCatalog")}
          </Link>
        </div>
      </Section>
    </ResponsivePage>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}): React.ReactElement {
  return (
    <div
      style={{
        padding: "24px",
        marginBottom: "16px",
        backgroundColor: "var(--bg-card)",
        borderRadius: "12px",
        border: "1px solid var(--border-default)",
      }}
    >
      <h2
        style={{
          margin: "0 0 16px",
          fontSize: "18px",
          fontWeight: 600,
          color: "var(--text-primary)",
        }}
      >
        {title}
      </h2>
      {children}
    </div>
  );
}

function InfoRow({
  label,
  value,
  fallback,
}: {
  label: string;
  value: string | number | null | undefined;
  fallback?: string;
}): React.ReactElement {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "10px 0",
        borderBottom: "1px solid var(--border-default)",
      }}
    >
      <span style={{ fontSize: "14px", color: "var(--text-secondary)" }}>{label}</span>
      <span style={{ fontSize: "14px", fontWeight: 500, color: "var(--text-primary)" }}>
        {value ?? fallback ?? "\u2014"}
      </span>
    </div>
  );
}
