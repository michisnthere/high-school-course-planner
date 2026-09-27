// ---------------------------------------------------------------------------
// Completed-course academic period helpers (backend mirror of the frontend's
// `lib/completedCourses.ts`).
//
// The CompletedCourse schema stores the academic period in the
// `gradeCompleted` string and has no separate school-level column, so that
// exact value is the canonical discriminator for where/when a course was
// finished. Nothing here may be inferred from course names, departments, or
// course ids.
// ---------------------------------------------------------------------------

export const MIDDLE_SCHOOL_GRADE = "Middle School";

// True when a completed-course record represents middle-school completion.
// Middle-school completions still satisfy prerequisites, but they must never
// contribute to graduation requirements or graduation credit totals.
export function isMiddleSchoolGrade(gradeCompleted: string): boolean {
  return gradeCompleted === MIDDLE_SCHOOL_GRADE;
}
