export const GRADUATION_REQUIREMENT_STARTING_YEAR: Record<string, number> = {
  English: 9,
  Mathematics: 9,
  Science: 9,
  Biology: 9,
  "Physical Science": 9,
  "World History and Geography": 9,
  "Social Studies": 9,
  "Physical Education": 9,
  Health: 9,
  "Fine Arts": 9,
  "Applied Arts": 9,
  Electives: 9,
  "Driver Education": 10,
  "U.S. History": 11,
  "Economics or Personal Finance": 11,
  Government: 12,
  "Civics & Patriotism": 12,
  FAFSA: 12,
};

export function getGraduationRequirementStartingYear(name: string): number | null {
  return GRADUATION_REQUIREMENT_STARTING_YEAR[name] ?? null;
}

export function isGraduationRequirementVisibleForYear(name: string, year: number): boolean {
  const startingYear = getGraduationRequirementStartingYear(name);
  if (startingYear == null) return false;
  return year >= startingYear;
}
