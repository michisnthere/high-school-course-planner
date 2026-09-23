const API_URL = "";

export type AuthMode = "authenticated" | "guest";

export interface AuthUser {
  id: number;
  googleId: string;
  email: string;
  name: string | null;
  picture: string | null;
  firstName: string | null;
  lastName: string | null;
  preferredName: string | null;
  grade: string | null;
  graduationYear: number | null;
}

export const GUEST_USER: AuthUser = {
  id: -1,
  googleId: "guest",
  email: "guest@local",
  name: "Guest",
  picture: null,
  firstName: null,
  lastName: null,
  preferredName: null,
  grade: null,
  graduationYear: null,
};

export interface ProfileUpdateData {
  firstName: string;
  lastName: string;
  preferredName?: string;
  grade?: string;
  graduationYear?: number | null;
}

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

export async function updateProfile(data: ProfileUpdateData): Promise<{ user: AuthUser }> {
  const url = `${API_URL}/auth/profile`;
  const response = await fetch(url, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: "Failed to update profile" }));
    throw new Error(error.error || "Failed to update profile");
  }

  return response.json();
}
