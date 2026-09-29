import "dotenv/config";
import express from "express";
import cors from "cors";
import { generateQuestions, evaluateAnswer, summarize } from "./src/mockInterview.js";

const app = express();
app.use(cors());
app.use(express.json({ limit: "25mb" }));

const route = (path, fn) => app.post(path, async (req, res) => {
  try { res.json(await fn(req.body)); } catch (e) { console.error(e); res.status(500).json({ error: e.message }); }
});

app.get("/health", (_, res) => res.json({ ok: true }));

// Mock interview endpoints
route("/api/mock/questions", generateQuestions);
route("/api/mock/evaluate", evaluateAnswer);
route("/api/mock/summary", summarize);

app.listen(process.env.PORT || 3000, () => console.log("Backend on port " + (process.env.PORT || 3000)));
