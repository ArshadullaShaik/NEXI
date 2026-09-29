import "dotenv/config";
import express from "express";
import cors from "cors";
import fs from "fs";
import { generateQuestions, evaluateAnswer, summarize } from "./mockInterview.js";

const app = express();
app.use(cors());
app.use(express.json({ limit: "25mb" }));
app.use(express.static("public"));

const read = f => JSON.parse(fs.readFileSync(`./data/${f}.json`, "utf8"));
const sample = () => ({ student: read("student"), company: read("company"), seniors: read("seniors") });

const route = (path, fn) => app.post(path, async (req, res) => {
  try { res.json(await fn(req.body)); } catch (e) { console.error(e); res.status(500).json({ error: e.message }); }
});

app.get("/api/data", (_, res) => res.json(sample()));
route("/api/questions", b => generateQuestions({ ...sample(), ...b }));
route("/api/evaluate", evaluateAnswer);
route("/api/summary", summarize);

app.listen(process.env.PORT || 3000, () => console.log("Server on port " + (process.env.PORT || 3000)));
