const API_URL = "";

export interface AuthUser {
  id: number;
  googleId: string;
  email: string;
  name: string | null;
  picture: string | null;
}

export interface SessionResponse {
  authenticated: boolean;
  user?: AuthUser;
}

export async function getSession(): Promise<SessionResponse> {
  const url = `${API_URL}/auth/session`;
  console.log(`[AUTH-DEBUG] getSession fetching: ${url}, credentials=include`);
  const response = await fetch(url, {
    credentials: "include",
  });

  console.log(`[AUTH-DEBUG] getSession response status=${response.status}, ok=${response.ok}`);
  if (!response.ok) {
    throw new Error("Failed to fetch session");
  }

  const data = await response.json();
  console.log(`[AUTH-DEBUG] getSession response body: authenticated=${data.authenticated}${data.authenticated ? `, user.id=${data.user?.id}` : ""}`);
  return data;
}

export async function logout(): Promise<SessionResponse> {
  const url = `${API_URL}/auth/logout`;
  console.log(`[AUTH-DEBUG] logout fetching: ${url}`);
  const response = await fetch(url, {
    method: "POST",
    credentials: "include",
  });

  if (!response.ok) {
    throw new Error("Failed to logout");
  }

  return response.json();
}
