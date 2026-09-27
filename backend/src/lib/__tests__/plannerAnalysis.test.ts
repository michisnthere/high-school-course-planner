import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// In-memory stand-in for the Prisma client. `plannerAnalysis` reads every
// input through these models, so the fixture rows below are the whole world
// each test sees.
// ---------------------------------------------------------------------------
type Row = Record<string, unknown>;

const db = vi.hoisted(() => ({
  planners: [] as Row[],
  completedCourses: [] as Row[],
  graduationRequirements: [] as Row[],
  courseRequirements: [] as Row[],
  courses: [] as Row[],
  resolutions: [] as Row[],
}));

vi.mock("../prisma.js", () => ({
  prisma: {
    planner: {
      findMany: (args?: { select?: unknown }) =>
        // loadPlacements passes `include`; the completed-years query passes `select`.
        Promise.resolve(args?.select ? [] : db.planners),
    },
    graduationRequirement: { findMany: () => Promise.resolve(db.graduationRequirements) },
    courseRequirement: { findMany: () => Promise.resolve(db.courseRequirements) },
    completedCourse: { findMany: () => Promise.resolve(db.completedCourses) },
    course: { findMany: () => Promise.resolve(db.courses) },
    requirementResolution: { findMany: () => Promise.resolve(db.resolutions) },
  },
}));

import { analyzePlanners } from "../plannerAnalysis.js";

const USER_ID = 1;

function makeCourse(options: {
  id: number;
  title: string;
  courseCode: string;
  fulfills: string[];
  prerequisites?: string[];
}): Row {
  return {
    id: options.id,
    title: options.title,
    duration: 2,
    credits: 2,
    slotsPerSemester: 1,
    fulfillsRequirements: options.fulfills,
    requirementCredits: null,
    attributes: [],
    isRepeatable: false,
    description: null,
    isNonAcademic: false,
    department: { name: "Mathematics", division: { name: "Mathematics" } },
    options: [
      {
        credits: 1,
        offerings: [
          {
            courseCode: options.courseCode,
            prerequisites: options.prerequisites ?? [],
            duration: 2,
            credits: null,
          },
        ],
      },
    ],
  };
}

function makeCompleted(course: Row, gradeCompleted: string): Row {
  return {
    id: course.id,
    userId: USER_ID,
    courseId: course.id,
    summerCourseId: null,
    gradeCompleted,
    letterGrade: null,
    credits: null,
    course,
    summerCourse: null,
  };
}

function makePlannerWith(id: number, schoolYear: number, plannedCourses: Row[]): Row {
  return { id, schoolYear, completedAt: null, plannedCourses };
}

const algebra = makeCourse({
  id: 201,
  title: "Algebra I",
  courseCode: "MATH101",
  fulfills: ["Mathematics"],
});
const geometry = makeCourse({
  id: 202,
  title: "Geometry",
  courseCode: "MATH102",
  fulfills: ["Mathematics"],
  prerequisites: ["Algebra I"],
});

function plannedGeometry(plannerId: number): Row {
  return {
    id: 9000 + plannerId,
    plannerId,
    courseId: geometry.id,
    plannerOption: null,
    semester: 1,
    slot: 1,
    course: geometry,
    summerCourse: null,
  };
}

function seedMathRequirement() {
  db.graduationRequirements.push({
    id: 1,
    name: "Mathematics Graduation Requirement",
    requiredValue: 4,
    isMeasurable: true,
    category: null,
    requirementType: null,
    description: null,
  });
  db.courseRequirements.push(
    { graduationRequirementId: 1, courseId: algebra.id },
    { graduationRequirementId: 1, courseId: geometry.id }
  );
}

function mathRequirement(result: Awaited<ReturnType<typeof analyzePlanners>>) {
  const req = result.graduationRequirements.find((r) => r.name === "Mathematics");
  expect(req).toBeDefined();
  return req!;
}

beforeEach(() => {
  db.planners = [];
  db.completedCourses = [];
  db.graduationRequirements = [];
  db.courseRequirements = [];
  db.courses = [];
  db.resolutions = [];
  seedMathRequirement();
});

describe("analyzePlanners - middle school completed courses", () => {
  it("middle school only: completedValue = 0 and plannedValue = 0", async () => {
    db.completedCourses.push(makeCompleted(algebra, "Middle School"));

    const result = await analyzePlanners(USER_ID);

    const math = mathRequirement(result);
    expect(math.completedValue).toBe(0);
    expect(math.plannedValue).toBe(0);
    expect(math.earnedValue).toBe(0);
    expect(math.status).not.toBe("satisfied");
    expect(result.earned!.credits.total).toBe(0);
    expect(result.credits.total).toBe(0);
  });

  it("middle + high school: only the high-school credits count", async () => {
    db.completedCourses.push(
      makeCompleted(geometry, "Middle School"),
      makeCompleted(algebra, "Freshman (9)")
    );

    const result = await analyzePlanners(USER_ID);

    const math = mathRequirement(result);
    expect(math.completedValue).toBe(2);
    expect(math.earnedValue).toBe(2);
    expect(result.earned!.credits.total).toBe(2);
    expect(result.credits.total).toBe(2);
  });

  it("middle + planned: the middle-school course is never green progress", async () => {
    db.planners.push(makePlannerWith(2, 10, [plannedGeometry(2)]));
    db.completedCourses.push(makeCompleted(algebra, "Middle School"));

    const result = await analyzePlanners(USER_ID);

    const math = mathRequirement(result);
    expect(math.completedValue).toBe(0);
    expect(math.plannedValue).toBe(2);
    expect(math.earnedValue).toBe(2);
    expect(result.earned!.credits.total).toBe(0);
  });
});

describe("analyzePlanners - middle school completed courses still satisfy prerequisites", () => {
  it("middle-school Algebra I satisfies the Geometry prerequisite", async () => {
    db.planners.push(makePlannerWith(2, 10, [plannedGeometry(2)]));
    db.completedCourses.push(makeCompleted(algebra, "Middle School"));

    const result = await analyzePlanners(USER_ID);

    expect(result.missingPrerequisites.filter((m) => m.courseTitle === "Geometry")).toEqual([]);
    // Same run: the middle-school course contributes no graduation progress.
    expect(mathRequirement(result).completedValue).toBe(0);
  });

  it("reports the prerequisite when it has not been completed", async () => {
    db.planners.push(makePlannerWith(2, 10, [plannedGeometry(2)]));

    const result = await analyzePlanners(USER_ID);

    const missing = result.missingPrerequisites.filter((m) => m.courseTitle === "Geometry");
    expect(missing).toHaveLength(1);
    expect(missing[0].missingPrerequisite).toBe("Algebra I");
    expect(missing[0].reason).toBe("notPlanned");
  });

  it("high-school Algebra I satisfies the prerequisite and counts for graduation", async () => {
    db.planners.push(makePlannerWith(2, 10, [plannedGeometry(2)]));
    db.completedCourses.push(makeCompleted(algebra, "Freshman (9)"));

    const result = await analyzePlanners(USER_ID);

    expect(result.missingPrerequisites.filter((m) => m.courseTitle === "Geometry")).toEqual([]);
    expect(mathRequirement(result).completedValue).toBe(2);
  });
});
