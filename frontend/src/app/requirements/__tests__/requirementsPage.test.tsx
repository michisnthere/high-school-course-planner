// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import React from "react";
import RequirementsPage from "@/app/requirements/page";
import { computePlannerAnalysis } from "@/lib/plannerAnalysisEngine";
import type { Planner, PlannerCourseDetails } from "@/lib/planner";
import type { CompletedCourse, GradeCompleted } from "@/lib/completedCourses";

const mocks = vi.hoisted(() => ({
  getPlanners: vi.fn(),
  getCompletedCourses: vi.fn(),
  getResolutions: vi.fn(),
  getAnalysis: vi.fn(),
  getCourses: vi.fn(),
  services: null as unknown as Record<string, unknown>,
}));

vi.mock("@/services/ServiceContext", () => ({
  ServiceProvider: (props: { children?: React.ReactElement }) => props.children ?? null,
  useServices: () => mocks.services,
}));

vi.mock("@/context/AuthContext", () => ({
  useAuth: () => ({ mode: "authenticated", loading: false, user: null }),
}));

vi.mock("@/context/I18nContext", async () => {
  const { translate } = await vi.importActual<typeof import("@/lib/i18n")>("@/lib/i18n");
  return {
    useTranslation: () => ({
      locale: "en",
      setLocale: () => undefined,
      t: (key: string, params?: Record<string, string>) => translate("en", key, params),
      availableLocales: [],
    }),
  };
});

const navigation = vi.hoisted(() => ({
  params: new URLSearchParams(),
  router: { replace: () => undefined, push: () => undefined },
}));

vi.mock("next/navigation", () => ({
  useSearchParams: () => navigation.params,
  useRouter: () => navigation.router,
}));

mocks.services = {
  planner: { getPlanners: mocks.getPlanners },
  completedCourses: { getCompletedCourses: mocks.getCompletedCourses },
  savedCourses: {},
  analysis: { getAnalysis: mocks.getAnalysis },
  resolutions: { getResolutions: mocks.getResolutions },
};

vi.mock("@/lib/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api")>();
  return { ...actual, getCourses: mocks.getCourses };
});

const english9: PlannerCourseDetails = {
  id: 301, title: "English I", normalizedTitle: "english i", duration: 2,
  slotsPerSemester: 1, creditType: "regular", credits: 2, division: "English",
  department: "English", description: null, fulfillsRequirements: ["English"],
  prerequisites: [], courseCodeS1: null, courseCodeS2: null, courseCode: "ENG101", gradeMin: 9, gradeMax: 9,
  isNonAcademic: false, isMarchingBand: false, attributes: [],
};

const english10: PlannerCourseDetails = {
  id: 302, title: "English II", normalizedTitle: "english ii", duration: 2,
  slotsPerSemester: 1, creditType: "regular", credits: 2, division: "English",
  department: "English", description: null, fulfillsRequirements: ["English"],
  prerequisites: [], courseCodeS1: null, courseCodeS2: null, courseCode: "ENG102", gradeMin: 10, gradeMax: 10,
  isNonAcademic: false, isMarchingBand: false, attributes: [],
};

const english11: PlannerCourseDetails = {
  id: 303, title: "English III", normalizedTitle: "english iii", duration: 2,
  slotsPerSemester: 1, creditType: "regular", credits: 2, division: "English",
  department: "English", description: null, fulfillsRequirements: ["English"],
  prerequisites: [], courseCodeS1: null, courseCodeS2: null, courseCode: "ENG103", gradeMin: 11, gradeMax: 11,
  isNonAcademic: false, isMarchingBand: false, attributes: [],
};

const english12: PlannerCourseDetails = {
  id: 304, title: "English IV", normalizedTitle: "english iv", duration: 2,
  slotsPerSemester: 1, creditType: "regular", credits: 2, division: "English",
  department: "English", description: null, fulfillsRequirements: ["English"],
  prerequisites: [], courseCodeS1: null, courseCodeS2: null, courseCode: "ENG104", gradeMin: 12, gradeMax: 12,
  isNonAcademic: false, isMarchingBand: false, attributes: [],
};

const biology: PlannerCourseDetails = {
  id: 102, title: "Biology", normalizedTitle: "biology", duration: 2,
  slotsPerSemester: 1, creditType: "regular", credits: 2, division: "Science",
  department: "Science", description: null, fulfillsRequirements: ["Biology", "Science"],
  prerequisites: [], courseCodeS1: null, courseCodeS2: null, courseCode: "BIO101", gradeMin: 9, gradeMax: 9,
  isNonAcademic: false, isMarchingBand: false, attributes: [],
};

function makePlanner(year: number, planned: Planner["plannedCourses"] = []): Planner {
  return { id: year - 8, schoolYear: year, label: String(year), completedAt: null, plannedCourses: planned };
}

function makePlanned(course: PlannerCourseDetails, semester: number, slot: number): Planner["plannedCourses"][number] {
  return {
    id: course.id,
    plannerId: 0,
    courseId: course.id,
    plannerOptionId: null,
    semester,
    slot,
    slotSpan: 1,
    course: { ...course },
  };
}

function makeCompleted(course: PlannerCourseDetails, grade: GradeCompleted): CompletedCourse {
  return {
    id: course.id,
    userId: -1,
    courseId: course.id,
    summerCourseId: null,
    gradeCompleted: grade,
    credits: null,
    course: { ...course },
    summerCourse: null,
  };
}

async function renderRequirementsPage() {
  render(<RequirementsPage />);
  await waitFor(
    () => {
      expect(screen.getAllByRole("heading", { level: 3 }).length).toBeGreaterThan(0);
    },
    { timeout: 3000 }
  );
}

function cardFor(requirementName: string): HTMLElement {
  const heading = screen
    .getAllByRole("heading", { level: 3 })
    .find((node) => node.textContent === requirementName);
  expect(heading).toBeDefined();
  const card = heading!.closest(".rs-req-card");
  expect(card).not.toBeNull();
  return card as HTMLElement;
}

afterEach(() => cleanup());

describe("Requirements page progress bars", () => {
  it("renders completed (green), planned (yellow) and remaining (gray) from the analysis", async () => {
    const planners: Planner[] = [
      makePlanner(9),
      makePlanner(10),
      makePlanner(11, [makePlanned(english11, 1, 1)]),
      makePlanner(12, [makePlanned(english12, 1, 1)]),
    ];
    const completedCourses = [
      makeCompleted(english9, "Freshman (9)"),
      makeCompleted(english10, "Sophomore (10)"),
      makeCompleted(biology, "Freshman (9)"),
    ];

    mocks.getPlanners.mockResolvedValue(planners);
    mocks.getCompletedCourses.mockResolvedValue(completedCourses);
    mocks.getResolutions.mockResolvedValue([]);
    mocks.getCourses.mockResolvedValue([]);
    mocks.getAnalysis.mockImplementation(async (data) => computePlannerAnalysis(data));

    await renderRequirementsPage();

    // English: 4 of 8 credits completed, the other 4 planned for future years.
    const english = await waitFor(() => {
      const card = cardFor("English");
      expect(card.querySelector('[data-segment="planned"]')).not.toBeNull();
      return card;
    }, { timeout: 2000 });

    const englishCompleted = english.querySelector('[data-segment="completed"]')!;
    const englishPlanned = english.querySelector('[data-segment="planned"]')!;
    expect(englishCompleted.style.width).toBe("50%");
    expect(englishPlanned.style.width).toBe("50%");
    expect(english.querySelector('[data-segment="remaining"]')).toBeNull();
    expect(within(english).getByText("Planned")).toBeTruthy();

    // Biology: fully completed by coursework -> all green, tagged Satisfied.
    const biologyCard = await waitFor(() => {
      const card = cardFor("Biology");
      expect(card.querySelector('[data-segment="completed"]')).not.toBeNull();
      return card;
    }, { timeout: 2000 });
    expect(biologyCard.querySelector('[data-segment="completed"]')!.style.width).toBe("100%");
    expect(biologyCard.querySelector('[data-segment="planned"]')).toBeNull();
    expect(within(biologyCard).getByText("Satisfied")).toBeTruthy();

    // Health: neither completed nor planned -> the whole bar stays gray.
    const healthCard = await waitFor(() => {
      const card = cardFor("Health");
      expect(card.querySelector('[data-segment="remaining"]')).not.toBeNull();
      return card;
    }, { timeout: 2000 });
    expect(healthCard.querySelector('[data-segment="completed"]')).toBeNull();
    expect(healthCard.querySelector('[data-segment="planned"]')).toBeNull();
    expect(within(healthCard).getByText("Not Started")).toBeTruthy();

    // The "earned so far" copy reports completed coursework, not the plan.
    expect(within(english).getByText(/You have earned 4 credits so far/)).toBeTruthy();

    // The denominator appears exactly once in the textual progress display.
    expect(screen.getAllByText("/ 45 Credits Completed")).toHaveLength(1);
  });
});
