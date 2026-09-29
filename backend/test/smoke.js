// Run: npm start (one terminal), then npm test. Set WITH_AI=1 to also test Gemini endpoints.
const B = "http://localhost:" + (process.env.PORT || 3000);
const post = (p, b) => fetch(B + p, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(b) }).then(r => r.json());
const d = await (await fetch(B + "/api/data")).json();
console.log("ACTION:", JSON.stringify(await post("/api/eligibility/action", { student: d.student })));
console.log("ELIGIBILITY:", JSON.stringify(await post("/api/eligibility", { student: d.student, notice: d.companies[1] })));
if (process.env.WITH_AI) {
  console.log("NOTICE:", JSON.stringify(await post("/api/notice/extract", { text: "TCS Ninja drive. B.Tech CSE/IT/ECE, min 7.0 CGPA, no active backlogs. Skills: SQL, Java. Apply by 20 Oct 2026." })));
  const q = await post("/api/mock/questions", { mode: "baseline", count: 3 });
  console.log("QUESTIONS:", JSON.stringify(q, null, 1));
  const e = await post("/api/mock/evaluate", { question: q[0], textAnswer: "I don't know much about that." });
  console.log("EVAL (should score low):", JSON.stringify(e));
  const s = await post("/api/mock/summary", { answers: [{ ...e, question: q[0].question, topic: q[0].topic }] });
  console.log("SUMMARY:", JSON.stringify(s));
  console.log("ROADMAP:", JSON.stringify(await post("/api/roadmap", { student: d.student, daysLeft: 7, hoursPerDay: 2, skillGaps: ["SQL"], weakTopics: s.weakTopics }), null, 1));
}
