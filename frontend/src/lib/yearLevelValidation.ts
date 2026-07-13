import type { CompletedCourse } from "@/lib/completedCourses";
import type { Planner, PlannerCourseDetails } from "@/lib/planner";
import { getCourseCredits } from "@/lib/courseCredits";
import { courseFulfillsRequirement } from "@/lib/gradeRequirements";

export type YearLevelStatus = "satisfied" | "warning" | "missing";

export type YearLevelItem = {
  label: string;
  status: YearLevelStatus;
  detail: string;
  recommendations: string[];
};

export type YearLevelCard = {
  grade: number;
  label: string;
  satisfiedCount: number;
  totalCount: number;
  items: YearLevelItem[];
};

export type PeYearStatus = {
  met: boolean;
  grade: number;
  label: string;
};

type CourseLike = PlannerCourseDetails;

type PlannedCourseLike = {
  id?: number;
  semester?: number;
  slot?: number;
  courseId: number | null;
  course?: CourseLike | null;
};

type PlannerLike = {
  schoolYear: number;
  plannedCourses?: PlannedCourseLike[] | null;
};

const GRADE_LABELS: Record<number, string> = {
  9: "Freshman",
  10: "Sophomore",
  11: "Junior",
  12: "Senior",
};

function normalize(text: string): string {
  return text.trim().toLowerCase();
}

function asArray<T>(value: T[] | null | undefined): T[] {
  return Array.isArray(value) ? value : [];
}

function getPlannerPlannedCourses(planner: PlannerLike | null | undefined): CourseLike[] {
  const seen = new Set<string>();
  return asArray(planner?.plannedCourses)
    .filter((pc) => {
      if (!pc?.course) return false;
      const key = pc.course.duration === 2 ? `${pc.courseId}-${pc.slot}` : `${pc.courseId}-${pc.slot}-${pc.semester}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .map((pc) => pc.course!)
    .filter((course): course is CourseLike => Boolean(course));
}

function courseTokens(course: CourseLike): string[] {
  return [
    course.title,
    ...(course.fulfillsRequirements ?? []),
    course.department ?? "",
    course.division ?? "",
  ]
    .map(normalize)
    .filter(Boolean);
}

function matchesAnyCourse(course: CourseLike, terms: string[]): boolean {
  const tokens = courseTokens(course);
  return terms.some((term) => {
    const needle = normalize(term);
    return tokens.some((token) => token === needle || token.includes(needle) || needle.includes(token));
  });
}

function matchesAnyCourseSet(courses: CourseLike[], terms: string[]): boolean {
  return courses.some((course) => matchesAnyCourse(course, terms));
}

function getCompletedForGrade(completedCourses: CompletedCourse[], lookup: Map<number, CourseLike>, grade: number): CourseLike[] {
  const gradePattern = GRADE_PATTERNS[grade];
  if (!gradePattern) return [];
  return completedCourses
    .filter((cc) => gradePattern.test((cc.gradeCompleted ?? "").trim().toLowerCase()))
    .map((cc) => lookup.get(cc.courseId))
    .filter((course): course is CourseLike => Boolean(course));
}

const GRADE_PATTERNS: Record<number, RegExp> = {
  9: /^freshman\s*\(9\)$/,
  10: /^sophomore\s*\(10\)$/,
  11: /^junior\s*\(11\)$/,
  12: /^senior\s*\(12\)$/,
};

function countCredits(courses: CourseLike[]): number {
  return courses.reduce((sum, course) => sum + getCourseCredits(course), 0);
}

function buildItem(
  label: string,
  satisfied: boolean,
  warning: boolean,
  detail: string,
): YearLevelItem {
  return {
    label,
    status: satisfied ? "satisfied" : warning ? "warning" : "missing",
    detail,
    recommendations: [],
  };
}

function firstMatchingCourseTitle(courses: CourseLike[], terms: string[]): string | null {
  const match = courses.find((course) => courseFulfillsRequirement(course, terms));
  return match?.title ?? null;
}

function semesterCourseText(courses: CourseLike[], terms: string[]): string {
  const title = firstMatchingCourseTitle(courses, terms);
  return title ? title : "Missing";
}

function hasFreshmanFF(courses: CourseLike[]): boolean {
  return courses.some((c) =>
    c.title.toLowerCase().replace(/\*/g, "").trim().includes("foundational fitness")
  );
}

function checkPeMet(grade: number, gradePlanned: CourseLike[], gradeCompleted: CourseLike[], planner: PlannerLike | null | undefined): boolean {
  if (grade === 9) {
    const allCourses = [...gradePlanned, ...gradeCompleted];
    if (!hasFreshmanFF(allCourses)) return false;
    const hasDance = matchesAnyCourseSet(allCourses, ["Dance"]);
    let peCount = 0;
    if (planner) {
      for (const pc of planner.plannedCourses ?? []) {
        if (!pc.course) continue;
        if ((pc.course.division ?? "").toLowerCase() === "physical education") {
          peCount++;
        }
      }
    }
    return peCount >= 2 || hasDance;
  }
  const allCourses = [...gradePlanned, ...gradeCompleted];
  const hasDance = matchesAnyCourseSet(allCourses, ["Dance"]);
  let peCount = 0;
  if (planner) {
    for (const pc of planner.plannedCourses ?? []) {
      if (!pc.course) continue;
      if ((pc.course.division ?? "").toLowerCase() === "physical education") {
        peCount++;
      }
    }
  }
  return peCount >= 2 || hasDance;
}

function detailPeText(grade: number, gradePlanned: CourseLike[], gradeCompleted: CourseLike[], planner: PlannerLike | null | undefined): string {
  const allCourses = [...gradePlanned, ...gradeCompleted];
  if (grade === 9) {
    const ffTitle = allCourses.find((c) =>
      c.title.toLowerCase().replace(/\*/g, "").trim().includes("foundational fitness")
    )?.title;
    if (ffTitle) {
      const otherTitles = allCourses
        .filter((c) =>
          (c.division ?? "").toLowerCase() === "physical education" &&
          !c.title.toLowerCase().includes("foundational fitness")
        )
        .map((c) => c.title);
      if (otherTitles.length > 0) {
        return `${ffTitle}, ${otherTitles.join(", ")}`;
      }
      return ffTitle;
    }
    if (matchesAnyCourseSet(allCourses, ["Dance"])) return "Dance";
    return "Missing";
  }
  const peCourses = allCourses.filter((c) =>
    (c.division ?? "").toLowerCase() === "physical education"
  );
  const peTitles = peCourses.map((c) => c.title).filter(Boolean);
  const uniqueTitles = [...new Set(peTitles)];
  if (uniqueTitles.length > 0) {
    return uniqueTitles.join(", ");
  }
  if (matchesAnyCourseSet(allCourses, ["Dance"])) {
    return "Dance";
  }
  return "Missing";
}

export function computeYearLevelCards(
  planners: Planner[] | null | undefined,
  completedCourses: CompletedCourse[] | null | undefined,
  courses: CourseLike[]
): YearLevelCard[] {
  const safePlanners = asArray(planners);
  const safeCompletedCourses = asArray(completedCourses);
  const safeCourses = asArray(courses);
  const courseById = new Map(safeCourses.map((course) => [course.id, course] as const));

  return [9, 10, 11, 12].map((grade) => {
    const gradePlanner = safePlanners.find((planner) => planner.schoolYear === grade);
    const gradePlanned = getPlannerPlannedCourses(gradePlanner);
    const gradeCompleted = getCompletedForGrade(safeCompletedCourses, courseById, grade);

    const items: YearLevelItem[] = [];
    if (grade === 9) {
      items.push(
        buildItem(
          "English",
          gradePlanned.some((c) => courseFulfillsRequirement(c, ["English"])) ||
            gradeCompleted.some((c) => courseFulfillsRequirement(c, ["English"])),
          false,
          semesterCourseText([...gradePlanned, ...gradeCompleted], ["English"]),
        )
      );
      items.push(
        buildItem(
          "Math",
          gradePlanned.some((c) => courseFulfillsRequirement(c, ["Mathematics"])) ||
            gradeCompleted.some((c) => courseFulfillsRequirement(c, ["Mathematics"])),
          false,
          semesterCourseText([...gradePlanned, ...gradeCompleted], ["Mathematics"]),
        )
      );
      items.push(
        buildItem(
          "Science",
          gradePlanned.some((c) => courseFulfillsRequirement(c, ["Biology", "Physical Science"])) ||
            gradeCompleted.some((c) => courseFulfillsRequirement(c, ["Biology", "Physical Science"])),
          false,
          semesterCourseText([...gradePlanned, ...gradeCompleted], ["Biology", "Physical Science"]),
        )
      );
    } else if (grade === 10) {
      items.push(
        buildItem(
          "English",
          gradePlanned.some((c) => courseFulfillsRequirement(c, ["English"])) ||
            gradeCompleted.some((c) => courseFulfillsRequirement(c, ["English"])),
          false,
          semesterCourseText([...gradePlanned, ...gradeCompleted], ["English"]),
        )
      );
      items.push(
        buildItem(
          "Math",
          gradePlanned.some((c) => courseFulfillsRequirement(c, ["Mathematics"])) ||
            gradeCompleted.some((c) => courseFulfillsRequirement(c, ["Mathematics"])),
          false,
          semesterCourseText([...gradePlanned, ...gradeCompleted], ["Mathematics"]),
        )
      );
      items.push(
        buildItem(
          "Science",
          gradePlanned.some((c) => courseFulfillsRequirement(c, ["Biology", "Physical Science"])) ||
            gradeCompleted.some((c) => courseFulfillsRequirement(c, ["Biology", "Physical Science"])),
          false,
          semesterCourseText([...gradePlanned, ...gradeCompleted], ["Biology", "Physical Science"]),
        )
      );
      items.push(
        buildItem(
          "Health",
          gradePlanned.some((c) => courseFulfillsRequirement(c, ["Health"])) ||
            gradeCompleted.some((c) => courseFulfillsRequirement(c, ["Health"])),
          false,
          semesterCourseText([...gradePlanned, ...gradeCompleted], ["Health"]),
        )
      );
      items.push(
        buildItem(
          "Driver Education",
          gradePlanned.some((c) => courseFulfillsRequirement(c, ["Driver Education"])) ||
            gradeCompleted.some((c) => courseFulfillsRequirement(c, ["Driver Education"])),
          false,
          semesterCourseText([...gradePlanned, ...gradeCompleted], ["Driver Education"]),
        )
      );
    } else if (grade === 11) {
      items.push(
        buildItem(
          "English",
          gradePlanned.some((c) => courseFulfillsRequirement(c, ["English"])) ||
            gradeCompleted.some((c) => courseFulfillsRequirement(c, ["English"])),
          false,
          semesterCourseText([...gradePlanned, ...gradeCompleted], ["English"]),
        )
      );
      items.push(
        buildItem(
          "Mathematics",
          gradePlanned.some((c) => courseFulfillsRequirement(c, ["Mathematics"])) ||
            gradeCompleted.some((c) => courseFulfillsRequirement(c, ["Mathematics"])),
          false,
          semesterCourseText([...gradePlanned, ...gradeCompleted], ["Mathematics"]),
        )
      );
    } else {
      items.push(
        buildItem(
          "English",
          gradePlanned.some((c) => courseFulfillsRequirement(c, ["English"])) ||
            gradeCompleted.some((c) => courseFulfillsRequirement(c, ["English"])),
          false,
          semesterCourseText([...gradePlanned, ...gradeCompleted], ["English"]),
        )
      );
      items.push(
        buildItem(
          "Economics / Personal Finance",
          gradePlanned.some((c) => courseFulfillsRequirement(c, ["Economics", "Personal Finance", "Consumer Education"])) ||
            gradeCompleted.some((c) => courseFulfillsRequirement(c, ["Economics", "Personal Finance", "Consumer Education"])),
          false,
          semesterCourseText([...gradePlanned, ...gradeCompleted], [
            "Economics",
            "Personal Finance",
            "Consumer Education",
          ]),
        )
      );
    }

    const peMet = checkPeMet(grade, gradePlanned, gradeCompleted, gradePlanner);
    items.push(
      buildItem(
        "Physical Education",
        peMet,
        false,
        detailPeText(grade, gradePlanned, gradeCompleted, gradePlanner),
      )
    );

    const satisfiedCount = items.filter((item) => item.status === "satisfied").length;

    return {
      grade,
      label: GRADE_LABELS[grade],
      satisfiedCount,
      totalCount: items.length,
      items,
    };
  });
}

export function computePeYears(
  planners: Planner[] | null | undefined,
  completedCourses: CompletedCourse[] | null | undefined,
  courses: CourseLike[]
): PeYearStatus[] {
  const safePlanners = asArray(planners);
  const safeCompletedCourses = asArray(completedCourses);
  const safeCourses = asArray(courses);
  const courseById = new Map(safeCourses.map((course) => [course.id, course] as const));

  return [9, 10, 11, 12].map((grade) => {
    const gradePlanner = safePlanners.find((planner) => planner.schoolYear === grade);
    const gradePlanned = getPlannerPlannedCourses(gradePlanner);
    const gradeCompleted = getCompletedForGrade(safeCompletedCourses, courseById, grade);
    const allCourses = [...gradePlanned, ...gradeCompleted];

    const peDivision = allCourses.filter((c) =>
      (c.division ?? "").toLowerCase() === "physical education"
    );
    const peSemesters = new Set<number>();
    let peSlotCount = 0;
    if (gradePlanner) {
      for (const pc of gradePlanner.plannedCourses ?? []) {
        if (!pc.course) continue;
        if ((pc.course.division ?? "").toLowerCase() === "physical education") {
          peSemesters.add(pc.semester);
          peSlotCount++;
        }
      }
    }

    const hasDance = matchesAnyCourseSet(allCourses, ["Dance"]);
    const hasTwoSemesters = peSemesters.size >= 2 || peSlotCount >= 2;

    const met = hasTwoSemesters || hasDance;

    return { grade, label: GRADE_LABELS[grade], met };
  });
}
