const API_URL = typeof window === "undefined" ? (process.env.BACKEND_URL || "http://localhost:4000") : "";

export async function getCourses() {
  const response = await fetch(`${API_URL}/courses`);

  if (!response.ok) {
    throw new Error("Failed to fetch courses");
  }

  return response.json();
}

export type RequirementResolution = {
  id: number;
  userId: number;
  type: "pe_waiver" | "middle_school" | "summer_school" | "placement_test" | "admin_override";
  courseId: number | null;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

export async function getResolutions(): Promise<RequirementResolution[]> {
  const response = await fetch(`${API_URL}/api/resolutions`, { credentials: "include" });
  if (!response.ok) throw new Error("Failed to fetch resolutions");
  return response.json();
}

export async function createResolution(data: {
  type: string;
  courseId?: number;
  metadata?: Record<string, unknown>;
}): Promise<RequirementResolution> {
  const response = await fetch(`${API_URL}/api/resolutions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(data),
  });
  if (!response.ok) throw new Error("Failed to create resolution");
  return response.json();
}

export async function deleteResolution(id: number): Promise<void> {
  const response = await fetch(`${API_URL}/api/resolutions/${id}`, {
    method: "DELETE",
    credentials: "include",
  });
  if (!response.ok) throw new Error("Failed to delete resolution");
}