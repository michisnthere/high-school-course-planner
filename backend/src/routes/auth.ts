import { Router } from "express";
import passport from "passport";
import { createGoogleStrategy, type SessionUser } from "../lib/auth.js";
import { prisma } from "../lib/prisma.js";

const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:3000";
const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:4000";
const NODE_ENV = process.env.NODE_ENV || "development";

const CALLBACK_URL = `${BACKEND_URL}/auth/google/callback`;

const router = Router();

router.get("/google", (req, res, next) => {
  const strategy = createGoogleStrategy(CALLBACK_URL);
  passport.authenticate(strategy, { scope: ["profile", "email"] })(req, res, next);
});

router.get("/google/callback", (req, res, next) => {
  const strategy = createGoogleStrategy(CALLBACK_URL);
  passport.authenticate(
    strategy,
    {
      failureRedirect: `${FRONTEND_URL}/login`,
    },
    (err: unknown, user: Express.User | false | null) => {
      if (err) {
        return next(err);
      }
      if (!user) {
        return res.redirect(`${FRONTEND_URL}/login`);
      }
      req.logIn(user, (loginErr) => {
        if (loginErr) {
          return next(loginErr);
        }
        res.redirect(FRONTEND_URL);
      });
    }
  )(req, res, next);
});

router.get("/session", (req, res) => {
  if (req.user) {
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
      res.clearCookie("courseplanner.sid");
      res.json({ authenticated: false });
    });
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
      };
      req.logIn(sessionUser, (loginErr) => {
        if (loginErr) {
          return next(loginErr);
        }
        const redirect = typeof req.query.redirect === "string" ? req.query.redirect : "";
        const safeRedirect = redirect.startsWith("/") ? redirect : "/";
        res.redirect(`${FRONTEND_URL}${safeRedirect}`);
      });
    } catch (err) {
      next(err);
    }
  });
}

export default router;
