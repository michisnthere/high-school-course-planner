export type RequirementLike = {
  name: string;
  category?: string | null;
  requirementType?: string | null;
  requiredValue?: number | null;
  notes?: unknown;
  sourceReference?: string | null;
};

export type InformationItem = {
  id: number;
  name: string;
  category: string | null;
  requirementType: string | null;
  notes: unknown;
  sourceReference: string | null;
  explanation: string;
};

export const REQUIREMENT_NAME_ALIASES = new Map<string, string>([
  ["english graduation requirement", "English"],
  ["mathematics graduation requirement", "Mathematics"],
  ["science graduation requirement", "Science"],
  ["social studies graduation requirement", "Social Studies"],
  ["civics and patriotism graduation requirements", "Civics & Patriotism"],
  ["civics and patriotism", "Civics & Patriotism"],
  ["driver education graduation requirement", "Driver Education"],
  ["elective graduation requirement", "Electives"],
  ["economics or personal finance graduation requirement", "Consumer Education"],
  ["economics or personal finance", "Consumer Education"],
  ["health graduation requirement", "Health"],
  ["physical welfare", "Physical Education"],
  ["physical welfare graduation requirement and waivers", "Physical Education"],
  ["the “46th credit” graduation requirement", "46th Credit"],
  ["the \"46th credit\" graduation requirement", "46th Credit"],
  ["fafsa graduation requirement", "FAFSA"],
  ["admission requirements to public universities in illinois", "Illinois Public University Admission Requirements"],
  ["ncaa eligibility requirements for division i and ii athletes", "NCAA"],
  ["schedule change guidelines", "Schedule Changes"],
]);

export const NON_GRADUATION_REQUIREMENT_NAMES = new Set([
  "Graduation Planner",
  "Course Selection",
  "School Day Schedule",
  "Course Availability",
]);

export const INFORMATION_ITEM_NAMES = new Set([
  "Civics & Patriotism",
  "FAFSA",
  "NCAA",
  "Illinois Public University Admission Requirements",
  "Schedule Changes",
  "ACT Graduation Requirement",
  "ACT",
  "46th Credit",
  "Special Scheduling Provisions",
  "Suggested College Admission Sequence",
  "Course Load",
  "Independent Study",
  "Course Retake Policy",
  "Audits",
  "External Credits",
  "Summer School",
  "Early Graduation",
  "Grading",
  "Course Description",
  "Grade Point Average",
  "College Prep Courses",
  "Honors/Accelerated Courses",
  "Advanced Placement (AP) Courses",
  "Exclusions",
  "Grade Point Waiver",
  "Transfer Students",
  "Homework Requests",
  "Incomplete Grade",
]);

const MEASURABLE_REQUIREMENT_NAMES = new Set([
  "English",
  "Mathematics",
  "Science",
  "Biology",
  "Physical Science",
  "Health",
  "Consumer Education",
  "Driver Education",
  "Fine Arts",
  "Electives",
  "Physical Education",
  "Social Studies",
  "U.S. History",
  "World History and Geography",
  "Government",
  "Additional Credits and P.E.",
  "Total Credits",
]);

function normalizeKey(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

export function canonicalRequirementName(name: string): string {
  return REQUIREMENT_NAME_ALIASES.get(normalizeKey(name)) ?? name.trim();
}

export function isNonGraduationRequirementName(name: string): boolean {
  return NON_GRADUATION_REQUIREMENT_NAMES.has(canonicalRequirementName(name));
}

export function isInformationItemName(name: string): boolean {
  return INFORMATION_ITEM_NAMES.has(canonicalRequirementName(name));
}

export function isMeasurableGraduationRequirementName(name: string): boolean {
  return MEASURABLE_REQUIREMENT_NAMES.has(canonicalRequirementName(name));
}

export function normalizeRequirementNames(names: string[] | undefined): string[] {
  const result = new Set<string>();
  for (const raw of Array.isArray(names) ? names : []) {
    if (typeof raw !== "string" || !raw.trim()) continue;
    const canonical = canonicalRequirementName(raw);
    if (isNonGraduationRequirementName(canonical) || isInformationItemName(canonical)) continue;
    result.add(canonical);
  }
  return Array.from(result);
}

export function isMeasurableGraduationRequirement(req: RequirementLike): boolean {
  const name = canonicalRequirementName(req.name);
  return (
    isMeasurableGraduationRequirementName(name) &&
    !isNonGraduationRequirementName(name) &&
    !isInformationItemName(name)
  );
}

export function isInformationItem(req: RequirementLike): boolean {
  const name = canonicalRequirementName(req.name);
  return isInformationItemName(name) || (!isMeasurableGraduationRequirementName(name) && !isNonGraduationRequirementName(name));
}
