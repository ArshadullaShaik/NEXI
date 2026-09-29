import { GoogleGenAI } from "@google/genai";
export const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
export const MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";
// Ask Gemini and get back parsed JSON that matches `schema`.
export async function askJson(parts, schema) {
  const contents = [{ role: "user", parts: typeof parts === "string" ? [{ text: parts }] : parts }];
  const r = await ai.models.generateContent({ model: MODEL, contents, config: { responseMimeType: "application/json", responseSchema: schema } });
  return JSON.parse(r.text);
}
