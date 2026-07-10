import { Router } from "express";
import passport from "passport";
import { createGoogleStrategy } from "../lib/auth.js";

const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:3000";
const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:4000";

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

export default router;
