export type GradeRequirementDefItem = {
  displayName: string;
  canonicalName: string;
  requiredCredits: number;
};

export type GradeRequirementDef = {
  grade: number;
  items: GradeRequirementDefItem[];
};

export const GRADE_LEVEL_REQUIREMENTS: GradeRequirementDef[] = [
  {
    grade: 9,
    items: [
      { displayName: "Communication Arts", canonicalName: "English", requiredCredits: 2 },
      { displayName: "Mathematics", canonicalName: "Mathematics", requiredCredits: 2 },
      { displayName: "Science", canonicalName: "Science", requiredCredits: 2 },
    ],
  },
  {
    grade: 10,
    items: [
      { displayName: "Communication Arts", canonicalName: "English", requiredCredits: 2 },
      { displayName: "Mathematics", canonicalName: "Mathematics", requiredCredits: 2 },
      { displayName: "Science", canonicalName: "Science", requiredCredits: 2 },
    ],
  },
  {
    grade: 11,
    items: [
      { displayName: "Communication Arts", canonicalName: "English", requiredCredits: 2 },
      { displayName: "Mathematics", canonicalName: "Mathematics", requiredCredits: 2 },
      { displayName: "U.S. History", canonicalName: "U.S. History", requiredCredits: 1 },
    ],
  },
  {
    grade: 12,
    items: [
      { displayName: "Communication Arts", canonicalName: "English", requiredCredits: 2 },
      { displayName: "Government", canonicalName: "Government", requiredCredits: 1 },
    ],
  },
];
