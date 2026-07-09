export type CourseOption = {
  creditType?: string | null;
  credits?: number | null;
  isOnline?: boolean;
};

export type Department = {
  name: string;
};

export type Course = {
  title: string;
  description?: string | null;
  department?: Department | null;
  options?: CourseOption[];
};