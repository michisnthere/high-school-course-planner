// Semester codes for the yearly planner.
// 1 = Semester 1, 2 = Semester 2 (the regular scheduled grid).
// 3 = Summer School Semester 1, 4 = Summer School Semester 2.
// 5 = Online Courses Semester 1, 6 = Online Courses Semester 2.
// All of 3-6 live outside the regular schedule. Each has its own 7-slot budget.
export const REGULAR_SEMESTER_1 = 1;
export const REGULAR_SEMESTER_2 = 2;
export const SUMMER_SEMESTER = 3;
export const SUMMER_SEMESTER_2 = 4;
export const ONLINE_SEMESTER = 5;
export const ONLINE_SEMESTER_2 = 6;

export const SUMMER_SEMESTERS: number[] = [SUMMER_SEMESTER, SUMMER_SEMESTER_2];
export const ONLINE_SEMESTERS: number[] = [ONLINE_SEMESTER, ONLINE_SEMESTER_2];
export const OUT_OF_SEMESTERS: number[] = [...SUMMER_SEMESTERS, ...ONLINE_SEMESTERS];

export function isRegularSemester(semester: number): boolean {
  return semester === REGULAR_SEMESTER_1 || semester === REGULAR_SEMESTER_2;
}

export function isSummerSemester(semester: number): boolean {
  return semester === SUMMER_SEMESTER || semester === SUMMER_SEMESTER_2;
}

export function isOnlineSemester(semester: number): boolean {
  return semester === ONLINE_SEMESTER || semester === ONLINE_SEMESTER_2;
}

/** True for Summer School / Online Courses semesters that sit outside the grid. */
export function isOutOfSemester(semester: number): boolean {
  return !isRegularSemester(semester);
}

/** For an out-of-semester code, returns the pair of semesters in its block. */
export function getOutOfSemesterBlock(semester: number): number[] {
  return isSummerSemester(semester) ? [...SUMMER_SEMESTERS] : [...ONLINE_SEMESTERS];
}