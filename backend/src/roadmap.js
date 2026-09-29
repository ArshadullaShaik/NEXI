import { Type } from "@google/genai";
import { askJson } from "./gemini.js";
const S = Type.STRING, I = Type.INTEGER;
const schema = { type: Type.ARRAY, items: { type: Type.OBJECT, properties: {
  day: { type: I }, topic: { type: S }, durationMins: { type: I },
  type: { type: S, enum: ["learn", "practice", "revise", "mock"] }, reason: { type: S } },
  required: ["day", "topic", "durationMins", "type", "reason"] } };

// Day-by-day plan from today until the drive. weakTopics come from the baseline mock.
export async function generateRoadmap({ student, notice, seniors = [], weakTopics = [], skillGaps = [], daysLeft, hoursPerDay = 2, startDate }) {
  const start = startDate ? new Date(startDate) : new Date();
  const relevant = seniors.filter(s => s.company?.toLowerCase() === notice.company?.toLowerCase() || s.role?.toLowerCase() === notice.role?.toLowerCase());
  const tasks = await askJson(`Create a day-by-day prep roadmap for a student before a placement drive.
Days available: ${daysLeft}. Hours per day: ${hoursPerDay} (each day's total durationMins must be <= ${hoursPerDay * 60}).
Rules: Day 1 includes a "mock" task (baseline diagnostic). Day ${daysLeft - 1} is a "mock" task (final mock). Last day is light revision and checking documents/application.
Prioritize: 1) required skill gaps 2) weak topics from the mock 3) topics that campus seniors were asked or failed on. Give less time to low-impact topics.
If days are too few to learn a skill properly, prioritize the basics and say so in "reason".
Every task's "reason" must cite the evidence (skill gap, weak topic, or senior data) in one sentence.
STUDENT: ${JSON.stringify(student)}
DRIVE: ${JSON.stringify(notice)}
SKILL GAPS: ${JSON.stringify(skillGaps)}
WEAK TOPICS FROM MOCK: ${JSON.stringify(weakTopics)}
SENIOR EXPERIENCES: ${JSON.stringify(relevant)}`, schema);
  return tasks.sort((a, b) => a.day - b.day).map(t => {
    const d = new Date(start); d.setDate(d.getDate() + t.day - 1);
    return { ...t, date: d.toISOString().slice(0, 10), done: false };
  });
}
