export const DIVISION_COLORS: Record<string, string> = {
  Mathematics: "#3b82f6", // blue
  "Communication Arts": "#ef4444", // red
  Science: "#eab308", // yellow
  "Social Studies": "#22c55e", // green
  "Applied Arts": "#a855f7", // purple
  CSET: "#14b8a6", // teal
  "Fine Arts": "#ec4899", // pink
  "Multilingual Learning": "#991b1b", // maroon
  "Physical Welfare": "#d4c5a9", // beige
};

export function getDivisionColor(division: string | null | undefined): string {
  if (!division) return "#6b7280";
  return DIVISION_COLORS[division] || "#6b7280";
}

export function getDivisionBackgroundColor(division: string | null | undefined): string {
  const base = getDivisionColor(division);
  // Convert hex to rgba with low opacity for background tint
  const hex = base.replace("#", "");
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, 0.1)`;
}
