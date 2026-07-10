const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

export async function getSavedCourseIds(): Promise<number[]> {
  const response = await fetch(`${API_URL}/saved-courses`, {
    credentials: "include",
  });

  if (!response.ok) {
    throw new Error("Failed to fetch saved courses");
  }

  const saved: { courseId: number }[] = await response.json();
  return saved.map((item) => item.courseId);
}

export async function saveCourse(courseId: number): Promise<void> {
  const response = await fetch(`${API_URL}/saved-courses`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ courseId }),
  });

  if (!response.ok) {
    throw new Error("Failed to save course");
  }
}

export async function removeSavedCourse(courseId: number): Promise<void> {
  const response = await fetch(`${API_URL}/saved-courses/${courseId}`, {
    method: "DELETE",
    credentials: "include",
  });

  if (!response.ok) {
    throw new Error("Failed to remove saved course");
  }
}
