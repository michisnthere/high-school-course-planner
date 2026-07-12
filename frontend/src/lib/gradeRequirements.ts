import type { PlannedCourse } from "./planner";

export type GradeRequirement = {
  category: string;
  credits: number;
  matches?: string[];
};

export type GradeRequirements = {
  grade: number;
  requirements: GradeRequirement[];
};

export const GRADE_REQUIREMENTS: GradeRequirements[] = [
  {
    grade: 9,
    requirements: [
      {
        category: "Communication Arts",
        credits: 1,
        matches: ["English"],
      },
      {
        category: "Mathematics",
        credits: 1,
        matches: ["Mathematics"],
      },
      {
        category: "Science",
        credits: 1,
        matches: ["Biology", "Physical Science"],
      },
    ],
  },
  {
    grade: 10,
    requirements: [
      {
        category: "Communication Arts",
        credits: 1,
        matches: ["English"],
      },
      {
        category: "Mathematics",
        credits: 1,
        matches: ["Mathematics"],
      },
      {
        category: "Science",
        credits: 1,
        matches: ["Biology", "Physical Science"],
      },
    ],
  },
  {
    grade: 11,
    requirements: [
      {
        category: "Communication Arts",
        credits: 1,
        matches: ["English"],
      },
      {
        category: "Mathematics",
        credits: 1,
        matches: ["Mathematics"],
      },
    ],
  },
  {
    grade: 12,
    requirements: [
      {
        category: "Communication Arts",
        credits: 1,
        matches: ["English"],
      },
    ],
  },
];

export type RequirementStatus = {
  category: string;
  requiredCredits: number;
  earnedCredits: number;
  isMet: boolean;
};

export function getGradeRequirements(grade: number): GradeRequirement[] {
  return GRADE_REQUIREMENTS.find((entry) => entry.grade === grade)?.requirements ?? [];
}

export function getRequirementStatus(
  grade: number,
  plannedCourses: PlannedCourse[]
): RequirementStatus[] {
  const requirements = getGradeRequirements(grade);
  if (requirements.length === 0) {
    return [];
  }

  // A full-year course is stored as two PlannedCourse records (one per semester,
  // same slot). Count each distinct course placement once so full-year courses
  // contribute only once toward requirements, while semester courses placed in
  // both semesters are counted as separate instances.
  const instanceMap = new Map<string, PlannedCourse>();
  for (const plannedCourse of plannedCourses) {
    if (plannedCourse.courseId == null) continue;
    const key =
      plannedCourse.course.duration === 2
        ? `${plannedCourse.courseId}-${plannedCourse.slot}`
        : `${plannedCourse.courseId}-${plannedCourse.slot}-${plannedCourse.semester}`;
    if (!instanceMap.has(key)) {
      instanceMap.set(key, plannedCourse);
    }
  }

  return requirements.map((requirement) => {
    const matchSet = new Set(requirement.matches ?? [requirement.category]);
    let earnedCredits = 0;

    for (const plannedCourse of instanceMap.values()) {
      const { course } = plannedCourse;
      if (course.title === "Study Hall" || course.title === "Free Period") {
        continue;
      }
      if (course.fulfillsRequirements.some((requirementName) => matchSet.has(requirementName))) {
        earnedCredits += course.credits ?? course.duration / 2;
      }
    }

    return {
      category: requirement.category,
      requiredCredits: requirement.credits,
      earnedCredits,
      isMet: earnedCredits >= requirement.credits,
    };
  });
}
