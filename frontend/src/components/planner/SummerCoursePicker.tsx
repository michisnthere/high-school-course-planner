"use client";

import React from "react";
import { getSummerCourses, type SummerCourse } from "@/lib/summerCourse";
import { normalizeSummerCourseForCatalog } from "@/lib/summerCatalog";
import { CourseCard } from "@/components/catalog/CourseCard";

type SummerCoursePickerProps = {
  semester: number;
  grade: number;
  alreadyPlanned: Array<{ summerCourseId: number | null | undefined; semester: number }>;
  plannedRegularIds?: Array<number | null | undefined>;
  completedRegularIds?: Array<number | null | undefined>;
  onClose: () => void;
  onSelect: (summerCourse: SummerCourse, semester: number) => void;
};

const SESSION_LABEL: Record<number, string> = { 3: "Session 1", 4: "Session 2" };

export function SummerCoursePicker({
  semester,
  grade,
  alreadyPlanned,
  plannedRegularIds,
  completedRegularIds,
  onClose,
  onSelect,
}: SummerCoursePickerProps): React.ReactElement {
  const [allCourses, setAllCourses] = React.useState<SummerCourse[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [query, setQuery] = React.useState("");
  const inputRef = React.useRef<HTMLInputElement>(null);

  const targetGrade = grade;
  const session = SESSION_LABEL[semester] ?? "Session 1";

  React.useEffect(() => {
    let active = true;
    getSummerCourses()
      .then((courses) => {
        if (active) setAllCourses(courses);
      })
      .catch(() => {
        if (active) setError("Failed to load Summer School courses.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    inputRef.current?.focus();
    return () => {
      active = false;
    };
  }, []);

  React.useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onClose]);

  const plannedIds = React.useMemo(
    () => new Set(alreadyPlanned.map((p) => p.summerCourseId).filter((id): id is number => id != null)),
    [alreadyPlanned]
  );

  const plannedRegularSet = React.useMemo(
    () => new Set((plannedRegularIds ?? []).filter((id): id is number => id != null)),
    [plannedRegularIds]
  );
  const completedRegularSet = React.useMemo(
    () => new Set((completedRegularIds ?? []).filter((id): id is number => id != null)),
    [completedRegularIds]
  );
  const repeatableSet = React.useMemo(() => {
    const set = new Set<number>();
    for (const course of allCourses) {
      const regular = course.regularCourse;
      if (
        regular?.isRepeatable === true &&
        regular.duration === 1 &&
        regular.department === "Physical Education"
      ) {
        set.add(course.regularCourseId ?? -1);
      }
    }
    return set;
  }, [allCourses]);

  const regularCompletedDuplicateIds = React.useMemo(() => {
    const set = new Set<number>();
    for (const course of allCourses) {
      const regular = course.regularCourse;
      if (
        regular &&
        regular.isRepeatable !== true &&
        !(regular.duration === 1 && regular.department === "Physical Education") &&
        completedRegularSet.has(regular.id)
      ) {
        set.add(course.id);
      }
    }
    return set;
  }, [allCourses, completedRegularSet]);

  const results = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = allCourses
      .map((course) => {
        const sessions = (course.sessions ?? []).map((s) => s.trim().toLowerCase());
        const isFullSummer = course.duration === "full_summer";
        const eligibleGrade =
          (course.gradeLevels?.length ?? 0) === 0 || (course.gradeLevels ?? []).includes(targetGrade);
        const offeredHere =
          sessions.length === 0 ||
          (isFullSummer
            ? sessions.includes("session 1") && sessions.includes("session 2")
            : sessions.includes(session.toLowerCase()));
        const alreadyAdded = plannedIds.has(course.id);
        const regularId = course.regularCourseId;
        const regularEquivalentDuplicate =
          regularId != null &&
          !repeatableSet.has(regularId) &&
          (plannedRegularSet.has(regularId) || completedRegularSet.has(regularId));
        const completedRegularDuplicate =
          regularId != null && regularCompletedDuplicateIds.has(course.id);
        const disabled = !eligibleGrade || !offeredHere || alreadyAdded || regularEquivalentDuplicate || completedRegularDuplicate;
        let disabledReason: string | null = null;
        if (alreadyAdded) disabledReason = "Already planned in your schedule";
        else if (regularEquivalentDuplicate)
          disabledReason = plannedRegularSet.has(regularId ?? -1)
            ? "The regular equivalent of this course is already planned"
            : "The regular equivalent of this course is already completed";
        else if (!eligibleGrade) disabledReason = `Open to ${(course.gradeLevels ?? []).join("-")}`;
        else if (!offeredHere)
          disabledReason = isFullSummer
            ? "Not offered for the full summer"
            : `Not offered in ${session}`;
        else if (completedRegularDuplicate) disabledReason = "The regular equivalent is already completed";
        return { course, disabled, disabledReason };
      })
      .filter((entry) => {
        if (!q) return true;
        const c = entry.course;
        return (
          c.title.toLowerCase().includes(q) ||
          (c.courseCode != null && c.courseCode.toLowerCase().includes(q)) ||
          c.fulfillsRequirements.some((r) => r.toLowerCase().includes(q))
        );
      })
      .sort((a, b) => {
        if (a.disabled !== b.disabled) return a.disabled ? 1 : -1;
        return a.course.title.localeCompare(b.course.title);
      });
    return list;
  }, [allCourses, query, targetGrade, session, plannedIds, plannedRegularSet, completedRegularSet, repeatableSet]);

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(0, 0, 0, 0.7)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 50,
        padding: "24px",
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "640px",
          maxHeight: "80vh",
          backgroundColor: "#1f2937",
          border: "1px solid #374151",
          borderRadius: "16px",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ padding: "24px 24px 16px", borderBottom: "1px solid #374151" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: "16px",
            }}
          >
            <div>
              <h2 style={{ margin: 0, fontSize: "22px", fontWeight: 700, color: "#ffffff" }}>
                Add a Summer Course
              </h2>
              <p style={{ margin: "4px 0 0", fontSize: "13px", color: "#9ca3af" }}>
                {session} · the summer between grade {grade - 1} and grade {grade}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              style={{
                fontSize: "24px",
                color: "#9ca3af",
                background: "none",
                border: "none",
                cursor: "pointer",
                padding: "4px",
                lineHeight: 1,
              }}
              aria-label="Close"
            >
              x
            </button>
          </div>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search summer courses..."
            style={{
              width: "100%",
              boxSizing: "border-box",
              padding: "10px 14px",
              borderRadius: "8px",
              border: "1px solid #4b5563",
              backgroundColor: "#111827",
              color: "#ffffff",
              fontSize: "14px",
            }}
          />
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: "16px 24px 24px" }}>
          {loading ? (
            <p style={{ color: "#9ca3af", fontSize: "14px" }}>Loading summer courses...</p>
          ) : error ? (
            <p style={{ color: "#f87171", fontSize: "14px" }}>{error}</p>
          ) : results.length === 0 ? (
            <p style={{ color: "#9ca3af", fontSize: "14px" }}>
              {query ? "No summer courses match your search." : "No summer courses available for this session."}
            </p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {results.map(({ course, disabled, disabledReason }) => {
                const catalogCourse = normalizeSummerCourseForCatalog(course);
                return (
                  <div
                    key={course.id}
                    onClick={() => {
                      if (!disabled) onSelect(course, semester);
                    }}
                    style={{
                      borderRadius: "12px",
                      border: disabled ? "1px solid #374151" : "1px solid #4b5563",
                      backgroundColor: disabled ? "#111827" : "#374151",
                      cursor: disabled ? "not-allowed" : "pointer",
                      opacity: disabled ? 0.6 : 1,
                    }}
                  >
                    <CourseCard
                      course={catalogCourse}
                      href={null}
                      showSaveButton={false}
                    />
                    {disabledReason && (
                      <div style={{ padding: "0 20px 16px", fontSize: "12px", color: "#f87171" }}>
                        {disabledReason}
                      </div>
                    )}
                    {course.regularCourse && (
                      <div style={{ padding: "0 20px 16px", fontSize: "12px", color: "#6ee7b7" }}>
                        Matches the regular course &quot;{course.regularCourse.title}&quot;
                      </div>
                    )}
                    {course.prerequisites.length > 0 && (
                      <div style={{ padding: "0 20px 16px", fontSize: "12px", color: "#fcd34d" }}>
                        Prerequisites: {course.prerequisites.join(", ")}
                      </div>
                    )}
                    {(course.corequisites ?? []).length > 0 && (
                      <div style={{ padding: "0 20px 16px", fontSize: "12px", color: "#fcd34d" }}>
                        Corequisites: {(course.corequisites ?? []).join(", ")}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
