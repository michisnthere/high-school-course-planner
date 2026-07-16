import express from "express";
import cors from "cors";
import "dotenv/config";
import coursesRouter from "./routes/courses.js";
import authRouter from "./routes/auth.js";
import savedCoursesRouter from "./routes/savedCourses.js";
import plannerRouter from "./routes/planner.js";
import completedCoursesRouter from "./routes/completedCourses.js";
import gpaRouter from "./routes/gpa.js";
import resolutionsRouter from "./routes/resolutions.js";
import {
  sessionMiddleware,
  passportInit,
  passportSession,
} from "./lib/auth.js";

const app = express();
const RAW_FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:3000";
const FRONTEND_URL = RAW_FRONTEND_URL.replace(/\/$/, "");
const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:4000";

console.log(`[AUTH-DEBUG] === Server startup ===`);
console.log(`[AUTH-DEBUG] FRONTEND_URL=${FRONTEND_URL}`);
console.log(`[AUTH-DEBUG] BACKEND_URL=${BACKEND_URL}`);
console.log(`[AUTH-DEBUG] NODE_ENV=${process.env.NODE_ENV || "not set"}`);
console.log(`[AUTH-DEBUG] PORT=${process.env.PORT || "not set"}`);
console.log(`[AUTH-DEBUG] CORS origin=${FRONTEND_URL}, credentials=true`);

app.set("trust proxy", 1);
app.use(
  cors({
    origin: FRONTEND_URL,
    credentials: true,
  })
);
app.use(express.json());
app.use(sessionMiddleware);
app.use(passportInit);
app.use(passportSession);

app.use("/courses", coursesRouter);
app.use("/auth", authRouter);
app.use("/saved-courses", savedCoursesRouter);
app.use("/api/planner", plannerRouter);
app.use("/api/completed-courses", completedCoursesRouter);
app.use("/api/gpa", gpaRouter);
app.use("/api/resolutions", resolutionsRouter);

app.get("/", (_req, res) => {
  res.json({
    message: "High School Course Planner API running",
  });
});

app.get("/health", (_req, res) => {
  res.status(200).json({ status: "ok" });
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`Backend running on port ${PORT}`);
});
