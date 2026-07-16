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
  const response = await fetch(`/api/gpa/projection`, {
    credentials: "include",
  });

  if (!response.ok) {
    throw new Error("Failed to fetch GPA projection");
  }

  return response.json();
}
