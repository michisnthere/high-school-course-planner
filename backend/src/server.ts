import express from "express";
import cors from "cors";
import "dotenv/config";
import coursesRouter from "./routes/courses.js";
import authRouter from "./routes/auth.js";
import savedCoursesRouter from "./routes/savedCourses.js";
import plannerRouter from "./routes/planner.js";
import {
  sessionMiddleware,
  passportInit,
  passportSession,
} from "./lib/auth.js";

const app = express();
const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:3000";

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

app.get("/", (_req, res) => {
  res.json({
    message: "High School Course Planner API running",
  });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Backend running on port ${PORT}`);
});
