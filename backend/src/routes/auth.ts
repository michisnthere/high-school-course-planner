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
  const redirect = typeof req.query.redirect === "string" ? req.query.redirect : "";
  if (redirect.startsWith("/")) {
    req.session.returnTo = redirect;
  }
  const strategy = createGoogleStrategy(CALLBACK_URL);
  passport.authenticate(strategy, { scope: ["profile", "email"] })(req, res, next);
});

router.get("/google/callback", (req, res, next) => {
  console.log(`[AUTH-DEBUG] === CALLBACK START === FRONTEND_URL=${FRONTEND_URL}, BACKEND_URL=${BACKEND_URL}, CALLBACK_URL=${CALLBACK_URL}`);
  console.log(`[AUTH-DEBUG] callback req.sessionID BEFORE authenticate=${req.sessionID?.substring(0,16) || "NONE"}..., req.session=${JSON.stringify({ passport: (req.session as any)?.passport, cookie: (req.session as any)?.cookie?.expires })}`);
  const strategy = createGoogleStrategy(CALLBACK_URL);
  passport.authenticate(
    strategy,
    {
      failureRedirect: `${FRONTEND_URL}/login`,
    },
    (err: unknown, user: Express.User | false | null) => {
      if (err) {
        console.error(`[AUTH-DEBUG] passport.authenticate ERROR: ${err}`);
        return next(err);
      }
      if (!user) {
        console.log(`[AUTH-DEBUG] passport.authenticate returned NO user (authentication failed)`);
        return res.redirect(`${FRONTEND_URL}/login`);
      }
      console.log(`[AUTH-DEBUG] passport.authenticate SUCCESS, user.id=${(user as SessionUser).id}, email=${(user as SessionUser).email}`);
      req.logIn(user, (loginErr) => {
        if (loginErr) {
          console.error(`[AUTH-DEBUG] req.logIn FAILED: ${loginErr}`);
          return next(loginErr);
        }
        const sid = req.sessionID;
        console.log(`[AUTH-DEBUG] req.logIn SUCCEEDED. sessionID=${sid?.substring(0,16)}...`);
        console.log(`[AUTH-DEBUG] req.session.passport AFTER login=${JSON.stringify((req.session as any)?.passport)}`);
        console.log(`[AUTH-DEBUG] req.session.cookie=${JSON.stringify((req.session as any)?.cookie)}`);
        console.log(`[AUTH-DEBUG] req.isAuthenticated()=${req.isAuthenticated()}`);
        const returnTo = req.session.returnTo;
        delete req.session.returnTo;
        const redirectPath = returnTo && returnTo.startsWith("/") ? returnTo : "";
        console.log(`[AUTH-DEBUG] Redirecting to ${FRONTEND_URL}${redirectPath}`);
        res.redirect(`${FRONTEND_URL}${redirectPath}`);
      });
    }
  )(req, res, next);
});

router.get("/session", (req, res) => {
  const sid = req.sessionID;
  console.log(`[AUTH-DEBUG] === /session called === sessionID=${sid?.substring(0,16)}...`);
  console.log(`[AUTH-DEBUG] /session req.isAuthenticated()=${req.isAuthenticated()}`);
  console.log(`[AUTH-DEBUG] /session req.user=${req.user ? JSON.stringify({ id: (req.user as SessionUser).id, email: (req.user as SessionUser).email }) : "NULL"}`);
  console.log(`[AUTH-DEBUG] /session req.session.passport=${JSON.stringify((req.session as any)?.passport)}`);
  console.log(`[AUTH-DEBUG] /session req.session.cookie.expires=${(req.session as any)?.cookie?.expires}`);
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
