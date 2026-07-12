import type { CompletedCourse } from "@/lib/completedCourses";
import type { Planner, PlannerCourseDetails } from "@/lib/planner";

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

const ACADEMIC_CREDITS_MATCHERS = [
  "English",
  "Mathematics",
  "Biology",
  "Physical Science",
  "Social Studies",
  "Multilingual Learning",
];

function normalize(text: string): string {
  return text.trim().toLowerCase();
}

function asArray<T>(value: T[] | null | undefined): T[] {
  return Array.isArray(value) ? value : [];
}

function getPlannerPlannedCourses(planner: PlannerLike | null | undefined): CourseLike[] {
  return asArray(planner?.plannedCourses)
    .map((pc) => pc?.course ?? null)
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

function isAcademicCourse(course: CourseLike): boolean {
  return matchesAnyCourse(course, ACADEMIC_CREDITS_MATCHERS);
}

function getCompletedInstances(completedCourses: CompletedCourse[], lookup: Map<number, CourseLike>): CourseLike[] {
  return completedCourses
    .map((completed) => lookup.get(completed.courseId))
    .filter((course): course is CourseLike => Boolean(course));
}

function countCredits(courses: CourseLike[]): number {
  return courses.reduce((sum, course) => sum + (course.credits ?? course.duration), 0);
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
  const match = courses.find((course) => matchesAnyCourse(course, terms));
  return match?.title ?? null;
}

function semesterCourseText(courses: CourseLike[], terms: string[]): string {
  const title = firstMatchingCourseTitle(courses, terms);
  return title ? title : "Missing";
}

function checkPeMet(gradePlanned: CourseLike[], gradeCompleted: CourseLike[], planner: PlannerLike | null | undefined): boolean {
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

function detailPeText(gradePlanned: CourseLike[], gradeCompleted: CourseLike[], planner: PlannerLike | null | undefined): string {
  const allCourses = [...gradePlanned, ...gradeCompleted];
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
  const completedCourseList = getCompletedInstances(safeCompletedCourses, courseById);

  return [9, 10, 11, 12].map((grade) => {
    const gradePlanner = safePlanners.find((planner) => planner.schoolYear === grade);
    const gradePlanned = getPlannerPlannedCourses(gradePlanner);
    const gradeCompleted = completedCourseList;

    const items: YearLevelItem[] = [];
    if (grade === 9) {
      items.push(
        buildItem(
          "English",
          matchesAnyCourseSet(gradePlanned, ["English"]) || matchesAnyCourseSet(gradeCompleted, ["English"]),
          false,
          semesterCourseText([...gradePlanned, ...gradeCompleted], ["English"]),
        )
      );
      items.push(
        buildItem(
          "Math",
          matchesAnyCourseSet(gradePlanned, ["Mathematics"]) || matchesAnyCourseSet(gradeCompleted, ["Mathematics"]),
          false,
          semesterCourseText([...gradePlanned, ...gradeCompleted], ["Mathematics"]),
        )
      );
      items.push(
        buildItem(
          "Science",
          matchesAnyCourseSet(gradePlanned, ["Biology", "Physical Science"]) ||
            matchesAnyCourseSet(gradeCompleted, ["Biology", "Physical Science"]),
          false,
          semesterCourseText([...gradePlanned, ...gradeCompleted], ["Biology", "Physical Science"]),
        )
      );
    } else if (grade === 10) {
      items.push(
        buildItem(
          "English",
          matchesAnyCourseSet(gradePlanned, ["English"]) || matchesAnyCourseSet(gradeCompleted, ["English"]),
          false,
          semesterCourseText([...gradePlanned, ...gradeCompleted], ["English"]),
        )
      );
      items.push(
        buildItem(
          "Math",
          matchesAnyCourseSet(gradePlanned, ["Mathematics"]) || matchesAnyCourseSet(gradeCompleted, ["Mathematics"]),
          false,
          semesterCourseText([...gradePlanned, ...gradeCompleted], ["Mathematics"]),
        )
      );
      items.push(
        buildItem(
          "Science",
          matchesAnyCourseSet(gradePlanned, ["Biology", "Physical Science"]) ||
            matchesAnyCourseSet(gradeCompleted, ["Biology", "Physical Science"]),
          false,
          semesterCourseText([...gradePlanned, ...gradeCompleted], ["Biology", "Physical Science"]),
        )
      );
      items.push(
        buildItem(
          "Health",
          matchesAnyCourseSet(gradePlanned, ["Health"]) || matchesAnyCourseSet(gradeCompleted, ["Health"]),
          false,
          semesterCourseText([...gradePlanned, ...gradeCompleted], ["Health"]),
        )
      );
      items.push(
        buildItem(
          "Driver Education",
          matchesAnyCourseSet(gradePlanned, ["Driver Education"]) ||
            matchesAnyCourseSet(gradeCompleted, ["Driver Education"]),
          false,
          semesterCourseText([...gradePlanned, ...gradeCompleted], ["Driver Education"]),
        )
      );
    } else if (grade === 11) {
      items.push(
        buildItem(
          "English",
          matchesAnyCourseSet(gradePlanned, ["English"]) || matchesAnyCourseSet(gradeCompleted, ["English"]),
          false,
          semesterCourseText([...gradePlanned, ...gradeCompleted], ["English"]),
        )
      );
      items.push(
        buildItem(
          "Mathematics",
          matchesAnyCourseSet(gradePlanned, ["Mathematics"]) || matchesAnyCourseSet(gradeCompleted, ["Mathematics"]),
          false,
          semesterCourseText([...gradePlanned, ...gradeCompleted], ["Mathematics"]),
        )
      );
    } else {
      items.push(
        buildItem(
          "English",
          matchesAnyCourseSet(gradePlanned, ["English"]) || matchesAnyCourseSet(gradeCompleted, ["English"]),
          false,
          semesterCourseText([...gradePlanned, ...gradeCompleted], ["English"]),
        )
      );
      items.push(
        buildItem(
          "Economics / Personal Finance",
          matchesAnyCourseSet(gradePlanned, ["Economics", "Personal Finance", "Consumer Education"]) ||
            matchesAnyCourseSet(gradeCompleted, ["Economics", "Personal Finance", "Consumer Education"]),
          false,
          semesterCourseText([...gradePlanned, ...gradeCompleted], [
            "Economics",
            "Personal Finance",
            "Consumer Education",
          ]),
        )
      );
    }

    const peMet = checkPeMet(gradePlanned, gradeCompleted, gradePlanner);
    items.push(
      buildItem(
        "Physical Education",
        peMet,
        false,
        detailPeText(gradePlanned, gradeCompleted, gradePlanner),
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
  const completedCourseList = getCompletedInstances(safeCompletedCourses, courseById);

  return [9, 10, 11, 12].map((grade) => {
    const gradePlanner = safePlanners.find((planner) => planner.schoolYear === grade);
    const gradePlanned = getPlannerPlannedCourses(gradePlanner);
    const allCourses = [...gradePlanned, ...completedCourseList];

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
