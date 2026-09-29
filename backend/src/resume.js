import { Type } from "@google/genai";
import { askJson } from "./gemini.js";
const S = Type.STRING, arr = t => ({ type: Type.ARRAY, items: { type: t } });
const schema = { type: Type.OBJECT, properties: {
  name: { type: S }, branch: { type: S }, year: { type: Type.INTEGER },
  cgpa: { type: Type.NUMBER }, backlogs: { type: Type.INTEGER },
  skills: arr(S),
  projects: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { title: { type: S }, description: { type: S } }, required: ["title", "description"] } },
  internships: arr(S), certifications: arr(S),
  missing: arr(S) },
  required: ["name", "branch", "cgpa", "skills", "projects", "missing"] };

// Input: resume PDF/image as base64 (mimeType application/pdf, image/jpeg...) or pasted text.
// The student must confirm the result, so `missing` lists fields the resume did not state.
export async function parseResume({ fileBase64, mimeType, text }) {
  const parts = [{ text: `Extract a student profile from this resume.
Branch as a short code (CSE, ECE, IT, EEE, MECH, CIVIL). skills: individual technologies only (Python, SQL, React), no soft skills.
Project descriptions: 1 sentence on what it does and the tech used, based only on the resume.
Never invent values. If CGPA, branch, year or backlogs are not stated, use 0 / "" and add the field name to "missing".
${text ? "RESUME TEXT:\n" + text : ""}` }];
  if (fileBase64) parts.push({ inlineData: { mimeType: mimeType || "application/pdf", data: fileBase64 } });
  const p = await askJson(parts, schema);
  p.backlogs ??= 0;
  return p;
}
