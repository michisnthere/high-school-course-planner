import { Router } from "express";
import passport from "passport";
import { createGoogleStrategy, parseOAuthState, type SessionUser } from "../lib/auth.js";
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
  console.log(`[auth:google] ───────────────────────────────`);
  console.log(`[auth:google] redirect param="${rawRedirect}"`);

  const redirect = isValidInternalPath(rawRedirect) ? rawRedirect : "/";
  const strategy = createGoogleStrategy(CALLBACK_URL, redirect);
  passport.authenticate(strategy, { scope: ["profile", "email"] })(req, res, next);
});

router.get("/google/callback", (req, res, next) => {
  const returnedState = typeof req.query.state === "string" ? req.query.state : "";
  console.log(`[auth:callback] ───────────────────────────────`);
  console.log(`[auth:callback] state="${returnedState}"`);

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
      console.log(`[auth:callback] user authenticated`);
      req.logIn(user, (loginErr) => {
        if (loginErr) {
          console.log(`[auth:callback] login error:`, loginErr);
          return next(loginErr);
        }
        console.log(`[auth:callback] logged in`);

        let redirect = "/";
        const parsed = parseOAuthState(returnedState, process.env.SESSION_SECRET!);
        if (parsed && isValidInternalPath(parsed)) {
          redirect = parsed;
        }
        console.log(`[auth:callback] redirecting to "${redirect}"`);
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
        const safeRedirect = isValidInternalPath(rawRedirect) ? rawRedirect : "/";
        console.log(`[auth:dev] redirecting to "${safeRedirect}"`);
        res.redirect(`${FRONTEND_URL}${safeRedirect}`);
      });
    } catch (err) {
      next(err);
    }
  });
}

export default router;
