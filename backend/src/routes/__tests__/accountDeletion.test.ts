import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import express from "express";
import session from "express-session";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";

// ---------------------------------------------------------------------------
// Env must exist before ../lib/auth.js is imported (it throws when Google
// OAuth / session secrets are missing). DATABASE_URL is a dummy: the mocked
// prisma module is never a real connection, and the PgStore created by
// lib/auth only connects if used (it is not mounted in these tests).
// ---------------------------------------------------------------------------
vi.hoisted(() => {
  process.env.GOOGLE_CLIENT_ID ||= "test-client-id";
  process.env.GOOGLE_CLIENT_SECRET ||= "test-client-secret";
  process.env.SESSION_SECRET ||= "test-session-secret";
  process.env.DATABASE_URL ||= "postgresql://user:pass@localhost:5432/test";
  process.env.FRONTEND_URL ||= "http://localhost:3000";
  if (process.env.NODE_ENV === "production") process.env.NODE_ENV = "test";
});

// ---------------------------------------------------------------------------
// In-memory Prisma fake. Models the actual schema's cascade behavior:
// deleting a User cascades to SavedCourse, Planner -> PlannedCourse,
// CompletedCourse, and RequirementResolution. Shared catalog tables
// (Course, PlannerOption, GraduationRequirement) are never touched.
// $transaction snapshots state and rolls back on error so we can verify
// atomicity. $executeRaw implements the session purge statement used by the
// route (DELETE FROM "session" WHERE sess->'passport'->>'user' = $1).
// ---------------------------------------------------------------------------
const h = vi.hoisted(() => {
  type Row = Record<string, unknown>;

  const state = {
    users: new Map<number, Row>(),
    savedCourses: [] as Row[],
    planners: [] as Row[],
    plannedCourses: [] as Row[],
    completedCourses: [] as Row[],
    resolutions: [] as Row[],
    sessions: [] as { sid: string; sess: { passport?: { user?: number } } }[],
    courses: [] as Row[],
    plannerOptions: [] as Row[],
    graduationRequirements: [] as Row[],
    failNextUserDelete: false,
    p2025NextUserDelete: false,
    nextId: 1000,
  };

  function purgeSessionsFor(userId: number): number {
    const before = state.sessions.length;
    state.sessions = state.sessions.filter(
      (s) => String(s.sess?.passport?.user) !== String(userId)
    );
    return before - state.sessions.length;
  }

  async function userDelete(args: { where: { id: number } }): Promise<Row> {
    if (state.failNextUserDelete) {
      state.failNextUserDelete = false;
      throw new Error("simulated database failure");
    }
    const id = args.where.id;
    if (!state.users.has(id)) {
      const err = new Error("Record to delete not found.") as Error & { code: string };
      err.code = "P2025";
      throw err;
    }
    if (state.p2025NextUserDelete) {
      // Simulate a concurrent deletion: the row existed when requireAuth ran
      // but is gone by the time tx.user.delete executes.
      state.p2025NextUserDelete = false;
      const err = new Error("Record to delete not found.") as Error & { code: string };
      err.code = "P2025";
      throw err;
    }
    state.users.delete(id);
    state.savedCourses = state.savedCourses.filter((r) => r.userId !== id);
    const plannerIds = new Set(
      state.planners.filter((p) => p.userId === id).map((p) => p.id as number)
    );
    state.planners = state.planners.filter((p) => p.userId !== id);
    state.plannedCourses = state.plannedCourses.filter(
      (c) => !plannerIds.has(c.plannerId as number)
    );
    state.completedCourses = state.completedCourses.filter((r) => r.userId !== id);
    state.resolutions = state.resolutions.filter((r) => r.userId !== id);
    return { id };
  }

  function taggedExecuteRaw(
    strings: TemplateStringsArray | string[],
    ...values: unknown[]
  ): number {
    const sql = strings.join("?");
    if (sql.includes('DELETE FROM "session"') && sql.includes("passport")) {
      return purgeSessionsFor(Number(values[0]));
    }
    return 0;
  }

  const tx = {
    $executeRaw: taggedExecuteRaw,
    user: { delete: userDelete },
  };

  const prisma = {
    async $transaction(fn: (client: typeof tx) => Promise<unknown>) {
      const snapshot = {
        users: new Map(state.users),
        savedCourses: [...state.savedCourses],
        planners: [...state.planners],
        plannedCourses: [...state.plannedCourses],
        completedCourses: [...state.completedCourses],
        resolutions: [...state.resolutions],
        sessions: state.sessions.map((s) => ({ ...s })),
      };
      try {
        return await fn(tx);
      } catch (err) {
        state.users = snapshot.users;
        state.savedCourses = snapshot.savedCourses;
        state.planners = snapshot.planners;
        state.plannedCourses = snapshot.plannedCourses;
        state.completedCourses = snapshot.completedCourses;
        state.resolutions = snapshot.resolutions;
        state.sessions = snapshot.sessions;
        throw err;
      }
    },
    user: {
      delete: userDelete,
      findUnique: async (args: { where: { id: number } }) =>
        state.users.get(args.where.id) ?? null,
    },
  };

  function reset() {
    state.users.clear();
    state.savedCourses = [];
    state.planners = [];
    state.plannedCourses = [];
    state.completedCourses = [];
    state.resolutions = [];
    state.sessions = [];
    state.courses = [];
    state.plannerOptions = [];
    state.graduationRequirements = [];
    state.failNextUserDelete = false;
    state.p2025NextUserDelete = false;
    state.nextId = 1000;
  }

  return { state, prisma, reset, purgeSessionsFor };
});

vi.mock("../../lib/prisma.js", () => ({
  prisma: h.prisma,
}));

import authRouter from "../auth.js";

type TestUser = {
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
};

function makeUser(id: number): TestUser {
  return {
    id,
    googleId: `google-${id}`,
    email: `user${id}@example.com`,
    name: `User ${id}`,
    picture: null,
    firstName: null,
    lastName: null,
    preferredName: null,
    grade: null,
    graduationYear: null,
  };
}

function seed(): void {
  const s = h.state;
  s.users.set(1, makeUser(1) as unknown as Record<string, unknown>);
  s.users.set(2, makeUser(2) as unknown as Record<string, unknown>);

  // Shared catalog data that must never be deleted.
  s.courses.push({ id: 50, title: "Shared Course" });
  s.plannerOptions.push({ id: 700, name: "Shared Option" });
  s.graduationRequirements.push({ id: 800, name: "Shared Requirement" });

  // User 1 data
  s.savedCourses.push({ id: 1, userId: 1, courseId: 50 });
  s.planners.push({ id: 10, userId: 1, schoolYear: 9 });
  s.plannedCourses.push({ id: 100, plannerId: 10, courseId: 50, plannerOptionId: 700 });
  s.completedCourses.push({ id: 200, userId: 1, courseId: 50 });
  s.resolutions.push({ id: 300, userId: 1, type: "pe_waiver" });
  s.sessions.push({ sid: "sid-user1-current", sess: { passport: { user: 1 } } });
  s.sessions.push({ sid: "sid-user1-other", sess: { passport: { user: 1 } } });

  // User 2 data (must never be touched by user 1's deletion)
  s.savedCourses.push({ id: 2, userId: 2, courseId: 50 });
  s.planners.push({ id: 11, userId: 2, schoolYear: 9 });
  s.plannedCourses.push({ id: 101, plannerId: 11, courseId: 50 });
  s.completedCourses.push({ id: 201, userId: 2, courseId: 50 });
  s.resolutions.push({ id: 301, userId: 2, type: "middle_school" });
  s.sessions.push({ sid: "sid-user2", sess: { passport: { user: 2 } } });
}

// ---------------------------------------------------------------------------
// Test HTTP app: real express-session (MemoryStore) + the real auth router.
// A small middleware simulates passport's session authentication:
// isAuthenticated() is true only while a session exists AND the user row
// still exists (mirroring passport's deserializeUser failure for deleted
// users).
// ---------------------------------------------------------------------------
let server: Server;
let baseUrl: string;

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use(
    session({
      secret: "test-session-secret",
      resave: false,
      saveUninitialized: false,
      name: "courseplanner.sid",
    })
  );
  app.use((req, _res, next) => {
    const sess = req.session as unknown as { passport?: { user?: number } };
    const userId = sess?.passport?.user;
    const userRow = userId != null ? h.state.users.get(userId) : undefined;
    (req as unknown as { isAuthenticated: () => boolean }).isAuthenticated =
      () => userRow !== undefined;
    (req as unknown as { user?: unknown }).user = userRow;
    next();
  });
  app.use("/auth", authRouter);

  app.post("/__test/login", (req, res) => {
    (req.session as unknown as { passport: { user: number } }).passport = {
      user: Number((req.body as { userId: number }).userId),
    };
    res.json({ ok: true });
  });
  app.get("/__test/session", (req, res) => {
    const auth = (req as unknown as { isAuthenticated: () => boolean }).isAuthenticated();
    const user = (req as unknown as { user?: unknown }).user;
    res.json({ authenticated: auth, user: user ?? null });
  });

  return app;
}

async function login(userId: number): Promise<string> {
  const res = await fetch(`${baseUrl}/__test/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId }),
  });
  expect(res.ok).toBe(true);
  const setCookies = res.headers.getSetCookie();
  expect(setCookies.length).toBeGreaterThan(0);
  const cookie = setCookies
    .map((c) => c.split(";")[0])
    .find((c) => c.startsWith("courseplanner.sid="));
  if (!cookie) throw new Error("session cookie not set on login");
  return cookie;
}

function del(path: string, cookie?: string, body?: unknown) {
  return fetch(`${baseUrl}${path}`, {
    method: "DELETE",
    headers: {
      ...(cookie ? { cookie } : {}),
      ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

beforeEach(async () => {
  h.reset();
  seed();
  const app = buildApp();
  await new Promise<void>((resolve) => {
    server = app.listen(0, "127.0.0.1", () => resolve());
  });
  const { port } = server.address() as AddressInfo;
  baseUrl = `http://127.0.0.1:${port}`;
});

afterEach(async () => {
  await new Promise<void>((resolve, reject) => {
    server.close((err) => (err ? reject(err) : resolve()));
  });
});

describe("DELETE /auth/account", () => {
  it("rejects unauthenticated (guest) requests with 401 and deletes nothing", async () => {
    const res = await del("/auth/account");
    expect(res.status).toBe(401);
    expect(h.state.users.has(1)).toBe(true);
    expect(h.state.planners.length).toBe(2);
    expect(h.state.sessions.length).toBe(3);
  });

  it("rejects requests with no session cookie but a body claiming a userId", async () => {
    const res = await del("/auth/account", undefined, { userId: 1, id: 1 });
    expect(res.status).toBe(401);
    expect(h.state.users.has(1)).toBe(true);
  });

  it("lets an authenticated user delete their own account and all owned records", async () => {
    const cookie = await login(1);
    const res = await del("/auth/account", cookie);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ deleted: true });

    // User and every user-owned record type are gone.
    expect(h.state.users.has(1)).toBe(false);
    expect(h.state.savedCourses.filter((r) => r.userId === 1)).toEqual([]);
    expect(h.state.planners.filter((r) => r.userId === 1)).toEqual([]);
    expect(h.state.plannedCourses.filter((r) => r.plannerId === 10)).toEqual([]);
    expect(h.state.completedCourses.filter((r) => r.userId === 1)).toEqual([]);
    expect(h.state.resolutions.filter((r) => r.userId === 1)).toEqual([]);

    // Shared catalog data remains.
    expect(h.state.courses.length).toBe(1);
    expect(h.state.plannerOptions.length).toBe(1);
    expect(h.state.graduationRequirements.length).toBe(1);
  });

  it("never deletes another user's records, even when their id is supplied by the client", async () => {
    const cookie = await login(1);
    const res = await del("/auth/account", cookie, { id: 2, userId: 2 });
    expect(res.status).toBe(200);

    expect(h.state.users.has(1)).toBe(false);
    expect(h.state.users.has(2)).toBe(true);
    expect(h.state.savedCourses.filter((r) => r.userId === 2).length).toBe(1);
    expect(h.state.planners.filter((r) => r.userId === 2).length).toBe(1);
    expect(h.state.plannedCourses.filter((r) => r.plannerId === 11).length).toBe(1);
    expect(h.state.completedCourses.filter((r) => r.userId === 2).length).toBe(1);
    expect(h.state.resolutions.filter((r) => r.userId === 2).length).toBe(1);
    expect(h.state.sessions.filter((s) => s.sess?.passport?.user === 2).length).toBe(1);
  });

  it("purges all server-side sessions for the deleted user and keeps other users' sessions", async () => {
    const cookie = await login(1);
    const res = await del("/auth/account", cookie);
    expect(res.status).toBe(200);

    expect(h.state.sessions.filter((s) => s.sess?.passport?.user === 1)).toEqual([]);
    expect(h.state.sessions.filter((s) => s.sess?.passport?.user === 2).length).toBe(1);
  });

  it("invalidates the current session: /auth/session-equivalent no longer authenticates and the cookie is cleared", async () => {
    const cookie = await login(1);

    const before = await fetch(`${baseUrl}/__test/session`, { headers: { cookie } });
    expect((await before.json()).authenticated).toBe(true);

    const res = await del("/auth/account", cookie);
    expect(res.status).toBe(200);
    const setCookies = res.headers.getSetCookie();
    expect(setCookies.some((c) => c.startsWith("courseplanner.sid=;"))).toBe(true);

    const after = await fetch(`${baseUrl}/__test/session`, { headers: { cookie } });
    expect((await after.json()).authenticated).toBe(false);
  });

  it("a second delete attempt with the stale cookie is handled safely (401, no crash)", async () => {
    const cookie = await login(1);
    const first = await del("/auth/account", cookie);
    expect(first.status).toBe(200);

    const second = await del("/auth/account", cookie);
    expect(second.status).toBe(401);
    expect(h.state.users.size).toBe(1); // user 2 untouched
  });

  it("treats a concurrent deletion (P2025 mid-transaction) as idempotent success and still ends the session", async () => {
    const cookie = await login(1);
    // requireAuth passes (user row exists) but tx.user.delete hits a row that
    // vanished concurrently — the route must fall through to session teardown
    // with 200 instead of returning 500.
    h.state.p2025NextUserDelete = true;

    const res = await del("/auth/account", cookie);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ deleted: true });

    const after = await fetch(`${baseUrl}/__test/session`, { headers: { cookie } });
    expect((await after.json()).authenticated).toBe(false);
  });

  it("is transactional: a mid-deletion failure rolls everything back and returns 500", async () => {
    const cookie = await login(1);
    h.state.failNextUserDelete = true;

    const res = await del("/auth/account", cookie);
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: "Failed to delete account" });

    // Nothing was deleted — user, records, and sessions all survive.
    expect(h.state.users.has(1)).toBe(true);
    expect(h.state.savedCourses.filter((r) => r.userId === 1).length).toBe(1);
    expect(h.state.planners.filter((r) => r.userId === 1).length).toBe(1);
    expect(h.state.plannedCourses.filter((r) => r.plannerId === 10).length).toBe(1);
    expect(h.state.completedCourses.filter((r) => r.userId === 1).length).toBe(1);
    expect(h.state.resolutions.filter((r) => r.userId === 1).length).toBe(1);
    expect(h.state.sessions.filter((s) => s.sess?.passport?.user === 1).length).toBe(2);

    // The session is NOT destroyed on failure — the user stays signed in.
    const after = await fetch(`${baseUrl}/__test/session`, { headers: { cookie } });
    expect((await after.json()).authenticated).toBe(true);
  });

  it("does not leak database internals in error responses", async () => {
    const cookie = await login(1);
    h.state.failNextUserDelete = true;
    const res = await del("/auth/account", cookie);
    const body = await res.json();
    expect(Object.keys(body)).toEqual(["error"]);
    expect(body.error).toBe("Failed to delete account");
    expect(JSON.stringify(body)).not.toMatch(/simulated database failure|stack|prisma/i);
  });
});
