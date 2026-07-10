const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

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
  const response = await fetch(`${API_URL}/auth/session`, {
    credentials: "include",
  });

  if (!response.ok) {
    throw new Error("Failed to fetch session");
  }

  return response.json();
}

export async function logout(): Promise<SessionResponse> {
  const response = await fetch(`${API_URL}/auth/logout`, {
    method: "POST",
    credentials: "include",
  });

  if (!response.ok) {
    throw new Error("Failed to logout");
  }

  return response.json();
}
