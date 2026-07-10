import { Router } from "express";
import passport from "passport";

const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:3000";

const router = Router();

router.get(
  "/google",
  passport.authenticate("google", { scope: ["profile", "email"] })
);

router.get(
  "/google/callback",
  passport.authenticate("google", {
    failureRedirect: `${FRONTEND_URL}/login`,
  }),
  (_req, res) => {
    res.redirect(FRONTEND_URL);
  }
);

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
