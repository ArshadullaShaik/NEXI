import { Type } from "@google/genai";
import { askJson } from "./gemini.js";
const S = Type.STRING, arr = t => ({ type: Type.ARRAY, items: { type: t } });
const schema = { type: Type.OBJECT, properties: {
  company: { type: S }, role: { type: S }, package: { type: S },
  eligibleBranches: arr(S), minCgpa: { type: Type.NUMBER }, maxBacklogs: { type: Type.INTEGER },
  requiredSkills: arr(S), rounds: arr(S), deadline: { type: S }, location: { type: S }, applyLink: { type: S } },
  required: ["company", "role", "eligibleBranches", "minCgpa", "maxBacklogs", "requiredSkills", "deadline"] };

// Input: pasted text, or a PDF/photo as base64 (mimeType e.g. application/pdf, image/jpeg).
export async function extractNotice({ text, fileBase64, mimeType }) {
  const parts = [{ text: `Extract placement notice details. Today is ${new Date().toISOString().slice(0, 10)}.
Branches as short codes (CSE, ECE, IT, EEE, MECH, CIVIL); "all branches" -> ["ALL"]. minCgpa 0 if not stated; maxBacklogs 0 if "no backlogs", 99 if not stated.
deadline as YYYY-MM-DD ("" if missing). Never invent values that are not in the notice.
${text ? "NOTICE TEXT:\n" + text : ""}` }];
  if (fileBase64) parts.push({ inlineData: { mimeType: mimeType || "application/pdf", data: fileBase64 } });
  const n = await askJson(parts, schema);
  if (n.eligibleBranches?.map(b => b.toUpperCase()).includes("ALL")) n.eligibleBranches = [];
  return n;
}
