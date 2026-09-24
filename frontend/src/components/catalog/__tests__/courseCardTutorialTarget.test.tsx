// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import React from "react";
import { render, cleanup } from "@testing-library/react";
import { findTutorialTarget } from "@/lib/tutorial";

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    ...rest
  }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) =>
    React.createElement("a", { href, ...rest }, children),
}));

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("@/components/catalog/SaveCourseButton", () => ({
  SaveCourseButton: () => null,
}));

import { CourseCard } from "@/components/catalog/CourseCard";
import type { Course } from "@/types/course";

function makeCourse(id: number, title: string): Course {
  return {
    id,
    title,
    description: `Description for ${title}`,
    options: [],
    catalogMeta: [],
  };
}

describe("findTutorialTarget with duplicate hidden/visible nodes", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  afterEach(() => {
    cleanup();
  });

  it("returns the visible match, not the first hidden match", () => {
    const hidden = document.createElement("button");
    hidden.setAttribute("data-tour", "language-settings");
    // display:none → getClientRects() is empty
    hidden.style.display = "none";
    document.body.appendChild(hidden);

    const visible = document.createElement("button");
    visible.setAttribute("data-tour", "language-settings");
    visible.style.display = "inline-block";
    // jsdom getClientRects() returns [] for all elements; stub visibility check
    // by giving the visible node a non-empty rect list.
    visible.getClientRects = () => [{ length: 1 } as unknown as DOMRect];
    document.body.appendChild(visible);

    const found = findTutorialTarget("[data-tour='language-settings']");
    expect(found).toBe(visible);
    expect(found).not.toBe(hidden);
  });

  it("returns null when all matches are hidden", () => {
    const hidden = document.createElement("button");
    hidden.setAttribute("data-tour", "language-settings");
    hidden.style.display = "none";
    document.body.appendChild(hidden);

    expect(findTutorialTarget("[data-tour='language-settings']")).toBeNull();
  });

  it("returns null for a selector with no matches", () => {
    expect(findTutorialTarget("[data-tour='does-not-exist']")).toBeNull();
  });
});

describe("CourseCard Algebra 1 tutorial target uniqueness", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  afterEach(() => {
    cleanup();
  });

  it("renders exactly one [data-tutorial-target='course-algebra-1'] when Algebra 1 is among many cards", () => {
    const courses = [
      makeCourse(1, "Acting 1"),
      makeCourse(2, "Adventure Education"),
      makeCourse(3, "Algebra 1"),
      makeCourse(4, "Alternative PE"),
      makeCourse(5, "Art and Design"),
    ];

    render(
      <div>
        {courses.map((course) => (
          <CourseCard key={course.id} course={course} />
        ))}
      </div>
    );

    const matches = document.querySelectorAll("[data-tutorial-target='course-algebra-1']");
    expect(matches).toHaveLength(1);

    const card = matches[0] as HTMLElement;
    expect(card.getAttribute("data-course-slug")).toBe("algebra-1");
    expect(card.textContent).toContain("Algebra 1");

    // jsdom returns empty getClientRects(); stub layout so findTutorialTarget
    // treats the card as visible, matching production behavior.
    card.getClientRects = () => [{ length: 1 } as unknown as DOMRect];
    expect(findTutorialTarget("[data-tutorial-target='course-algebra-1']")).toBe(card);
  });

  it("does not set data-tutorial-target on non-Algebra-1 cards", () => {
    render(
      <div>
        <CourseCard course={makeCourse(1, "Acting 1")} />
        <CourseCard course={makeCourse(5, "Art and Design")} />
      </div>
    );

    expect(document.querySelectorAll("[data-tutorial-target]")).toHaveLength(0);
    expect(findTutorialTarget("[data-tutorial-target='course-algebra-1']")).toBeNull();
  });

  it("still sets data-course-slug on every card", () => {
    render(
      <div>
        <CourseCard course={makeCourse(1, "Acting 1")} />
        <CourseCard course={makeCourse(3, "Algebra 1")} />
      </div>
    );

    const slugs = Array.from(document.querySelectorAll("[data-course-slug]")).map(
      (el) => el.getAttribute("data-course-slug")
    );
    expect(slugs).toEqual(["acting-1", "algebra-1"]);
  });
});
