const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Master skill list every resume is cross-referenced against.
export const SKILLS = ['React', 'Node.js', 'Python', 'Java', 'JavaScript', 'TypeScript', 'C++', 'SQL', 'MongoDB', 'AWS', 'Docker', 'Kubernetes', 'Git', 'DSA', 'System Design', 'Machine Learning', 'Next.js', 'Django', 'Spring Boot', 'TensorFlow', 'Linux'];

// Alternate spellings that also count as evidence for a master skill.
const ALIAS = {
  'Node.js': ['nodejs', 'node js', 'node'],
  React: ['reactjs', 'react.js', 'react js'],
  AWS: ['amazon web services'],
  DSA: ['data structures', 'data structure and algorithm', 'algorithms', 'competitive programming'],
  SQL: ['mysql', 'postgres', 'postgresql', 'sqlite', 'pl/sql', 'sql server'],
  'C++': ['cpp'],
  JavaScript: ['js', 'ecmascript', 'es6'],
  Python: ['python3'],
  'Machine Learning': ['ml'],
  'Next.js': ['nextjs', 'next js'],
  MongoDB: ['mongo'],
  TypeScript: ['ts'],
  'Spring Boot': ['spring boot', 'springboot', 'spring'],
  Kubernetes: ['k8s'],
  Linux: ['unix'],
};

// ---- boundary-safe term matching (no lookbehind, so it works everywhere) ----
const BOUND = '(?:^|[^a-z0-9+#])';
const AFTER = '(?=$|[^a-z0-9+#])';
const reCache = new Map();
const termRe = (term) => {
  if (!reCache.has(term)) reCache.set(term, new RegExp(BOUND + esc(term.toLowerCase()) + AFTER, 'i'));
  return reCache.get(term);
};
export const hasTerm = (text, term) => termRe(String(term).toLowerCase()).test(text);

// Which of the master skills appear in the text (alias-aware, case-insensitive).
export function detectSkills(text) {
  const src = String(text || '');
  return SKILLS.filter((s) => [s, ...(ALIAS[s] || [])].some((t) => hasTerm(src, t)));
}

// ---- CGPA / GPA -----------------------------------------------------------------
// Handles "CGPA: 8.5/10", "CGPA 8.5", "8.5 CGPA", "8.5/10 CGPA", "GPA 3.8",
// "SGPA: 9.2", "CGPA of 8.54", "gpa - 3.6/4.0" ...
const SCALE = '\\d{1,2}(?:\\.\\d+)?';
const K = '(?:cgpa|gpa|sgpa|spi|cgpi|pointer|cumulative\\s+gpa|grade\\s+point\\s+average)';
const CGPA_PATTERNS = [
  new RegExp(`${K}\\s*(?:of|is|:|=|-)?\\s*(\\d{1,2}(?:\\.\\d{1,2})?)\\s*(?:\\/|out\\s+of|on\\s+a\\s+scale\\s+of)\\s*(${SCALE})`, 'i'),
  new RegExp(`${K}\\s*(?:of|is|:|=|-)?\\s*(\\d{1,2}(?:\\.\\d{1,2})?)`, 'i'),
  new RegExp(`(\\d{1,2}(?:\\.\\d{1,2})?)\\s*(?:\\/|out\\s+of)\\s*(${SCALE})\\s*(?:cgpa|gpa|spi|pointer)\\b`, 'i'),
  new RegExp(`(\\d{1,2}(?:\\.\\d{1,2})?)\\s*(?:cgpa|gpa|spi|pointer)\\b`, 'i'),
];
// "3.9 (4.00 scale)" / "on a 4.0 scale" written away from the number itself.
const SCALE_HINT = /\(\s*(\d(?:\.\d+)?)\s*(?:\.\d+)?\s*scale\s*\)|scale\s*(?:of|:)?\s*(\d(?:\.\d+)?)/i;
const r2 = (v) => Math.round(v * 100) / 100;

/** Normalises any GPA notation onto the 0-10 scale the company cutoffs use. */
function toTenScale(value, scale) {
  if (value == null || Number.isNaN(value)) return null;
  if (scale && scale > 0 && scale <= 10) return r2((value / scale) * 10);
  if (value > 10) return null;          // e.g. a percentage, not a GPA
  if (value <= 4.5) return r2((value / 4) * 10); // bare "GPA 3.8" is a 4.0-scale score
  return r2(value);
}

export function extractCgpa(text) {
  const src = String(text || '');
  const hint = src.match(SCALE_HINT);
  const hintScale = hint ? parseFloat(hint[1] || hint[2]) : null;
  for (const re of CGPA_PATTERNS) {
    const m = src.match(re);
    if (!m) continue;
    const raw = parseFloat(m[1]);
    const scales = [m[2] ? parseFloat(m[2]) : hintScale, null]; // declared scale, then the naive reading
    for (const scale of scales) {
      const cgpa = toTenScale(raw, scale);
      if (cgpa != null && cgpa > 0 && cgpa <= 10) return cgpa;
    }
  }
  return null;
}

// ---- Major / branch --------------------------------------------------------------
// Full words are matched case-insensitively; acronyms (IT, CS, ME…) only in caps so
// ordinary prose ("...do it now") never reads as a branch.
const BRANCHES = [
  ['CSE', [/computer\s*(?:&|and)?\s*science/i, /\bCSE\b|\bCS\b/]],
  ['IT', [/information\s*(?:&|and)?\s*technology/i, /\bIT\b/]],
  ['ECE', [/electronics\s*(?:&|and)?\s*communication/i, /\bECE\b/]],
  ['EEE', [/electrical\s*(?:&|and)?\s*electronics/i, /\bEEE\b/]],
  ['Mechanical', [/mechanical/i, /\bMECH\b/]],
  ['Civil', [/\bcivil\b/i]],
  ['Chemical', [/chemical/i]],
  ['Biotech', [/biotech(?:nology)?/i]],
  ['AI', [/artificial\s*(?:&|and)?\s*intelligence/i, /\bAIML\b/i, /\bAI\b/]],
  ['Data Science', [/data\s*(?:&|and)?\s*science/i, /\bDS\b/]],
];

export function extractBranch(text) {
  const src = String(text || '');
  // Prefer an explicit "Branch/Major/Stream: …" label when one exists.
  const labelled = src.match(/(?:branch|major|stream|speciali[sz]ation|department|discipline)\s*[:\-]\s*([A-Za-z0-9&/ ().+-]{2,40})/i);
  const scope = labelled ? labelled[1] : '';
  if (scope) for (const [key, res] of BRANCHES) if (res.some((r) => r.test(scope))) return key;
  for (const [key, res] of BRANCHES) if (res.some((r) => r.test(src))) return key;
  return '';
}

// ---- Name ------------------------------------------------------------------------
const BOILERPLATE = /^(resume|curriculum vitae|cv|education|skills|skill[s]?&|experience|projects?|contact|address|objective|declaration|summary|profile|personal details|work experience)\b/i;

function extractName(text, lines) {
  const labelled = String(text).match(/^\s*(?:name|candidate|applicant)\s*[:\-]\s*([^\n]+)$/im);
  if (labelled && labelled[1].trim().length <= 40) return labelled[1].trim();
  return (lines.find((l) => l.length < 40 && l.split(' ').length <= 5 && !/[\d@:|]/.test(l) && !BOILERPLATE.test(l)) || 'Unknown').trim();
}

export function parseResume(text) {
  const src = String(text || '').replace(/\r\n?/g, '\n');
  const lines = src.split('\n').map((l) => l.trim()).filter(Boolean);
  return {
    name: extractName(src, lines),
    cgpa: extractCgpa(src),
    branch: extractBranch(src),
    skills: detectSkills(src),
  };
}

// ---- Company evaluation -----------------------------------------------------------
const n = (s) => String(s).toLowerCase().trim();
const list = (a) => a.join(', ');

export function evaluate(p, c) {
  const have = new Set((p.skills || []).map(n));
  const matched = c.skills.filter((s) => have.has(n(s)));
  const missing = c.skills.filter((s) => !have.has(n(s)));
  const skillPct = c.skills.length ? Math.round((matched.length / c.skills.length) * 100) : 100;

  const branches = c.branches || ['Any'];
  const branchOk = branches.some((b) => n(b) === 'any') || (!!p.branch && branches.some((b) => n(b) === n(p.branch)));
  const cgpaOk = p.cgpa != null && p.cgpa >= c.minCgpa;
  const gate = branchOk && cgpaOk;

  let status = 'Eligible';
  let reason = `Eligible — CGPA & branch OK, ${matched.length}/${c.skills.length} skills matched`;
  if (!branchOk) {
    status = 'Branch Ineligible';
    reason = `Ineligible — branch ${p.branch || 'not detected'} not in ${list(branches)}`;
  } else if (p.cgpa == null) {
    status = 'CGPA Unknown';
    reason = `Ineligible — no CGPA found in the resume (min ${c.minCgpa} needed)`;
  } else if (!cgpaOk) {
    status = 'CGPA Shortfall';
    reason = `Ineligible — CGPA ${p.cgpa} below required ${c.minCgpa}`;
  } else if (skillPct < 70) {
    status = 'Skill Gap';
    reason = `Ineligible — gates OK but missing ${list(missing)}`;
  } else if (missing.length) {
    reason = `Eligible — CGPA & branch OK, missing ${list(missing)}`;
  }

  return { matched, missing, skillPct, status, reason, gate, branchOk, cgpaOk, eligible: gate && skillPct >= 70 };
}

// Readiness = mean skill match of your best 3 companies you can actually apply to. 0 if none.
export function readiness(p, companies) {
  if (!p) return 0;
  const top = companies.map((c) => evaluate(p, c)).filter((e) => e.gate).map((e) => e.skillPct).sort((a, b) => b - a).slice(0, 3);
  return top.length ? Math.round(top.reduce((a, b) => a + b, 0) / top.length) : 0;
}
export function deadlineInfo(iso) {
  const h = (new Date(iso) - Date.now()) / 36e5;
  if (h < 0) return { label: 'Expired', tone: 'slate', dot: 'bg-slate-400', urgent: false };
  const label = h < 48 ? `${Math.ceil(h)}h left` : `${Math.ceil(h / 24)}d left`;
  if (h <= 48) return { label, tone: 'red', dot: 'bg-red-500', urgent: true };
  if (h <= 168) return { label, tone: 'yellow', dot: 'bg-amber-400', urgent: true };
  return { label, tone: 'green', dot: 'bg-emerald-500', urgent: false };
}

// Tracker badges: ms remaining until the deadline.
export function deadlineBadge(ms) {
  if (ms <= 0) return { tone: 'slate', label: 'Expired', expired: true, urgent: false };
  if (ms < 864e5) return { tone: 'red', label: 'Urgent - <24 hrs left', expired: false, urgent: true };
  if (ms < 2592e5) return { tone: 'yellow', label: 'Closing Soon - <3 days left', expired: false, urgent: false };
  return { tone: 'green', label: 'Open', expired: false, urgent: false };
}

const pad = (n) => String(n).padStart(2, '0');
// "2d 05h 59m 02s" / "05h 59m 02s" for the live countdown column.
export function countdownLabel(ms) {
  if (ms <= 0) return 'Deadline passed';
  const s = Math.floor(ms / 1000);
  const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  return d > 0 ? `${d}d ${pad(h)}h ${pad(m)}m ${pad(sec)}s` : `${pad(h)}h ${pad(m)}m ${pad(sec)}s`;
}

// ---- Skill-gap roadmap -----------------------------------------------------------
// tier: 'core'  = interview-critical for most engineering roles
//       'stack' = role/framework depth
//       'tool'  = good-to-have tooling
export const SKILL_META = {
  'DSA': { tier: 'core', resources: [
    { label: 'LeetCode Top 150', url: 'https://leetcode.com/studyplan/top-150/' },
    { label: 'NeetCode 150', url: 'https://neetcode.io/practice' }] },
  'System Design': { tier: 'core', resources: [
    { label: 'System Design Primer', url: 'https://github.com/donnemartin/system-design-primer' },
    { label: 'ByteByteGo', url: 'https://bytebytego.com/' }] },
  'SQL': { tier: 'core', resources: [
    { label: 'SQLBolt', url: 'https://sqlbolt.com/' },
    { label: 'LeetCode SQL 50', url: 'https://leetcode.com/studyplan/top-sql-50/' }] },
  'JavaScript': { tier: 'core', resources: [
    { label: 'MDN Docs', url: 'https://developer.mozilla.org/en-US/docs/Web/JavaScript' },
    { label: 'javascript.info', url: 'https://javascript.info/' }] },
  'Python': { tier: 'core', resources: [
    { label: 'Python Tutorial', url: 'https://docs.python.org/3/tutorial/' },
    { label: 'Real Python', url: 'https://realpython.com/' }] },
  'Java': { tier: 'core', resources: [
    { label: 'Java Tutorials', url: 'https://docs.oracle.com/javase/tutorial/' },
    { label: 'Refactoring Guru: Patterns', url: 'https://refactoring.guru/design-patterns/java' }] },
  'C++': { tier: 'core', resources: [
    { label: 'C++ Reference', url: 'https://en.cppreference.com/' },
    { label: 'LearnCpp', url: 'https://www.learncpp.com/' }] },
  'React': { tier: 'stack', resources: [
    { label: 'React Docs (Learn)', url: 'https://react.dev/learn' },
    { label: 'Epic React Workshop', url: 'https://epicreact.dev/' }] },
  'Next.js': { tier: 'stack', resources: [
    { label: 'Next.js Learn', url: 'https://nextjs.org/learn' },
    { label: 'Next.js Docs', url: 'https://nextjs.org/docs' }] },
  'Node.js': { tier: 'stack', resources: [
    { label: 'Node.js Docs', url: 'https://nodejs.org/en/learn' },
    { label: 'Express Guide', url: 'https://expressjs.com/en/guide/routing.html' }] },
  'TypeScript': { tier: 'stack', resources: [
    { label: 'TS Handbook', url: 'https://www.typescriptlang.org/docs/handbook/intro.html' },
    { label: 'Total TypeScript', url: 'https://www.totaltypescript.com/' }] },
  'MongoDB': { tier: 'stack', resources: [
    { label: 'MongoDB University', url: 'https://learn.mongodb.com/' },
    { label: 'MongoDB Docs', url: 'https://www.mongodb.com/docs/' }] },
  'Django': { tier: 'stack', resources: [
    { label: 'Django Tutorial', url: 'https://docs.djangoproject.com/en/stable/intro/tutorial01/' },
    { label: 'MDN: Django Web Framework', url: 'https://developer.mozilla.org/en-US/docs/Learn/Server-side/Django' }] },
  'Spring Boot': { tier: 'stack', resources: [
    { label: 'Spring Guides', url: 'https://spring.io/guides' },
    { label: 'Spring Boot Reference', url: 'https://docs.spring.io/spring-boot/docs/current/reference/html/' }] },
  'Machine Learning': { tier: 'stack', resources: [
    { label: 'Andrew Ng: ML Course', url: 'https://www.coursera.org/learn/machine-learning' },
    { label: 'Google ML Crash Course', url: 'https://developers.google.com/machine-learning/crash-course' }] },
  'TensorFlow': { tier: 'stack', resources: [
    { label: 'TensorFlow Tutorials', url: 'https://www.tensorflow.org/tutorials' },
    { label: 'DeepLearning.AI Specialization', url: 'https://www.deeplearning.ai/' }] },
  'AWS': { tier: 'tool', resources: [
    { label: 'AWS Skill Builder', url: 'https://skillbuilder.aws/' },
    { label: 'AWS Docs', url: 'https://docs.aws.amazon.com/' }] },
  'Docker': { tier: 'tool', resources: [
    { label: 'Docker Get Started', url: 'https://docs.docker.com/get-started/' },
    { label: 'Play with Docker', url: 'https://labs.play-with-docker.com/' }] },
  'Kubernetes': { tier: 'tool', resources: [
    { label: 'Kubernetes Docs', url: 'https://kubernetes.io/docs/home/' },
    { label: 'Kubernetes by Example', url: 'https://kubernetesbyexample.com/' }] },
  'Git': { tier: 'tool', resources: [
    { label: 'Pro Git Book', url: 'https://git-scm.com/book/en/v2' },
    { label: 'Learn Git Branching', url: 'https://learngitbranching.js.org/' }] },
  'Linux': { tier: 'tool', resources: [
    { label: 'Linux Journey', url: 'https://linuxjourney.com/' },
    { label: 'OverTheWire: Bandit', url: 'https://overthewire.org/wargames/bandit/' }] },
};

// Curated links for a skill; falls back to a docs search for unknown/custom skills.
export function resourcesFor(skill) {
  return SKILL_META[skill]?.resources ||
    [{ label: `${skill} docs`, url: `https://www.google.com/search?q=${encodeURIComponent(skill + ' documentation tutorial')}` }];
}

const uniqBy = (arr, key) => { const seen = new Set(); return arr.filter((x) => { const v = x[key] || x; if (seen.has(v)) return false; seen.add(v); return true; }); };
const collect = (skills, extra = []) => uniqBy([...extra, ...skills.flatMap(resourcesFor)], 'url');

// (a) Critical Core Skills: interview-critical tier, or demanded by ≥40% of the listed companies.
// (b) Good-to-Have Skills: everything else (framework depth, tooling).
export function categorizeGaps(missing, companies) {
  const all = companies || [];
  const demand = {};
  all.forEach((c) => (c.skills || []).forEach((s) => { demand[s] = (demand[s] || 0) + 1; }));
  const critical = [], nice = [];
  (missing || []).forEach((s) => {
    const tier = SKILL_META[s]?.tier || 'stack';
    const hot = all.length >= 3 && (demand[s] || 0) / all.length >= 0.4;
    (tier === 'core' || hot ? critical : nice).push(s);
  });
  return { critical, nice };
}

const DRILL_RES = [
  { label: 'LeetCode Top 150', url: 'https://leetcode.com/studyplan/top-150/' },
  { label: 'System Design Primer', url: 'https://github.com/donnemartin/system-design-primer' },
  { label: 'Tech Interview Handbook', url: 'https://www.techinterviewhandbook.org/' },
  { label: 'Pramp (free mocks)', url: 'https://www.pramp.com/' },
];

// 4-week plan: Week 1 core fundamentals → Week 2 frameworks → Week 3 project → Week 4 interview drill.
export function buildRoadmap({ critical = [], nice = [], company, profile }) {
  const stack = [...critical, ...nice];
  const s = (n, one, many) => `${n} ${n === 1 ? one : many}`;
  const revision = (profile?.skills || []).slice(0, 4);
  return [
    {
      n: 1, title: 'Core Fundamentals', focus: 'Critical core skills',
      goal: critical.length
        ? `Master the ${s(critical.length, 'skill', 'skills')} ${company.name} screens for first — everything else is secondary.`
        : 'No critical gap detected. Deep revision so your existing skills survive a hard interview.',
      skills: critical.length ? critical : revision,
      tasks: critical.length
        ? critical.flatMap((x) => [`Learn the core concepts of ${x} (model, complexity, edge cases)`, `Drill ${x} with 15–20 interview-style questions`])
        : ['List the weakest topic inside each skill you already have', 'Re-solve 5 old problems you got wrong before'],
      resources: collect(critical.length ? critical : revision),
    },
    {
      n: 2, title: 'Frameworks & Tooling', focus: 'Good-to-have skills',
      goal: nice.length
        ? `Pick up the ${s(nice.length, 'skill', 'skills')} that make your stack match the job description.`
        : 'Stretch beyond the baseline: depth beats breadth when there is no gap left.',
      skills: nice.length ? nice : ['System Design', 'Linux'],
      tasks: nice.length
        ? nice.flatMap((x) => [`Complete one guided tutorial on ${x}`, `Wire ${x} into a small spike and break it on purpose`])
        : ['Study caching, queues and sharding at a whiteboard level', 'Read the source of one library you use daily'],
      resources: collect(nice.length ? nice : ['System Design', 'Linux'], [
        { label: 'System Design Primer', url: 'https://github.com/donnemartin/system-design-primer' }]),
    },
    {
      n: 3, title: 'Hands-on Project', focus: 'Prove it in code',
      goal: stack.length
        ? `Ship one public project that visibly uses ${stack.slice(0, 3).join(', ')}.`
        : 'Ship one public project that demonstrates your existing stack end to end.',
      skills: stack.length ? stack.slice(0, 4) : revision,
      tasks: [
        'Scaffold a public repo with Git and a clear README',
        `Implement the core feature using ${stack.length ? stack.slice(0, 3).join(', ') : 'your strongest stack'}`,
        'Add tests, error handling and one edge case you found yourself',
        'Deploy it or record a 2-minute demo GIF',
        'Rewrite 3 resume bullets from this project with numbers',
      ],
      resources: collect(stack.slice(0, 3)),
    },
    {
      n: 4, title: 'Interview Drill', focus: `Convert into an offer at ${company.name}`,
      goal: `Timed practice for ${company.role}: aptitude, coding, system design and HR rounds.`,
      skills: stack.slice(0, 3),
      tasks: [
        'Two timed coding mocks per week until the deadline',
        'One 45-minute system design mock, recorded and reviewed',
        `Research ${company.name} products and prep 5 STAR stories`,
        'Two behavioural mocks — own a failure, show the fix',
        `Apply before the deadline and tailor the resume to ${company.role}`,
      ],
      resources: DRILL_RES,
    },
  ];
}
