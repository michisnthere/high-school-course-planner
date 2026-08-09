import { describe, it, expect, beforeAll } from "vitest";
import type { PlannerCourseDetails } from "@/lib/planner";
import { createGuestPlannerService, authPlannerService } from "@/services/planner";
import { getCourseCredits, sumPlannedCredits } from "@/lib/courseCredits";

beforeAll(() => {
  (globalThis as any).window ??= {};
  (globalThis as any).window.dispatchEvent ??= () => true;
});

const chemistry: PlannerCourseDetails = {
  id: 1,
  title: "Chemistry",
  normalizedTitle: "chemistry",
  duration: 2,
  slotsPerSemester: 1,
  creditType: "regular",
  credits: 2,
  division: "Science",
  department: "Science",
  description: "Study of matter",
  fulfillsRequirements: ["Science", "Lab Science"],
  prerequisites: [],
  courseCode: "SCI101",
  courseCodeS1: null,
  courseCodeS2: null,
  gradeMin: 10,
  gradeMax: 12,
  isNonAcademic: false,
  isMarchingBand: false,
};

const biology: PlannerCourseDetails = {
  id: 2,
  title: "Biology",
  normalizedTitle: "biology",
  duration: 2,
  slotsPerSemester: 1,
  creditType: "regular",
  credits: 2,
  division: "Science",
  department: "Science",
  description: "Study of life",
  fulfillsRequirements: ["Science", "Lab Science"],
  prerequisites: [],
  courseCode: "SCI100",
  courseCodeS1: null,
  courseCodeS2: null,
  gradeMin: 9,
  gradeMax: 10,
  isNonAcademic: false,
  isMarchingBand: false,
};

const algebra: PlannerCourseDetails = {
  id: 3,
  title: "Algebra I",
  normalizedTitle: "algebra i",
  duration: 2,
  slotsPerSemester: 1,
  creditType: "regular",
  credits: 2,
  division: "Mathematics",
  department: "Mathematics",
  description: null,
  fulfillsRequirements: ["Mathematics"],
  prerequisites: [],
  courseCode: "MATH101",
  courseCodeS1: null,
  courseCodeS2: null,
  gradeMin: 9,
  gradeMax: 9,
  isNonAcademic: false,
  isMarchingBand: false,
};

const catalog = [chemistry, biology, algebra];

const health: PlannerCourseDetails = {
  id: 5,
  title: "Health",
  normalizedTitle: "health",
  duration: 1,
  slotsPerSemester: 1,
  creditType: "regular",
  credits: 1,
  division: "Health",
  department: "Health",
  description: null,
  fulfillsRequirements: ["Health"],
  prerequisites: [],
  courseCode: "HLT101",
  courseCodeS1: null,
  courseCodeS2: null,
  gradeMin: 9,
  gradeMax: 12,
  isNonAcademic: false,
  isMarchingBand: false,
};

const americanStudies: PlannerCourseDetails = {
  id: 4,
  title: "American Studies",
  normalizedTitle: "american studies",
  duration: 2,
  slotsPerSemester: 2,
  creditType: "regular",
  credits: 4,
  division: "Social Studies",
  department: "Social Studies",
  description: "Linked English and U.S. History course",
  fulfillsRequirements: ["English", "U.S. History"],
  prerequisites: [],
  courseCode: "SOC581",
  gradeMin: 11,
  gradeMax: 11,
  isNonAcademic: false,
  isMarchingBand: false,
  attributes: [],
};

describe("guest planner service", () => {
  describe("searchPlannerCourses", () => {
    it("seeded catalog courses are searchable by title", async () => {
      const service = createGuestPlannerService();
      service.seedCourseCatalog(catalog);
      const results = await service.searchPlannerCourses("chem");
      expect(results).toHaveLength(1);
      expect(results[0].title).toBe("Chemistry");
    });

    it("seeded catalog courses are searchable by course code", async () => {
      const service = createGuestPlannerService();
      service.seedCourseCatalog(catalog);
      const results = await service.searchPlannerCourses("sci101");
      expect(results).toHaveLength(1);
      expect(results[0].courseCode).toBe("SCI101");
    });

    it("returns multiple matches matching title substring", async () => {
      const service = createGuestPlannerService();
      service.seedCourseCatalog(catalog);
      const results = await service.searchPlannerCourses("biolog");
      expect(results).toHaveLength(1);
    });

    it("returns empty array when catalog is not seeded", async () => {
      const service = createGuestPlannerService();
      const results = await service.searchPlannerCourses("chem");
      expect(results).toEqual([]);
    });

    it("returns empty array for no match", async () => {
      const service = createGuestPlannerService();
      service.seedCourseCatalog(catalog);
      const results = await service.searchPlannerCourses("zzzzz");
      expect(results).toEqual([]);
    });
  });

  describe("addPlannedCourse", () => {
    it("adds a real course with correct title", async () => {
      const service = createGuestPlannerService();
      service.seedCourseCatalog(catalog);
      const planners = await service.getPlanners();
      const planner = planners.find((p) => p.schoolYear === 9)!;
      const updated = await service.addPlannedCourse(planner.id, chemistry.id, 1, 1);
      const added = updated.plannedCourses[0];
      expect(added.course.title).toBe("Chemistry");
      expect(added.course.division).toBe("Science");
      expect(added.course.credits).toBe(2);
      expect(added.course.courseCode).toBe("SCI101");
      expect(added.courseId).toBe(1);
    });

    it("stores fulfillsRequirements from real course", async () => {
      const service = createGuestPlannerService();
      service.seedCourseCatalog(catalog);
      const planners = await service.getPlanners();
      const planner = planners.find((p) => p.schoolYear === 9)!;
      const updated = await service.addPlannedCourse(planner.id, chemistry.id, 1, 1);
      const added = updated.plannedCourses[0];
      expect(added.course.fulfillsRequirements).toContain("Science");
    });

    it("assigns correct semester and slot", async () => {
      const service = createGuestPlannerService();
      service.seedCourseCatalog(catalog);
      const planners = await service.getPlanners();
      const planner = planners.find((p) => p.schoolYear === 9)!;
      const updated = await service.addPlannedCourse(planner.id, biology.id, 2, 3);
      // Full-year courses create entries for both semesters
      expect(updated.plannedCourses).toHaveLength(2);
      expect(updated.plannedCourses[0].semester).toBe(1);
      expect(updated.plannedCourses[0].slot).toBe(3);
      expect(updated.plannedCourses[1].semester).toBe(2);
      expect(updated.plannedCourses[1].slot).toBe(3);
    });

    it("throws when catalog is not seeded", async () => {
      const service = createGuestPlannerService();
      const planners = await service.getPlanners();
      const planner = planners.find((p) => p.schoolYear === 9)!;
      await expect(
        service.addPlannedCourse(planner.id, 999, 1, 1)
      ).rejects.toThrow("not found in catalog");
    });

    it("throws for unknown course id", async () => {
      const service = createGuestPlannerService();
      service.seedCourseCatalog(catalog);
      const planners = await service.getPlanners();
      const planner = planners.find((p) => p.schoolYear === 9)!;
      await expect(
        service.addPlannedCourse(planner.id, 999, 1, 1)
      ).rejects.toThrow("not found in catalog");
    });

    it("adds to correct planner year", async () => {
      const service = createGuestPlannerService();
      service.seedCourseCatalog(catalog);
      const planners = await service.getPlanners();
      const planner9 = planners.find((p) => p.schoolYear === 9)!;
      const planner10 = planners.find((p) => p.schoolYear === 10)!;
      await service.addPlannedCourse(planner9.id, biology.id, 1, 1);
      await service.addPlannedCourse(planner10.id, chemistry.id, 1, 1);
      const y9 = await service.getPlanner(9);
      const y10 = await service.getPlanner(10);
      // Full-year courses create entries for both semesters
      expect(y9.plannedCourses).toHaveLength(2);
      expect(y9.plannedCourses[0].course.title).toBe("Biology");
      expect(y10.plannedCourses).toHaveLength(2);
      expect(y10.plannedCourses[0].course.title).toBe("Chemistry");
    });

    it("increments planned course ids", async () => {
      const service = createGuestPlannerService();
      service.seedCourseCatalog(catalog);
      const planners = await service.getPlanners();
      const planner = planners.find((p) => p.schoolYear === 9)!;
      const r1 = await service.addPlannedCourse(planner.id, biology.id, 1, 1);
      const r2 = await service.addPlannedCourse(planner.id, chemistry.id, 1, 2);
      expect(r2.plannedCourses[1].id).toBe(r1.plannedCourses[0].id + 1);
    });

    it("places American Studies in adjacent slots in both semesters", async () => {
      const service = createGuestPlannerService();
      service.seedCourseCatalog([...catalog, americanStudies]);
      const planner = (await service.getPlanners()).find((p) => p.schoolYear === 11)!;
      const updated = await service.addPlannedCourse(planner.id, americanStudies.id, 1, 5);

      expect(updated.plannedCourses).toHaveLength(2);
      expect(updated.plannedCourses.map((pc) => [pc.semester, pc.slot, pc.slotSpan])).toEqual([
        [1, 5, 2],
        [2, 5, 2],
      ]);
      expect(sumPlannedCredits(updated.plannedCourses)).toBe(getCourseCredits(americanStudies));
    });

    it("falls back to first available pair when occupied courses cannot be shifted", async () => {
      const service = createGuestPlannerService();
      service.seedCourseCatalog([...catalog, americanStudies]);
      const planner = (await service.getPlanners()).find((p) => p.schoolYear === 11)!;
      await service.addPlannedCourse(planner.id, biology.id, 1, 1);
      await service.addPlannedCourse(planner.id, chemistry.id, 2, 2);

      const updated = await service.addPlannedCourse(planner.id, americanStudies.id, 1, 1);

      expect(updated.plannedCourses.filter((pc) => pc.courseId === americanStudies.id).map((pc) => [pc.semester, pc.slot])).toEqual([
        [1, 3],
        [2, 3],
      ]);
    });

    it("falls back from slot 7 to first valid pair for American Studies", async () => {
      const service = createGuestPlannerService();
      service.seedCourseCatalog([...catalog, americanStudies]);
      const planner = (await service.getPlanners()).find((p) => p.schoolYear === 11)!;
      const updated = await service.addPlannedCourse(planner.id, americanStudies.id, 1, 7);
      const slots = updated.plannedCourses.filter((pc) => pc.courseId === americanStudies.id).map((pc) => pc.slot);
      expect(slots).toEqual([1, 1]);
    });

    it("does not partially place American Studies when both semesters lack adjacent space", async () => {
      const service = createGuestPlannerService();
      service.seedCourseCatalog([...catalog, americanStudies]);
      const planner = (await service.getPlanners()).find((p) => p.schoolYear === 11)!;
      for (const slot of [1, 3, 5, 7]) {
        await service.addPlannedCourse(planner.id, biology.id, 1, slot);
      }

      await expect(service.addPlannedCourse(planner.id, americanStudies.id, 1, 1)).rejects.toThrow(
        "American Studies requires two consecutive periods. There is not enough space in this semester."
      );
      const after = await service.getPlanner(11);
      expect(after.plannedCourses.some((pc) => pc.courseId === americanStudies.id)).toBe(false);
    });
  });

  describe("out-of-semester one-course-per-semester rule", () => {
    it("adds a one-semester course to Summer S1 at slot 1", async () => {
      const service = createGuestPlannerService();
      service.seedCourseCatalog([...catalog, health]);
      const planner = (await service.getPlanners()).find((p) => p.schoolYear === 11)!;
      const updated = await service.addPlannedCourse(planner.id, health.id, 3, 1);
      expect(updated.plannedCourses).toHaveLength(1);
      expect(updated.plannedCourses[0].semester).toBe(3);
      expect(updated.plannedCourses[0].slot).toBe(1);
    });

    it("blocks a second course in the same Summer semester", async () => {
      const service = createGuestPlannerService();
      service.seedCourseCatalog([...catalog, health]);
      const planner = (await service.getPlanners()).find((p) => p.schoolYear === 11)!;
      await service.addPlannedCourse(planner.id, health.id, 3, 1);
      await expect(
        service.addPlannedCourse(planner.id, biology.id, 3, 1)
      ).rejects.toThrow("already has a course");
    });

    it("allows independent courses in Summer S1 and S2", async () => {
      const service = createGuestPlannerService();
      service.seedCourseCatalog([...catalog, health]);
      const planner = (await service.getPlanners()).find((p) => p.schoolYear === 11)!;
      await service.addPlannedCourse(planner.id, health.id, 3, 1);
      await service.addPlannedCourse(planner.id, health.id, 4, 1);
      const after = await service.getPlanner(11);
      const s1 = after.plannedCourses.filter((pc) => pc.semester === 3);
      const s2 = after.plannedCourses.filter((pc) => pc.semester === 4);
      expect(s1.length).toBe(1);
      expect(s2.length).toBe(1);
      expect(s2[0].slot).toBe(1);
    });

    it("blocks a second course in Online S2", async () => {
      const service = createGuestPlannerService();
      service.seedCourseCatalog([...catalog, health]);
      const planner = (await service.getPlanners()).find((p) => p.schoolYear === 11)!;
      await service.addPlannedCourse(planner.id, health.id, 6, 1);
      await expect(
        service.addPlannedCourse(planner.id, biology.id, 6, 1)
      ).rejects.toThrow("already has a course");
    });

    it("adds a full-year course to Summer occupying both S1 and S2", async () => {
      const service = createGuestPlannerService();
      service.seedCourseCatalog(catalog);
      const planner = (await service.getPlanners()).find((p) => p.schoolYear === 11)!;
      const updated = await service.addPlannedCourse(planner.id, biology.id, 3, 1);
      const rows = updated.plannedCourses.filter((pc) => pc.courseId === biology.id);
      expect(rows.map((pc) => [pc.semester, pc.slot])).toEqual([
        [3, 1],
        [4, 1],
      ]);
      expect(updated.plannedCourses).toHaveLength(2);
    });

    it("blocks another course when a full-year course occupies both Summer semesters", async () => {
      const service = createGuestPlannerService();
      service.seedCourseCatalog(catalog);
      const planner = (await service.getPlanners()).find((p) => p.schoolYear === 11)!;
      await service.addPlannedCourse(planner.id, biology.id, 3, 1);
      await expect(
        service.addPlannedCourse(planner.id, chemistry.id, 3, 1)
      ).rejects.toThrow("already has a course");
      await expect(
        service.addPlannedCourse(planner.id, algebra.id, 4, 1)
      ).rejects.toThrow("already has a course");
    });

    it("does not double-count credits for a full-year Summer course", async () => {
      const service = createGuestPlannerService();
      service.seedCourseCatalog(catalog);
      const planner = (await service.getPlanners()).find((p) => p.schoolYear === 11)!;
      const updated = await service.addPlannedCourse(planner.id, biology.id, 3, 1);
      expect(sumPlannedCredits(updated.plannedCourses)).toBe(getCourseCredits(biology));
    });
  });

  describe("guest data isolation", () => {
    it("fresh service starts empty", async () => {
      const service = createGuestPlannerService();
      const planners = await service.getPlanners();
      for (const p of planners) {
        expect(p.plannedCourses).toEqual([]);
      }
    });

    it("separate service instances do not share data", async () => {
      const s1 = createGuestPlannerService();
      s1.seedCourseCatalog(catalog);
      const s2 = createGuestPlannerService();
      s2.seedCourseCatalog(catalog);
      const p1 = await s1.getPlanners();
      const p2 = await s2.getPlanners();
      await s1.addPlannedCourse(p1[0].id, biology.id, 1, 1);
      const p2after = await s2.getPlanners();
      // s2 should have no courses — data not shared
      expect(p2after[0].plannedCourses).toEqual([]);
    });

    it("second service instance starts fresh with new course ids", async () => {
      const s1 = createGuestPlannerService();
      s1.seedCourseCatalog(catalog);
      const s2 = createGuestPlannerService();
      s2.seedCourseCatalog(catalog);
      const p1 = await s1.getPlanners();
      const p2 = await s2.getPlanners();
      const r1 = await s1.addPlannedCourse(p1[0].id, biology.id, 1, 1);
      const r2 = await s2.addPlannedCourse(p2[0].id, biology.id, 1, 1);
      // both should have id 1 since they are separate instances
      expect(r1.plannedCourses[0].id).toBe(1);
      expect(r2.plannedCourses[0].id).toBe(1);
    });

    it("re-seeding catalog replaces old data", async () => {
      const service = createGuestPlannerService();
      service.seedCourseCatalog(catalog);
      service.seedCourseCatalog([chemistry]); // narrower catalog
      const results = await service.searchPlannerCourses("bio");
      expect(results).toEqual([]);
    });
  });

  describe("removePlannedCourse", () => {
    it("removes course from planner", async () => {
      const service = createGuestPlannerService();
      service.seedCourseCatalog(catalog);
      const planners = await service.getPlanners();
      const planner = planners.find((p) => p.schoolYear === 9)!;
      const updated = await service.addPlannedCourse(planner.id, biology.id, 1, 1);
      const courseId = updated.plannedCourses[0].id;
      await service.removePlannedCourse(courseId);
      const after = await service.getPlanner(9);
      expect(after.plannedCourses).toEqual([]);
    });

    it("removes all American Studies linked slots", async () => {
      const service = createGuestPlannerService();
      service.seedCourseCatalog([...catalog, americanStudies]);
      const planner = (await service.getPlanners()).find((p) => p.schoolYear === 11)!;
      const updated = await service.addPlannedCourse(planner.id, americanStudies.id, 1, 1);
      await service.removePlannedCourse(updated.plannedCourses[0].id);
      const after = await service.getPlanner(11);
      expect(after.plannedCourses).toEqual([]);
    });
  });

  describe("movePlannedCourse", () => {
    it("moves course to new semester and slot", async () => {
      const service = createGuestPlannerService();
      service.seedCourseCatalog(catalog);
      const planners = await service.getPlanners();
      const planner = planners.find((p) => p.schoolYear === 9)!;
      const updated = await service.addPlannedCourse(planner.id, biology.id, 1, 1);
      const courseId = updated.plannedCourses[0].id;
      const moved = await service.movePlannedCourse(courseId, 2, 3);
      const entry = moved.plannedCourses[0];
      expect(entry.semester).toBe(2);
      expect(entry.slot).toBe(3);
    });

    it("moves all American Studies linked slots together", async () => {
      const service = createGuestPlannerService();
      service.seedCourseCatalog([...catalog, americanStudies]);
      const planner = (await service.getPlanners()).find((p) => p.schoolYear === 11)!;
      const updated = await service.addPlannedCourse(planner.id, americanStudies.id, 1, 1);
      const moved = await service.movePlannedCourse(updated.plannedCourses[0].id, 1, 4);
      expect(moved.plannedCourses.map((pc) => [pc.semester, pc.slot])).toEqual([
        [1, 4],
        [2, 4],
      ]);
    });
  });
});

describe("authenticated planner service", () => {
  it("seedCourseCatalog is a no-op", () => {
    expect(() => authPlannerService.seedCourseCatalog(catalog)).not.toThrow();
  });
});

describe("guest year completion shares completed courses", () => {
  it("marking a year completed records its planned courses as completed (no credit loss)", async () => {
    const { createGuestDataStore } = await import("@/services/guestStore");
    const { createGuestCompletedCoursesService } = await import("@/services/completedCourses");
    const store = createGuestDataStore();
    const plannerSvc = createGuestPlannerService(store);
    const completedSvc = createGuestCompletedCoursesService(store);

    plannerSvc.seedCourseCatalog(catalog);
    const planners = await plannerSvc.getPlanners();
    const year9 = planners.find((p) => p.schoolYear === 9)!;
    const updated = await plannerSvc.addPlannedCourse(year9.id, chemistry.id, 1, 1);

    const marked = await plannerSvc.markYearCompleted(updated.id);
    expect(marked.completedAt).not.toBeNull();

    const completed = await completedSvc.getCompletedCourses();
    expect(completed.length).toBe(1);
    expect(completed[0].courseId).toBe(chemistry.id);
    expect(completed[0].gradeCompleted).toBe("Freshman (9)");

    // Unmarking the year removes exactly the courses auto-recorded at completion.
    await plannerSvc.unmarkYearCompleted(updated.id);
    expect((await completedSvc.getCompletedCourses()).length).toBe(0);
  });
});
