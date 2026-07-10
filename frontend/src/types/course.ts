export type CourseOffering = {
  courseCode: string;
  semesterLabel?: string | null;
  duration?: string | null;
  gradeMin?: number | null;
  gradeMax?: number | null;
  credits?: number | null;
  prerequisites?: string[];
  corequisites?: string[];
};

export type CourseOption = {
  name?: string;
  creditType?: string | null;
  credits?: number | null;
  isOnline?: boolean;
  offerings?: CourseOffering[];
};

export type Division = {
  name: string;
};

export type Department = {
  name: string;
  division?: Division | null;
};

export type Course = {
  id: number;
  title: string;
  normalizedTitle?: string | null;
  description?: string | null;
  notes?: string[];
  attributes?: string[];
  fulfillsRequirements?: string[];
  department?: Department | null;
  options?: CourseOption[];
};
