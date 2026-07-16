const API_URL = "";

export type AuthMode = "authenticated" | "guest";

export interface AuthUser {
  id: number;
  googleId: string;
  email: string;
  name: string | null;
  picture: string | null;
}

export const GUEST_USER: AuthUser = {
  id: -1,
  googleId: "guest",
  email: "guest@local",
  name: "Guest",
  picture: null,
};

export interface SessionResponse {
  authenticated: boolean;
  user?: AuthUser;
}

export async function getSession(): Promise<SessionResponse> {
  const url = `${API_URL}/auth/session`;
  const response = await fetch(url, {
    credentials: "include",
  });

  if (!response.ok) {
    throw new Error("Failed to fetch session");
  }

  return response.json();
}

export async function logout(): Promise<SessionResponse> {
  const url = `${API_URL}/auth/logout`;
  const response = await fetch(url, {
    method: "POST",
    credentials: "include",
  });

  if (!response.ok) {
    throw new Error("Failed to logout");
  }

  return response.json();
}
