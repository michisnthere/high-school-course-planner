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

console.log(`[AUTH-DEBUG] Module loaded. NODE_ENV=${NODE_ENV}, GOOGLE_CLIENT_ID=${GOOGLE_CLIENT_ID ? "set" : "MISSING"}, SESSION_SECRET=${SESSION_SECRET ? "set" : "MISSING"}, DATABASE_URL=${process.env.DATABASE_URL ? "set" : "MISSING"}`);

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
  const userId = (user as SessionUser).id;
  console.log(`[AUTH-DEBUG] serializeUser called, user.id=${userId}`);
  done(null, userId);
});

passport.deserializeUser((id: number, done) => {
  console.log(`[AUTH-DEBUG] deserializeUser called, id=${id}`);
  prisma.user
    .findUnique({ where: { id } })
    .then((user) => {
      if (!user) {
        console.log(`[AUTH-DEBUG] deserializeUser: user not found for id=${id}`);
        return done(new Error("User not found"));
      }
      const sessionUser: SessionUser = {
        id: user.id,
        googleId: user.googleId,
        email: user.email,
        name: user.name,
        picture: user.picture,
      };
      console.log(`[AUTH-DEBUG] deserializeUser SUCCESS, user.id=${user.id}, email=${user.email}`);
      return done(null, sessionUser);
    })
    .catch((err) => done(err));
});

const PgStore = connectPgSimple(session);

const pgStore = new PgStore({
  conString: process.env.DATABASE_URL,
});

const originalStoreSet = pgStore.set.bind(pgStore);
pgStore.set = (sid: string, sessionData: session.SessionData, callback?: (err?: Error | null) => void) => {
  console.log(`[AUTH-DEBUG] store.set START sid=${sid.substring(0,16)}... passport.user=${(sessionData as any).passport?.user}`);
  originalStoreSet(sid, sessionData, (err?: Error | null) => {
    if (err) {
      console.error(`[AUTH-DEBUG] store.set FAILED sid=${sid.substring(0,16)}... error=${err.message}`);
    } else {
      console.log(`[AUTH-DEBUG] store.set SUCCEEDED sid=${sid.substring(0,16)}...`);
    }
    if (callback) callback(err);
  });
};

const originalStoreGet = pgStore.get.bind(pgStore);
pgStore.get = (sid: string, callback: (err?: Error | null, session?: session.SessionData | null) => void) => {
  originalStoreGet(sid, (err, session) => {
    if (err) {
      console.error(`[AUTH-DEBUG] store.get FAILED sid=${sid.substring(0,16)}... error=${err.message}`);
    } else if (!session) {
      console.log(`[AUTH-DEBUG] store.get sid=${sid.substring(0,16)}... -> NOT FOUND`);
    } else {
      const hasPassport = !!(session as any).passport?.user;
      console.log(`[AUTH-DEBUG] store.get sid=${sid.substring(0,16)}... -> FOUND passport.user=${hasPassport}`);
    }
    callback(err, session);
  });
};

export const sessionMiddleware = session({
  store: pgStore,
  secret: SESSION_SECRET!,
  resave: false,
  saveUninitialized: false,
  name: "courseplanner.sid",
  cookie: {
    maxAge: 24 * 60 * 60 * 1000,
    secure: NODE_ENV === "production",
    sameSite: "lax",
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
