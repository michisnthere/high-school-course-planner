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

type CourseLike = PlannerCourseDetails;

const GRADE_LABELS: Record<number, string> = {
  9: "Freshman",
  10: "Sophomore",
  11: "Junior",
  12: "Senior",
};

const RECOMMENDATION_RULES: Record<string, string[]> = {
  English: ["English"],
  Math: ["Mathematics"],
  Mathematics: ["Mathematics"],
  Science: ["Biology", "Physical Science"],
  Health: ["Health"],
  "Driver Education": ["Driver Education"],
  "Physical Education": ["Physical Education"],
  "Economics / Personal Finance": ["Economics", "Personal Finance", "Consumer Education", "AP Macroeconomics", "AP Microeconomics"],
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
  return courses.reduce((sum, course) => sum + (course.credits ?? course.duration / 2), 0);
}

function uniqueRecommendations(courses: CourseLike[], terms: string[]): string[] {
  const titles = new Set<string>();
  for (const course of courses) {
    if (matchesAnyCourse(course, terms)) {
      titles.add(course.title);
    }
  }
  return Array.from(titles).sort((a, b) => a.localeCompare(b));
}

function buildItem(
  label: string,
  satisfied: boolean,
  warning: boolean,
  detail: string,
  recommendations: string[]
): YearLevelItem {
  return {
    label,
    status: satisfied ? "satisfied" : warning ? "warning" : "missing",
    detail,
    recommendations,
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

export function computeYearLevelCards(
  planners: Planner[],
  completedCourses: CompletedCourse[],
  courses: CourseLike[]
): YearLevelCard[] {
  const courseById = new Map(courses.map((course) => [course.id, course] as const));
  const completedCourseList = getCompletedInstances(completedCourses, courseById);

  return [9, 10, 11, 12].map((grade) => {
    const gradePlanner = planners.find((planner) => planner.schoolYear === grade);
    const gradePlanned = gradePlanner?.plannedCourses
      .filter((pc) => pc.courseId != null)
      .map((pc) => pc.course)
      .filter(Boolean) as CourseLike[];
    const gradeCompleted = completedCourseList;
    const academicCredits = countCredits(gradePlanned.filter(isAcademicCourse));

    const items: YearLevelItem[] = [];
    if (grade === 9) {
      items.push(
        buildItem(
          "English",
          matchesAnyCourseSet(gradePlanned, ["English"]) || matchesAnyCourseSet(gradeCompleted, ["English"]),
          false,
          semesterCourseText([...gradePlanned, ...gradeCompleted], ["English"]),
          uniqueRecommendations(courses, RECOMMENDATION_RULES.English)
        )
      );
      items.push(
        buildItem(
          "Math",
          matchesAnyCourseSet(gradePlanned, ["Mathematics"]) || matchesAnyCourseSet(gradeCompleted, ["Mathematics"]),
          false,
          semesterCourseText([...gradePlanned, ...gradeCompleted], ["Mathematics"]),
          uniqueRecommendations(courses, RECOMMENDATION_RULES.Math)
        )
      );
      items.push(
        buildItem(
          "Science",
          matchesAnyCourseSet(gradePlanned, ["Biology", "Physical Science"]) ||
            matchesAnyCourseSet(gradeCompleted, ["Biology", "Physical Science"]),
          false,
          semesterCourseText([...gradePlanned, ...gradeCompleted], ["Biology", "Physical Science"]),
          uniqueRecommendations(courses, RECOMMENDATION_RULES.Science)
        )
      );
      items.push(
        buildItem(
          "Minimum academic credits",
          academicCredits >= 8,
          academicCredits > 0 && academicCredits < 8,
          `${academicCredits.toFixed(1)} academic credits scheduled`,
          []
        )
      );
    } else if (grade === 10) {
      items.push(
        buildItem(
          "English",
          matchesAnyCourseSet(gradePlanned, ["English"]) || matchesAnyCourseSet(gradeCompleted, ["English"]),
          false,
          semesterCourseText([...gradePlanned, ...gradeCompleted], ["English"]),
          uniqueRecommendations(courses, RECOMMENDATION_RULES.English)
        )
      );
      items.push(
        buildItem(
          "Math",
          matchesAnyCourseSet(gradePlanned, ["Mathematics"]) || matchesAnyCourseSet(gradeCompleted, ["Mathematics"]),
          false,
          semesterCourseText([...gradePlanned, ...gradeCompleted], ["Mathematics"]),
          uniqueRecommendations(courses, RECOMMENDATION_RULES.Math)
        )
      );
      items.push(
        buildItem(
          "Science",
          matchesAnyCourseSet(gradePlanned, ["Biology", "Physical Science"]) ||
            matchesAnyCourseSet(gradeCompleted, ["Biology", "Physical Science"]),
          false,
          semesterCourseText([...gradePlanned, ...gradeCompleted], ["Biology", "Physical Science"]),
          uniqueRecommendations(courses, RECOMMENDATION_RULES.Science)
        )
      );
      items.push(
        buildItem(
          "Health",
          matchesAnyCourseSet(gradePlanned, ["Health"]) || matchesAnyCourseSet(gradeCompleted, ["Health"]),
          false,
          semesterCourseText([...gradePlanned, ...gradeCompleted], ["Health"]),
          uniqueRecommendations(courses, RECOMMENDATION_RULES.Health)
        )
      );
      items.push(
        buildItem(
          "Driver Education",
          matchesAnyCourseSet(gradePlanned, ["Driver Education"]) ||
            matchesAnyCourseSet(gradeCompleted, ["Driver Education"]),
          false,
          semesterCourseText([...gradePlanned, ...gradeCompleted], ["Driver Education"]),
          uniqueRecommendations(courses, RECOMMENDATION_RULES["Driver Education"])
        )
      );
      items.push(
        buildItem(
          "Physical Education",
          matchesAnyCourseSet(gradePlanned, ["Physical Education"]) ||
            matchesAnyCourseSet(gradeCompleted, ["Physical Education"]),
          false,
          semesterCourseText([...gradePlanned, ...gradeCompleted], ["Physical Education"]),
          uniqueRecommendations(courses, RECOMMENDATION_RULES["Physical Education"])
        )
      );
    } else if (grade === 11) {
      items.push(
        buildItem(
          "English",
          matchesAnyCourseSet(gradePlanned, ["English"]) || matchesAnyCourseSet(gradeCompleted, ["English"]),
          false,
          semesterCourseText([...gradePlanned, ...gradeCompleted], ["English"]),
          uniqueRecommendations(courses, RECOMMENDATION_RULES.English)
        )
      );
      items.push(
        buildItem(
          "Mathematics",
          matchesAnyCourseSet(gradePlanned, ["Mathematics"]) || matchesAnyCourseSet(gradeCompleted, ["Mathematics"]),
          false,
          semesterCourseText([...gradePlanned, ...gradeCompleted], ["Mathematics"]),
          uniqueRecommendations(courses, RECOMMENDATION_RULES.Mathematics)
        )
      );
      const peSatisfied =
        matchesAnyCourseSet(gradePlanned, ["Physical Education"]) ||
        matchesAnyCourseSet(gradeCompleted, ["Physical Education"]);
      items.push(
        buildItem(
          "Physical Education or approved waiver",
          peSatisfied,
          false,
          semesterCourseText([...gradePlanned, ...gradeCompleted], ["Physical Education"]),
          uniqueRecommendations(courses, RECOMMENDATION_RULES["Physical Education"])
        )
      );
    } else {
      items.push(
        buildItem(
          "English",
          matchesAnyCourseSet(gradePlanned, ["English"]) || matchesAnyCourseSet(gradeCompleted, ["English"]),
          false,
          semesterCourseText([...gradePlanned, ...gradeCompleted], ["English"]),
          uniqueRecommendations(courses, RECOMMENDATION_RULES.English)
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
          uniqueRecommendations(courses, RECOMMENDATION_RULES["Economics / Personal Finance"])
        )
      );
      const peSatisfied =
        matchesAnyCourseSet(gradePlanned, ["Physical Education"]) ||
        matchesAnyCourseSet(gradeCompleted, ["Physical Education"]);
      items.push(
        buildItem(
          "Physical Education or approved waiver",
          peSatisfied,
          false,
          semesterCourseText([...gradePlanned, ...gradeCompleted], ["Physical Education"]),
          uniqueRecommendations(courses, RECOMMENDATION_RULES["Physical Education"])
        )
      );
    }

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
