import { Router } from "express";
import passport from "passport";
import { createGoogleStrategy, parseOAuthState, type SessionUser } from "../lib/auth.js";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../lib/auth.js";

const RAW_FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:3000";
const FRONTEND_URL = RAW_FRONTEND_URL.replace(/\/$/, "");
const NODE_ENV = process.env.NODE_ENV || "development";

// Use the FRONTEND_URL for the OAuth callback so Google redirects through the
// Next.js proxy. All session cookies are then set on the frontend domain via
// the proxy's forwarded Set-Cookie headers, making them first-party cookies
// that mobile browsers will accept.
const CALLBACK_URL = `${FRONTEND_URL}/auth/google/callback`;

if (NODE_ENV === "production") {
  console.log(`[AUTH] FRONTEND_URL: ${FRONTEND_URL}`);
  console.log(`[AUTH] CALLBACK_URL: ${CALLBACK_URL}`);
  if (FRONTEND_URL.startsWith("http://localhost")) {
    console.error("[AUTH] WARNING: FRONTEND_URL appears to be localhost in production. Set FRONTEND_URL environment variable to your production frontend URL (e.g. https://stevensoncourseplanner.vercel.app)");
  }
}

const router = Router();

/** Reject external URLs, protocol-relative URLs, and malformed paths. */
function isValidInternalPath(value: string): boolean {
  if (!value || value.startsWith("//")) return false;
  // Full URLs (http://, https://, ftp://) are not internal
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(value)) return false;
  // Must start with /
  if (!value.startsWith("/")) return false;
  try {
    // Validate by parsing against the frontend origin
    const parsed = new URL(value, FRONTEND_URL);
    return parsed.origin === FRONTEND_URL;
  } catch {
    return false;
  }
}

router.get("/google", (req, res, next) => {
  const rawRedirect = typeof req.query.redirect === "string" ? req.query.redirect : "";

  const redirect = isValidInternalPath(rawRedirect) ? rawRedirect : "/";
  const strategy = createGoogleStrategy(CALLBACK_URL, redirect);
  passport.authenticate(strategy, { scope: ["profile", "email"] })(req, res, next);
});

router.get("/google/callback", (req, res, next) => {
  const returnedState = typeof req.query.state === "string" ? req.query.state : "";

  const strategy = createGoogleStrategy(CALLBACK_URL);
  passport.authenticate(
    strategy,
    {
      failureRedirect: `${FRONTEND_URL}/login`,
    },
    (err: unknown, user: Express.User | false | null) => {
      if (err) {
        console.error("[AUTH] Google OAuth callback error:", {
          message: err instanceof Error ? err.message : String(err),
          name: err instanceof Error ? err.name : undefined,
          stack: err instanceof Error ? err.stack : undefined,
        });
        return next(err);
      }
      if (!user) {
        console.error("[AUTH] Google OAuth callback: no user returned");
        return res.redirect(`${FRONTEND_URL}/login`);
      }
      req.logIn(user, (loginErr) => {
        if (loginErr) {
          console.error("[AUTH] Google OAuth login/session error:", {
            message: loginErr instanceof Error ? loginErr.message : String(loginErr),
            name: loginErr instanceof Error ? loginErr.name : undefined,
            stack: loginErr instanceof Error ? loginErr.stack : undefined,
          });
          return next(loginErr);
        }

        let redirect = "/";
        const parsed = parseOAuthState(returnedState, process.env.SESSION_SECRET!);
        if (parsed && isValidInternalPath(parsed)) {
          redirect = parsed;
        }
        res.redirect(`${FRONTEND_URL}${redirect}`);
      });
    }
  )(req, res, next);
});

router.get("/session", (req, res) => {
  if (req.isAuthenticated() && req.user) {
    res.json({ authenticated: true, user: req.user });
  } else {
    res.json({ authenticated: false });
  }
});

router.post("/logout", (req, res, next) => {
  req.logout((err) => {
    if (err) {
      return next(err);
    }
    req.session.destroy((sessionErr) => {
      if (sessionErr) {
        return next(sessionErr);
      }
      res.clearCookie("courseplanner.sid", {
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
      });
      res.json({ authenticated: false });
    });
  });
});

router.patch("/profile", requireAuth, async (req, res) => {
  try {
    const userId = (req.user as SessionUser).id;
    const { firstName, lastName, preferredName, grade, graduationYear } = req.body;

    if (!firstName || typeof firstName !== "string" || !firstName.trim()) {
      res.status(400).json({ error: "First name is required" });
      return;
    }
    if (!lastName || typeof lastName !== "string" || !lastName.trim()) {
      res.status(400).json({ error: "Last name is required" });
      return;
    }

    const validGrades = ["9", "10", "11", "12", "other"];
    if (grade && !validGrades.includes(grade)) {
      res.status(400).json({ error: "Invalid grade value" });
      return;
    }

    const gradYear = graduationYear != null ? Number(graduationYear) : null;
    if (gradYear !== null && (isNaN(gradYear) || gradYear < 2020 || gradYear > 2035)) {
      res.status(400).json({ error: "Invalid graduation year" });
      return;
    }

    const updated = await prisma.user.update({
      where: { id: userId },
      data: {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        preferredName: preferredName && typeof preferredName === "string" ? preferredName.trim() || null : null,
        grade: grade || null,
        graduationYear: gradYear,
      },
    });

    const sessionUser: SessionUser = {
      id: updated.id,
      googleId: updated.googleId,
      email: updated.email,
      name: updated.name,
      picture: updated.picture,
      firstName: updated.firstName,
      lastName: updated.lastName,
      preferredName: updated.preferredName,
      grade: updated.grade,
      graduationYear: updated.graduationYear,
    };

    req.login(sessionUser, (loginErr) => {
      if (loginErr) {
        res.status(500).json({ error: "Failed to update session" });
        return;
      }
      res.json({ user: sessionUser });
    });
  } catch (err) {
    console.error("Profile update error:", err);
    res.status(500).json({ error: "Failed to update profile" });
  }
});

router.delete("/account", requireAuth, async (req, res) => {
  const userId = (req.user as SessionUser).id;

  try {
    await prisma.$transaction(async (tx) => {
      // Remove every server-side session belonging to this user (including the
      // current one) so no stale session can re-authenticate the deleted
      // account. connect-pg-simple stores passport's serialized user id under
      // sess.passport.user.
      await tx.$executeRaw`DELETE FROM "session" WHERE sess->'passport'->>'user' = ${String(userId)}`;
      // Deleting the User cascades (via existing ON DELETE CASCADE foreign
      // keys) to SavedCourse, Planner -> PlannedCourse, CompletedCourse, and
      // RequirementResolution. Shared catalog data (Course, CourseOption,
      // PlannerOption, GraduationRequirement, ...) is not touched.
      await tx.user.delete({ where: { id: userId } });
    });
  } catch (err) {
    const code = (err as { code?: string } | null)?.code;
    if (code !== "P2025") {
      console.error("[AUTH] Account deletion failed:", {
        userId,
        code,
        message: err instanceof Error ? err.message : "Unknown error",
      });
      res.status(500).json({ error: "Failed to delete account" });
      return;
    }
    // User row already gone (e.g. concurrent deletion) — still fall through so
    // this session is invalidated. Deletion stays idempotent and safe.
  }

  req.session.destroy((sessionErr) => {
    if (sessionErr) {
      // The user rows are already deleted and the session rows were purged in
      // the transaction, so a destroy failure only leaves this cookie behind;
      // passport can no longer resolve it to a user.
      console.error("[AUTH] Account deletion session destroy failed:", sessionErr.message);
    }
    res.clearCookie("courseplanner.sid", {
      secure: NODE_ENV === "production",
      sameSite: "lax",
    });
    res.json({ deleted: true });
  });
});

if (NODE_ENV !== "production") {
  // Dev-only login for testing when Google OAuth is not configured or for
  // quick local verification. Not available in production.
  router.get("/dev", async (req, res, next) => {
    try {
      const user = await prisma.user.upsert({
        where: { googleId: "dev-google-id" },
        update: {},
        create: {
          googleId: "dev-google-id",
          email: "dev@example.com",
          name: "Dev User",
        },
      });
      const sessionUser: SessionUser = {
        id: user.id,
        googleId: user.googleId,
        email: user.email,
        name: user.name,
        picture: null,
        firstName: user.firstName,
        lastName: user.lastName,
        preferredName: user.preferredName,
        grade: user.grade,
        graduationYear: user.graduationYear,
      };
      req.logIn(sessionUser, (loginErr) => {
        if (loginErr) {
          return next(loginErr);
        }
        const rawRedirect = typeof req.query.redirect === "string" ? req.query.redirect : "";
        const safeRedirect = isValidInternalPath(rawRedirect) ? rawRedirect : "/";
        res.redirect(`${FRONTEND_URL}${safeRedirect}`);
      });
    } catch (err) {
      next(err);
    }
  });
}

export default router;
