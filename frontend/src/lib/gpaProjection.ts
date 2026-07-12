const API_URL =
  typeof window === "undefined" ? "http://localhost:4000" : process.env.NEXT_PUBLIC_API_URL || "";

export type GpaProjection = {
  current: {
    weighted: number;
    unweighted: number;
    credits: number;
  };
  projected: {
    weighted: number;
    unweighted: number;
    credits: number;
  };
};

export async function getGpaProjection(): Promise<GpaProjection> {
  const response = await fetch(`${API_URL}/api/gpa/projection`, {
    credentials: "include",
  });

  if (!response.ok) {
    throw new Error("Failed to fetch GPA projection");
  }

  return response.json();
}
