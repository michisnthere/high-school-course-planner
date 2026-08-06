// Semester codes for the yearly planner.
// 1 = Semester 1, 2 = Semester 2 (the regular scheduled grid).
// 3 = Summer School, 4 = Online Courses (both outside the regular schedule).
export const SUMMER_SEMESTER = 3;
export const ONLINE_SEMESTER = 4;

export function isRegularSemester(semester: number): boolean {
  return semester === 1 || semester === 2;
}

/** True for Summer School (3) / Online Courses (4) that sit outside the grid. */
export function isOutOfSemester(semester: number): boolean {
  return !isRegularSemester(semester);
}