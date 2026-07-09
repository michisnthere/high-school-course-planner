import express from "express";
import cors from "cors";
import coursesRouter from "./routes/courses.js";
import "dotenv/config";

const app = express();

app.use(cors());
app.use(express.json());
app.use("/courses", coursesRouter);

app.get("/", (_req, res) => {
  res.json({
    message: "High School Course Planner API running"
  });
});

app.listen(4000, () => {
  console.log("Backend running on port 4000");
});