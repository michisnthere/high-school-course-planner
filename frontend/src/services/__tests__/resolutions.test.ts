import { describe, it, expect, beforeAll } from "vitest";
import { createGuestResolutionsService } from "@/services/resolutions";

beforeAll(() => {
  (globalThis as any).window ??= {};
  (globalThis as any).window.dispatchEvent ??= () => true;
});

describe("guest resolutions service", () => {
  it("starts with empty resolutions", async () => {
    const svc = createGuestResolutionsService();
    const resolutions = await svc.getResolutions();
    expect(resolutions).toEqual([]);
  });

  it("creates a PE waiver resolution", async () => {
    const svc = createGuestResolutionsService();
    const result = await svc.createResolution({ type: "pe_waiver" });
    expect(result.type).toBe("pe_waiver");
    expect(result.id).toBeGreaterThan(0);
    expect(result.userId).toBe(-1);
  });

  it("creates a middle school resolution with metadata", async () => {
    const svc = createGuestResolutionsService();
    const result = await svc.createResolution({ type: "middle_school", courseId: 123, metadata: { grade: 8 } });
    expect(result.type).toBe("middle_school");
    expect(result.courseId).toBe(123);
    expect(result.metadata.grade).toBe(8);
  });

  it("deletes a resolution", async () => {
    const svc = createGuestResolutionsService();
    const created = await svc.createResolution({ type: "pe_waiver" });
    expect((await svc.getResolutions())).toHaveLength(1);
    await svc.deleteResolution(created.id);
    expect((await svc.getResolutions())).toHaveLength(0);
  });

  it("multiple services are isolated", async () => {
    const s1 = createGuestResolutionsService();
    const s2 = createGuestResolutionsService();
    await s1.createResolution({ type: "pe_waiver" });
    expect((await s1.getResolutions())).toHaveLength(1);
    expect((await s2.getResolutions())).toHaveLength(0);
  });

  it("increments ids per service instance", async () => {
    const s1 = createGuestResolutionsService();
    const s2 = createGuestResolutionsService();
    const r1 = await s1.createResolution({ type: "pe_waiver" });
    const r2 = await s2.createResolution({ type: "pe_waiver" });
    expect(r1.id).toBe(1);
    expect(r2.id).toBe(1); // separate counter per instance
  });
});
