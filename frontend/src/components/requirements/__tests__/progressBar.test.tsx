// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import React from "react";
import { ProgressBar, type ProgressBarProps } from "@/components/requirements/ProgressBar";

vi.mock("@/context/I18nContext", () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, string>) =>
      params ? `${key} ${JSON.stringify(params)}` : key,
    locale: "en",
    setLocale: () => undefined,
    availableLocales: [],
  }),
}));

afterEach(() => cleanup());

const GREEN = "#275D38";
const YELLOW = "#ECBA2B";
const GRAY = "#D1D5DB";

function segmentColor(value: string | undefined): string {
  if (!value) return "";
  // jsdom may normalize hex colors to their rgb() form.
  const match = /^rgb\((\d+),\s*(\d+),\s*(\d+)\)$/.exec(value);
  if (!match) return value;
  const hex = [match[1], match[2], match[3]]
    .map((part) => Number(part).toString(16).padStart(2, "0"))
    .join("");
  return `#${hex.toUpperCase()}`;
}

async function renderBar(props: Partial<ProgressBarProps>): Promise<HTMLElement> {
  render(<ProgressBar showLabel {...props} />);
  const bar = screen.getByRole("progressbar");
  await waitFor(
    () => {
      expect(bar.querySelectorAll("[data-segment]").length).toBeGreaterThan(0);
    },
    { timeout: 2000 }
  );
  return bar;
}

function segment(bar: HTMLElement, name: "completed" | "planned" | "remaining"): HTMLElement | null {
  return bar.querySelector<HTMLElement>(`[data-segment="${name}"]`);
}

describe("Requirement progress bar rendering", () => {
  it("renders green + yellow for a half completed, half planned requirement", async () => {
    const bar = await renderBar({ totalValue: 4, completedValue: 2, plannedValue: 2 });
    const green = segment(bar, "completed");
    const yellow = segment(bar, "planned");
    expect(green).not.toBeNull();
    expect(yellow).not.toBeNull();
    expect(segment(bar, "remaining")).toBeNull();
    expect(green!.style.width).toBe("50%");
    expect(yellow!.style.width).toBe("50%");
    expect(segmentColor(green!.style.backgroundColor)).toBe(GREEN);
    expect(segmentColor(yellow!.style.backgroundColor)).toBe(YELLOW);
  });

  it("renders green + yellow + gray when part of the requirement is unmet", async () => {
    const bar = await renderBar({ totalValue: 4, completedValue: 1, plannedValue: 1 });
    expect(segment(bar, "completed")!.style.width).toBe("25%");
    expect(segment(bar, "planned")!.style.width).toBe("25%");
    expect(segment(bar, "remaining")!.style.width).toBe("50%");
    expect(segmentColor(segment(bar, "remaining")!.style.backgroundColor)).toBe(GRAY);
    expect(bar.getAttribute("aria-valuenow")).toBe("50");
  });

  it("renders all green when the requirement is fully completed", async () => {
    const bar = await renderBar({ totalValue: 4, completedValue: 4, plannedValue: 0 });
    expect(segment(bar, "completed")!.style.width).toBe("100%");
    expect(segment(bar, "planned")).toBeNull();
    expect(segment(bar, "remaining")).toBeNull();
    expect(bar.getAttribute("aria-valuenow")).toBe("100");
  });

  it("renders all gray when nothing is completed or planned", async () => {
    const bar = await renderBar({ totalValue: 4, completedValue: 0, plannedValue: 0 });
    expect(segment(bar, "completed")).toBeNull();
    expect(segment(bar, "planned")).toBeNull();
    expect(segment(bar, "remaining")!.style.width).toBe("100%");
    expect(bar.getAttribute("aria-valuenow")).toBe("0");
  });

  it("clamps a planned value that exceeds the remaining requirement", async () => {
    const bar = await renderBar({ totalValue: 4, completedValue: 3, plannedValue: 3 });
    expect(segment(bar, "completed")!.style.width).toBe("75%");
    expect(segment(bar, "planned")!.style.width).toBe("25%");
    expect(segment(bar, "remaining")).toBeNull();
    // Segments never add up to more than the requirement total.
    expect(bar.getAttribute("aria-valuenow")).toBe("100");
  });

  it("shows the percentage label exactly once", async () => {
    render(<ProgressBar totalValue={4} completedValue={1} plannedValue={1} showLabel />);
    await waitFor(() => {
      expect(screen.getByText("50%")).toBeTruthy();
    }, { timeout: 2000 });
    expect(screen.getAllByText(/%$/)).toHaveLength(1);
  });
});
