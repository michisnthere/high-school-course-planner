import { Router } from "express";
import passport from "passport";
import { createGoogleStrategy, type SessionUser } from "../lib/auth.js";
import { prisma } from "../lib/prisma.js";

const RAW_FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:3000";
const FRONTEND_URL = RAW_FRONTEND_URL.replace(/\/$/, "");
const NODE_ENV = process.env.NODE_ENV || "development";

// Use the FRONTEND_URL for the OAuth callback so Google redirects through the
// Next.js proxy. All session cookies are then set on the frontend domain via
// the proxy's forwarded Set-Cookie headers, making them first-party cookies
// that mobile browsers will accept.
const CALLBACK_URL = `${FRONTEND_URL}/auth/google/callback`;

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
  const sid = req.sessionID;
  const cookie = req.headers.cookie ?? "(none)";
  console.log(`[auth:google] ───────────────────────────────`);
  console.log(`[auth:google] sessionID="${sid}"`);
  console.log(`[auth:google] cookie="${cookie.slice(0,120)}"`);
  console.log(`[auth:google] redirect param="${rawRedirect}"`);
  console.log(`[auth:google] authRedirect BEFORE="${req.session.authRedirect}"`);
  console.log(`[auth:google] passport BEFORE=${JSON.stringify(req.session.passport)}`);

  if (isValidInternalPath(rawRedirect)) {
    req.session.authRedirect = rawRedirect;
    console.log(`[auth:google] stored authRedirect="${rawRedirect}"`);
  } else if (rawRedirect) {
    console.log(`[auth:google] rejected invalid redirect="${rawRedirect}"`);
  }

  // Force save to verify the session persists before the redirect
  req.session.save((err) => {
    if (err) {
      console.log(`[auth:google] SESSION SAVE ERROR:`, err);
    } else {
      console.log(`[auth:google] session saved OK — ID="${req.sessionID}" authRedirect="${req.session.authRedirect}"`);
    }
    const strategy = createGoogleStrategy(CALLBACK_URL);
    passport.authenticate(strategy, { scope: ["profile", "email"] })(req, res, next);
  });
});

router.get("/google/callback", (req, res, next) => {
  const sid = req.sessionID;
  const cookie = req.headers.cookie ?? "(none)";
  console.log(`[auth:callback] ───────────────────────────────`);
  console.log(`[auth:callback] sessionID="${sid}"`);
  console.log(`[auth:callback] cookie="${cookie.slice(0,120)}"`);
  console.log(`[auth:callback] authRedirect="${req.session.authRedirect}"`);
  console.log(`[auth:callback] passport=${JSON.stringify(req.session.passport)}`);

  const strategy = createGoogleStrategy(CALLBACK_URL);
  passport.authenticate(
    strategy,
    {
      failureRedirect: `${FRONTEND_URL}/login`,
    },
    (err: unknown, user: Express.User | false | null) => {
      if (err) {
        console.log(`[auth:callback] passport error:`, err);
        return next(err);
      }
      if (!user) {
        console.log(`[auth:callback] no user`);
        return res.redirect(`${FRONTEND_URL}/login`);
      }
      console.log(`[auth:callback] user authenticated — sessionID="${req.sessionID}"`);
      req.logIn(user, (loginErr) => {
        if (loginErr) {
          console.log(`[auth:callback] login error:`, loginErr);
          return next(loginErr);
        }
        console.log(`[auth:callback] logged in — sessionID="${req.sessionID}" passport=${JSON.stringify(req.session.passport)}`);
        const authRedirect = req.session.authRedirect;
        delete req.session.authRedirect;
        console.log(`[auth:callback] read authRedirect="${authRedirect}" (deleted)`);
        const redirectPath = isValidInternalPath(authRedirect ?? "") ? authRedirect! : "/dashboard";
        console.log(`[auth:callback] redirecting to "${redirectPath}"`);
        res.redirect(`${FRONTEND_URL}${redirectPath}`);
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
        const rawRedirect = typeof req.query.redirect === "string" ? req.query.redirect : "";
        console.log(`[auth:dev] redirect param="${rawRedirect}"`);
        const safeRedirect = isValidInternalPath(rawRedirect) ? rawRedirect : "/dashboard";
        console.log(`[auth:dev] redirecting to "${safeRedirect}"`);
        res.redirect(`${FRONTEND_URL}${safeRedirect}`);
      });
    } catch (err) {
      next(err);
    }
  });
}

export default router;
