# Placement AI Backend (Person 1)

Setup: `npm install`, copy `.env.example` to `.env` and add your Gemini key (https://aistudio.google.com/apikey), then `npm start`.
Test: `npm test` (eligibility, no key needed). `WITH_AI=1 npm test` also tests Gemini endpoints.
CORS is on, so any frontend can call it. Never put the key in frontend code.

## Endpoints (all POST JSON unless noted)
| Route | Send | Get back |
|---|---|---|
| GET /api/data | - | sample student, company, seniors, companies |
| /api/resume/parse | `{fileBase64, mimeType}` or `{text}` | student profile: name, branch, year, cgpa, backlogs, skills, projects, internships, certifications, `missing` (fields to ask the student; always let them confirm) |
| /api/notice/extract | `{text}` or `{fileBase64, mimeType}` | notice: company, role, package, eligibleBranches, minCgpa, maxBacklogs, requiredSkills, rounds, deadline |
| /api/eligibility | `{student, notice}` | `{verdict: eligible/almost/not_eligible, checks, reasons, skillGaps, deadline}` |
| /api/eligibility/action | `{student, companies?}` | `{before, best:{skill,before,after}, options}` (the "4 to 9" number) |
| /api/mock/questions | `{mode: "baseline"/"final", baseline?, student?, company?, count?}` | questions: question, source, topic, difficulty, idealPoints |
| /api/mock/evaluate | `{question, audioBase64, mimeType}` (or `textAnswer`) | transcript, correctness, depth, communication, feedback, missed, modelAnswer, followUp, weakTopic |
| /api/mock/summary | `{answers, baselineSummary?}` | overall, topicScores, weakTopics, and delta/topicDeltas/stillWeak in final mode |
| /api/roadmap | `{student, notice, skillGaps, weakTopics, daysLeft, hoursPerDay, startDate?}` | tasks: day, date, topic, durationMins, type, reason, done |

## Data files (data/)
- student.json: your student profile (later: from resume parsing)
- companies.json: all drives (later: from notice extraction; sample data)
- company.json: the drive used for the mock interview
- seniors.json: senior experiences (from the Google Form); sample data, replace with real

## Flow
resume parse -> confirm profile -> extract notice -> eligibility -> mock (baseline) -> summary.weakTopics -> roadmap -> mock (final, with baselineSummary) -> summary = readiness report
Keep baselineSummary in your database (Firestore) between the two mocks.
