// Pure logic, no AI: fast and predictable. Verdicts: eligible | almost | not_eligible
const norm = s => String(s).trim().toLowerCase();

export function checkEligibility(student, notice) {
  const has = new Set((student.skills || []).map(norm));
  const checks = {
    branch: !notice.eligibleBranches?.length || notice.eligibleBranches.map(norm).includes(norm(student.branch)),
    cgpa: student.cgpa >= (notice.minCgpa || 0),
    backlogs: (student.backlogs || 0) <= (notice.maxBacklogs ?? 99),
  };
  const skillGaps = (notice.requiredSkills || []).filter(s => !has.has(norm(s)));
  const reasons = [];
  if (!checks.branch) reasons.push(`Branch ${student.branch} is not eligible`);
  if (!checks.cgpa) reasons.push(`CGPA ${student.cgpa}, needs ${notice.minCgpa}`);
  if (!checks.backlogs) reasons.push(`Backlogs ${student.backlogs || 0}, max allowed ${notice.maxBacklogs}`);
  const hardOk = checks.branch && checks.cgpa && checks.backlogs;
  const verdict = !hardOk ? "not_eligible" : skillGaps.length ? "almost" : "eligible";
  return { company: notice.company, verdict, checks, reasons, skillGaps, deadline: notice.deadline };
}

export const countEligible = (student, notices, extraSkills = []) => {
  const s = { ...student, skills: [...(student.skills || []), ...extraSkills] };
  return notices.filter(n => checkEligibility(s, n).verdict === "eligible").length;
};

// "Your action this week": the skill that unlocks the most companies (before -> after).
export function bestAction(student, notices) {
  const before = countEligible(student, notices);
  const gaps = new Set();
  notices.forEach(n => { const r = checkEligibility(student, n); if (r.verdict === "almost") r.skillGaps.forEach(g => gaps.add(g)); });
  const options = [...gaps].map(skill => ({ skill, before, after: countEligible(student, notices, [skill]) })).sort((a, b) => b.after - a.after);
  return { before, best: options[0] || null, options };
}
