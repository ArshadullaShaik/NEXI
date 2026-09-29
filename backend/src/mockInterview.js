// Core logic: question generator + voice answer evaluator + summary.
import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const MODEL = process.env.GEMINI_MODEL || "gemini-3.5-flash-lite";

// Step 1 (optional): what does the internet say this role usually asks?
export async function roleBrief(company) {
  try {
    const r = await ai.models.generateContent({
      model: MODEL,
      contents: `What topics and questions are commonly asked in fresher interviews for "${company.role}" at ${company.name} or similar companies? Use recent web info. Max 150 words, plain bullets.`,
      config: { tools: [{ googleSearch: {} }] },
    });
    return r.text || "";
  } catch { return ""; }
}

// Senior experiences that match company first, else same role.
function matchSeniors(seniors, company) {
  const same = seniors.filter(s => s.company.toLowerCase() === company.name.toLowerCase());
  if (same.length) return same;
  return seniors.filter(s => s.role.toLowerCase() === company.role.toLowerCase());
}

const questionSchema = {
  type: Type.ARRAY,
  items: {
    type: Type.OBJECT,
    properties: {
      question: { type: Type.STRING },
      source: { type: Type.STRING, enum: ["resume", "campus", "gap", "role"] },
      topic: { type: Type.STRING },
      difficulty: { type: Type.INTEGER },
      idealPoints: { type: Type.ARRAY, items: { type: Type.STRING } },
    },
    required: ["question", "source", "topic", "difficulty", "idealPoints"],
  },
};

// mode: "baseline" (broad) or "final" (targets weak topics, avoids repeats)
export async function generateQuestions({ mode, student, company, seniors = [], baseline, count = 5, useSearch = true }) {
  const brief = useSearch ? await roleBrief(company) : "";
  const matched = matchSeniors(seniors, company);
  const modeRule = mode === "final"
    ? `FINAL mock the day before the drive. Focus mostly on these weak topics: ${JSON.stringify(baseline?.weakTopics || [])}. Do NOT repeat or paraphrase these earlier questions: ${JSON.stringify(baseline?.questions || [])}.`
    : `BASELINE mock to diagnose the student. Cover a broad mix of topics the company needs.`;

  const prompt = `You are a strict, fair technical interviewer preparing a spoken mock interview.
${modeRule}
Generate exactly ${count} questions for the Technical round. Mix sources:
- "resume": about the student's own projects/skills (ask why/how/what-if, not definitions)
- "campus": adapted from questions SRM AP seniors were asked (use the senior data below)
- "gap": beginner-level questions on the student's skill gaps
- "role": common questions for this role from the web brief
Questions must be answerable aloud in 1-2 minutes. Ordered easy to hard. idealPoints = 3-5 short key points a good answer covers.

STUDENT: ${JSON.stringify(student)}
COMPANY & ROLE: ${JSON.stringify(company)}
SENIOR EXPERIENCES (may be empty): ${JSON.stringify(matched)}
WEB BRIEF (may be empty): ${brief}`;

  const r = await ai.models.generateContent({
    model: MODEL, contents: prompt,
    config: { responseMimeType: "application/json", responseSchema: questionSchema },
  });
  return JSON.parse(r.text);
}

const evalSchema = {
  type: Type.OBJECT,
  properties: {
    transcript: { type: Type.STRING },
    correctness: { type: Type.INTEGER },
    depth: { type: Type.INTEGER },
    communication: { type: Type.INTEGER },
    feedback: { type: Type.STRING },
    missed: { type: Type.ARRAY, items: { type: Type.STRING } },
    modelAnswer: { type: Type.STRING },
    followUp: { type: Type.STRING },
    weakTopic: { type: Type.STRING },
  },
  required: ["transcript", "correctness", "depth", "communication", "feedback", "missed", "modelAnswer", "followUp", "weakTopic"],
};

// Takes a spoken answer (base64 audio) or typed text. Gemini transcribes AND evaluates in one call.
export async function evaluateAnswer({ question, audioBase64, mimeType = "audio/webm", textAnswer }) {
  const parts = [{ text: `You are a strict but fair interviewer. Question: "${question.question}"
Topic: ${question.topic}. A good answer covers: ${JSON.stringify(question.idealPoints || [])}.
The student answers by voice (may mix Telugu and English; write the transcript in English/Roman script, verbatim).
1) Transcribe the answer. If silent or unintelligible, transcript is "" and all scores are 1.
2) Score 1-5 (be strict; 3 = average, 5 = excellent): correctness, depth (explains why, not just what), communication (structured, concise).
3) Judge ONLY what was actually said; list key points they missed.
4) Give short feedback, a concise model answer, ONE follow-up question based on what they said, and weakTopic (a short topic name, e.g. "SQL Joins").` }];
  if (audioBase64) parts.push({ inlineData: { mimeType, data: audioBase64 } });
  else parts.push({ text: `Student's typed answer: ${textAnswer || ""}` });

  const r = await ai.models.generateContent({
    model: MODEL, contents: [{ role: "user", parts }],
    config: { responseMimeType: "application/json", responseSchema: evalSchema },
  });
  return JSON.parse(r.text);
}

// Aggregate answers -> scores, weak topics, and comparison with baseline (readiness).
export function summarize({ answers, baselineSummary }) {
  const avg = a => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);
  const score = a => avg([a.correctness, a.depth, a.communication]);
  const byTopic = {};
  answers.forEach(a => { (byTopic[a.weakTopic || a.topic] ||= []).push(score(a)); });
  const topicScores = Object.fromEntries(Object.entries(byTopic).map(([t, s]) => [t, +avg(s).toFixed(1)]));
  const summary = {
    overall: +avg(answers.map(score)).toFixed(1),
    correctness: +avg(answers.map(a => a.correctness)).toFixed(1),
    depth: +avg(answers.map(a => a.depth)).toFixed(1),
    communication: +avg(answers.map(a => a.communication)).toFixed(1),
    topicScores,
    weakTopics: Object.keys(topicScores).filter(t => topicScores[t] < 3),
    questions: answers.map(a => a.question),
  };
  if (baselineSummary) {
    summary.delta = +(summary.overall - baselineSummary.overall).toFixed(1);
    summary.topicDeltas = Object.fromEntries(Object.keys(topicScores).filter(t => t in baselineSummary.topicScores)
      .map(t => [t, +(topicScores[t] - baselineSummary.topicScores[t]).toFixed(1)]));
    summary.stillWeak = summary.weakTopics;
  }
  return summary;
}
