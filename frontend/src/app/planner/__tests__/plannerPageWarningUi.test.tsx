// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import React from "react";
import PlannerYearPage from "@/app/planner/[year]/page";
import { computePlannerAnalysis } from "@/lib/plannerAnalysisEngine";
import type { Planner, PlannerCourseDetails } from "@/lib/planner";

const mocks = vi.hoisted(() => ({
  getPlanners: vi.fn(),
  getCompletedCourses: vi.fn(),
  getResolutions: vi.fn(),
  getAnalysis: vi.fn(),
  getCourses: vi.fn(),
  getSavedCourseIds: vi.fn(),
  services: null as unknown as Record<string, unknown>,
}));

vi.mock("@/services/ServiceContext", () => ({
  ServiceProvider: (props: { children?: React.ReactElement }) => props.children ?? null,
  useServices: () => mocks.services,
  usePlannerService: () => (mocks.services as { planner: unknown }).planner,
  useCompletedCoursesService: () => (mocks.services as { completedCourses: unknown }).completedCourses,
  useSavedCoursesService: () => (mocks.services as { savedCourses: unknown }).savedCourses,
  useAnalysisService: () => (mocks.services as { analysis: unknown }).analysis,
  useResolutionsService: () => (mocks.services as { resolutions: unknown }).resolutions,
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
  params: { year: "10" },
  router: { replace: () => undefined, push: () => undefined },
}));

vi.mock("next/navigation", () => ({
  useParams: () => navigation.params,
  useSearchParams: () => new URLSearchParams(),
  useRouter: () => navigation.router,
}));

vi.mock("@/lib/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api")>();
  return { ...actual, getCourses: mocks.getCourses };
});

mocks.services = {
  planner: { getPlanners: mocks.getPlanners, seedCourseCatalog: () => undefined },
  completedCourses: { getCompletedCourses: mocks.getCompletedCourses },
  savedCourses: { getSavedCourseIds: mocks.getSavedCourseIds },
  analysis: { getAnalysis: mocks.getAnalysis },
  resolutions: { getResolutions: mocks.getResolutions },
};

// Production eligibility representation: PlannerCourseDetails.gradeMin/gradeMax
// aggregated from CourseOffering rows (Precalculus is offered in grades 10-12).
const Precalculus: PlannerCourseDetails = {
  id: 208, title: "Precalculus", normalizedTitle: "Precalculus", duration: 2,
  slotsPerSemester: 1, creditType: "regular", credits: 2, division: "Science",
  department: "Science", description: null, fulfillsRequirements: ["Science"],
  prerequisites: [], courseCodeS1: null, courseCodeS2: null, courseCode: "MATH301",
  gradeMin: 11, gradeMax: 12,
  isNonAcademic: false, isMarchingBand: false, attributes: [], isRepeatable: false,
  supportsEarlyBird: false, isOnline: false,
};

function makePlanners(): Planner[] {
  return [9, 10, 11, 12].map((schoolYear, index) => ({
    id: index + 1,
    schoolYear,
    label: String(schoolYear),
    completedAt: null,
    plannedCourses:
      schoolYear === 10
        ? [
            {
              id: 7001,
              plannerId: 2,
              courseId: Precalculus.id,
              plannerOptionId: null,
              semester: 1,
              slot: 1,
              slotSpan: 1,
              isEarlyBird: false,
              course: { ...Precalculus },
            },
          ]
        : [],
  }));
}

const WARNING_TEXT = "Precalculus is not offered to students in your Sophomore year.";

async function renderPlannerPage() {
  render(<PlannerYearPage />);
  await waitFor(
    () => {
      expect(screen.getAllByText(/Precalculus is not offered/).length).toBeGreaterThan(0);
    },
    { timeout: 4000 }
  );
}

describe("grade-level warning on the rendered planner page", () => {
  afterEach(() => cleanup());

  it("shows the warning in the Needs Attention box and resolves through the existing modal", async () => {
    window.scrollTo = vi.fn();
    mocks.getPlanners.mockResolvedValue(makePlanners());
    mocks.getCompletedCourses.mockResolvedValue([]);
    mocks.getResolutions.mockResolvedValue([]);
    mocks.getCourses.mockResolvedValue([]);
    mocks.getSavedCourseIds.mockResolvedValue([]);
    mocks.getAnalysis.mockImplementation(async (data) => computePlannerAnalysis(data));

    await renderPlannerPage();

    // The warning renders in the existing amber Needs Attention box.
    const box = document.querySelector('[data-tour="planner-warnings"]');
    expect(box).not.toBeNull();
    expect(box!.textContent).toContain(WARNING_TEXT);

    // Clicking it opens the existing resolution modal.
    fireEvent.click(screen.getAllByText(/Precalculus is not offered/)[0]);
    await waitFor(() => {
      expect(screen.getByText("Resolve Warning")).toBeTruthy();
    });
    expect(screen.getAllByText(/Precalculus is not offered to students in your Sophomore year\./).length).toBeGreaterThan(0);

    // Only actions that genuinely resolve this warning are offered: the
    // standard "Ignore Warning". Prerequisite-specific actions and
    // "Mark as previously completed" must not appear.
    expect(screen.getByText("Ignore Warning")).toBeTruthy();
    expect(screen.queryByText(/as previously completed/)).toBeNull();
    expect(screen.queryByText(/No matching course was found/)).toBeNull();
  });
});
