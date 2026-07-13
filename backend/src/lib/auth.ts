import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import type { Request, Response, NextFunction } from "express";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import { prisma } from "./prisma.js";

export interface SessionUser {
  id: number;
  googleId: string;
  email: string;
  name: string | null;
  picture: string | null;
}

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const SESSION_SECRET = process.env.SESSION_SECRET;
const NODE_ENV = process.env.NODE_ENV || "development";

if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
  throw new Error("GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET must be set");
}

if (!SESSION_SECRET) {
  throw new Error("SESSION_SECRET must be set");
}

export function createGoogleStrategy(callbackURL: string): GoogleStrategy {
  return new GoogleStrategy(
    {
      clientID: GOOGLE_CLIENT_ID!,
      clientSecret: GOOGLE_CLIENT_SECRET!,
      callbackURL,
      scope: ["profile", "email"],
      state: true,
    },
    (_accessToken, _refreshToken, profile, done) => {
      const email = profile.emails?.[0]?.value;
      const name = profile.displayName;
      const picture = profile.photos?.[0]?.value;
      const googleId = profile.id;

      if (!email) {
        return done(new Error("No email provided by Google"));
      }

      prisma.user
        .upsert({
          where: { googleId },
          update: { email, name, picture },
          create: { googleId, email, name, picture },
        })
        .then((user) => {
          const sessionUser: SessionUser = {
            id: user.id,
            googleId: user.googleId,
            email: user.email,
            name: user.name,
            picture: user.picture,
          };
          return done(null, sessionUser);
        })
        .catch((err) => done(err));
    }
  );
}

passport.serializeUser((user: Express.User, done) => {
  done(null, user.id);
});

passport.deserializeUser((id: number, done) => {
  prisma.user
    .findUnique({ where: { id } })
    .then((user) => {
      if (!user) {
        return done(new Error("User not found"));
      }
      const sessionUser: SessionUser = {
        id: user.id,
        googleId: user.googleId,
        email: user.email,
        name: user.name,
        picture: user.picture,
      };
      return done(null, sessionUser);
    })
    .catch((err) => done(err));
});

const PgStore = connectPgSimple(session);

export const sessionMiddleware = session({
  store: new PgStore({
    conString: process.env.DATABASE_URL,
    createTableIfMissing: true,
  }),
  secret: SESSION_SECRET!,
  resave: false,
  saveUninitialized: false,
  name: "courseplanner.sid",
  cookie: {
  maxAge: 24 * 60 * 60 * 1000,
  secure: true,
  sameSite: "none",
  },
});

export const passportInit = passport.initialize();
export const passportSession = passport.session();

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (req.isAuthenticated()) {
    return next();
  }
  res.status(401).json({ error: "Unauthorized" });
}
