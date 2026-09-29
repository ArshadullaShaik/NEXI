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
  let reason = `CGPA & branch OK, ${matched.length}/${c.skills.length} skills matched`;
  if (!branchOk) {
    status = 'Branch Ineligible';
    reason = `Branch ${p.branch || 'not detected'} is not ${list(branches)}`;
  } else if (p.cgpa == null) {
    status = 'CGPA Unknown';
    reason = `No CGPA found in the resume (minimum ${c.minCgpa} required)`;
  } else if (!cgpaOk) {
    status = 'CGPA Shortfall';
    reason = `CGPA ${p.cgpa % 1 === 0 ? p.cgpa.toFixed(1) : p.cgpa} is below the required ${c.minCgpa}`;
  } else if (skillPct < 70) {
    status = 'Skill Gap';
    reason = `Gates OK, but missing ${list(missing)}`;
  } else if (missing.length) {
    reason = `Gates OK, still missing ${list(missing)}`;
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

// ---- roadmap.sh-style plan ----------------------------------------------------
// Chips shown next to every link in the resource drawer.
export function resourceKind(r) {
  const u = String(r?.url || ''), l = String(r?.label || '');
  if (/leetcode|neetcode|sqlbolt|pramp|learngitbranching|overthewire|play-with-docker/i.test(u)) return 'Practice';
  if (/git-scm\.com\/book|learncpp|cppreference/i.test(u)) return 'Book';
  if (/youtube|vimeo/i.test(u)) return 'Video';
  if (/coursera|udemy|scrimba|deeplearning\.ai|skillbuilder|learn\.mongodb|totaltypescript|epicreact|realpython|bytebytego/i.test(u)) return 'Course';
  if (/github\.com|dev\.to|medium\.com/i.test(u)) return 'Article';
  if (/mozilla|w3schools|docs\.|developer\.|\.org\/docs|readthedocs|spring\.io|git-scm|javascript\.info|typescriptlang|tensorflow\.org|docker\.com|kubernetes\.io|nodejs\.org|react\.dev|nextjs\.org|python\.org|oracle\.com|refactoring\.guru|linuxjourney|mongodb\.com\/docs|expressjs|djangoproject/i.test(u) ||
      /Docs|Reference|Handbook|Tutorial/i.test(l)) return 'Official';
  return 'Article';
}

// Intensity, driven by the hours/week the user commits to.
export const paceOf = (h) => (h < 5 ? 'light' : h <= 10 ? 'steady' : h <= 20 ? 'serious' : 'intensive');
export const PACE_NOTE = {
  light: 'Under 5 hrs — one core task per stage.',
  steady: '5–10 hrs — two to three focus tasks per stage.',
  serious: '10–20 hrs — full task list plus extra drills.',
  intensive: '20+ hrs — everything, plus extra mocks and project scope.',
};
const DRILL = { light: { qs: 8, mocks: 1 }, steady: { qs: 15, mocks: 2 }, serious: { qs: 25, mocks: 3 }, intensive: { qs: 40, mocks: 5 } };

const slug = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
const tsk = (label, desc) => ({ type: 'task', label, desc });
const nte = (text, link) => ({ type: 'note', text, link });
const pick = (arr, pace) => arr.slice(0, { light: 2, steady: 3, serious: 4, intensive: 99 }[pace] || arr.length);

function skillDesc(s, company) {
  const tier = SKILL_META[s]?.tier || 'stack';
  const where = tier === 'core' ? 'the online assessment and the DSA round'
    : tier === 'stack' ? 'the application / tech round'
    : 'tooling and workflow questions';
  return `${s} shows up in ${where} at ${company?.name || 'this company'}. Learn the core model first, then drill interview-style questions on it.`;
}
const skl = (s, company) => ({ type: 'skill', label: s, desc: skillDesc(s, company), resources: resourcesFor(s) });

// Stage builders. Each returns { title, kicker, goal, resources?, nodes[] } and is
// sized by `pace` so hours/week changes the task load, and `weeks` changes the set of stages.
const PHASES = {
  core: ({ critical, company, pace, revision }) => {
    const skills = (critical.length ? critical : revision).slice(0, 5);
    const { qs } = DRILL[pace];
    return {
      title: 'Core Fundamentals', kicker: 'Critical core skills',
      goal: critical.length
        ? `Master the ${critical.length} critical skill${critical.length > 1 ? 's' : ''} ${company?.name || 'the company'} screens for first — everything else is secondary.`
        : 'No critical gap detected. Deep revision so the skills you already have survive a hard interview.',
      resources: collect(critical.length ? critical : revision),
      nodes: [
        ...skills.flatMap((s) => [
          skl(s, company),
          tsk(`Learn the core concepts of ${s}`, 'Model, complexity, edge cases — explain each out loud.'),
        ]),
        ...(critical.length
          ? skills.map((s) => tsk(`Drill ${s} with ~${qs} interview-style questions`, 'Timed sets: write the solution, then say the complexity.'))
          : pick([
              tsk('List the weakest topic inside each skill you already have', 'Be honest — that is where interviews hurt.'),
              tsk('Re-solve 5 old problems you got wrong', "No peeking at your old solution first."),
              tsk('Write a one-page cheat sheet per skill', 'Syntax, pitfalls, complexity — one page each.'),
              tsk('Explain each skill aloud as if teaching it', 'If you stumble, you found a gap.'),
            ], pace)),
        nte('Interviewers probe edges, not APIs. If you can’t say the time complexity of your own solution out loud, you don’t know it yet.'),
      ],
    };
  },

  frameworks: ({ nice, company, pace }) => {
    const skills = nice.length ? nice.slice(0, 5) : ['System Design', 'Linux'];
    return {
      title: 'Frameworks & Tooling', kicker: 'Good-to-have skills',
      goal: nice.length
        ? `Pick up the ${nice.length} skill${nice.length > 1 ? 's' : ''} that make your stack match the job description.`
        : 'Stretch beyond the baseline: depth beats breadth when there is no gap left.',
      resources: collect(skills),
      nodes: [
        ...skills.flatMap((s) => [
          skl(s, company),
          tsk(`Complete one guided tutorial on ${s}`, 'Follow it end to end — no skipping steps.'),
        ]),
        tsk(`Wire ${skills[0]} into a small spike and break it on purpose`, 'Edge cases teach more than tutorials do.'),
        ...pick([
          tsk('Read the source of one library you use daily', 'One file is enough — start with its entry point.'),
          tsk('Swap one manual step for a script or CLI', 'Interviewers love seeing automation instincts.'),
        ], pace),
        nte('Depth beats breadth: one framework understood beats three sampled.', { label: 'roadmap.sh skill maps', url: 'https://roadmap.sh/' }),
      ],
    };
  },

  project: ({ stack, pace }) => ({
    title: 'Hands-on Project', kicker: 'Prove it in code',
    goal: stack.length
      ? `Ship one public project that visibly uses ${stack.slice(0, 3).join(', ')}.`
      : 'Ship one public project that demonstrates your existing stack end to end.',
    resources: collect(stack.slice(0, 3)),
    nodes: [
      tsk('Scaffold a public repo with a clear README', 'Name it, structure it, commit in small steps.'),
      tsk(`Implement the core feature using ${stack.slice(0, 3).join(', ') || 'your strongest stack'}`, 'One feature done properly beats five half-done.'),
      ...pick([
        tsk('Add tests, error handling and one edge case you found yourself', 'The edge case you found yourself is the best interview story.'),
        tsk('Deploy it or record a 2-minute demo GIF', 'A live link beats “it works on my machine”.'),
        tsk('Rewrite 3 resume bullets from this project with numbers', 'Shipped, tested, used by N — with metrics.'),
        tsk('Get one PR reviewed by a peer and act on the feedback', 'Shows collaboration, not just code.'),
      ], pace),
      nte('Interviewers will spend 10 minutes on this project — prepare the architecture, the trade-offs and one bug you fixed.',
        { label: 'Project ideas', url: 'https://roadmap.sh/frontend/projects' }),
    ],
  }),

  drill: ({ company, pace }) => {
    const { qs, mocks } = DRILL[pace];
    const name = company?.name || 'the company', role = company?.role || 'the role';
    return {
      title: 'Interview Drill', kicker: `Convert into an offer at ${name}`,
      goal: `Timed practice for ${role} — ~${qs} questions and ${mocks} mock${mocks > 1 ? 's' : ''} a week.`,
      resources: DRILL_RES,
      nodes: [
        tsk(`${mocks} timed coding mock${mocks > 1 ? 's' : ''} per week`, `~${qs} questions from LeetCode Top 150, fully clocked.`),
        tsk('One 45-minute system design mock, recorded and reviewed', 'Watch yourself: filler words, hand-waving, missing trade-offs.'),
        tsk(`Research ${name} products and prep 5 STAR stories`, 'Own a failure, show the fix, name the metric.'),
        tsk('Two behavioural mocks — answers under two minutes', 'Structure: situation, task, action, result — then stop.'),
        tsk(`Apply before the deadline, resume tailored to ${role}`, 'Mirror the job description’s exact keywords.'),
        nte('Mocks only count if you review the recording. One reviewed mock beats three unreviewed.',
          { label: 'Tech Interview Handbook', url: 'https://www.techinterviewhandbook.org/' }),
      ],
    };
  },

  system: ({ company, pace }) => ({
    title: 'System Design Depth', kicker: 'Whiteboard-level design',
    goal: 'Caching, queues, sharding and rate limiting — enough to reason, not to recite.',
    resources: collect(['System Design']),
    nodes: [
      skl('System Design', company),
      tsk('Walk through 3 designs: URL shortener, feed, chat', 'Requirements first, then the data model, then scale.'),
      ...pick([
        tsk('Study caching, queues and sharding at a whiteboard level', 'Draw the box, name the failure mode.'),
        tsk('Capacity-estimate one real product out loud', 'Users, QPS, storage — order of magnitude is enough.'),
        tsk('Map the architecture of one library you use', 'Read its README and sketch how the pieces fit.'),
      ], pace),
      nte('Design rounds reward trade-offs (“why not X?”) more than diagram art.',
        { label: 'System Design Primer', url: 'https://github.com/donnemartin/system-design-primer' }),
    ],
  }),

  mocks: ({ pace }) => {
    const { mocks, qs } = DRILL[pace];
    return {
      title: 'Mock Interviews', kicker: 'Practise the performance',
      goal: `${mocks} mocks this stage — because knowing and performing are different skills.`,
      resources: collect([], DRILL_RES),
      nodes: [
        tsk(`${mocks} peer/online mock${mocks > 1 ? 's' : ''} (Pramp or a friend)`, 'Alternate interviewer/interviewee roles.'),
        tsk(`Keep solving — ~${qs} questions, timed`, 'Spend more time reviewing than solving.'),
        tsk('Record one mock and watch it back', 'Note filler words and where you go silent.'),
        tsk('Write down every question you fumbled', 'That list is your revision syllabus.'),
        nte('Nervous in mocks? Mock more, not less — exposure is the cure.',
          { label: 'Pramp (free mocks)', url: 'https://www.pramp.com/' }),
      ],
    };
  },

  apply: ({ company, pace }) => ({
    title: 'Resume & Apply', kicker: 'Get into the pipeline',
    goal: `Tailor everything to ${company?.role || 'the role'} before the deadline passes.`,
    resources: [],
    nodes: [
      tsk('Rewrite resume bullets: verb + scope + metric', 'Shipped X for N users, cut Y by Z%.'),
      tsk(`Mirror ${company?.name || 'the company'}’s job-description keywords`, 'ATS matches on exact phrasing more than synonyms.'),
      ...pick([
        tsk('Submit the application with a short referral note', 'One paragraph: role, one proof point, one link.'),
        tsk('Ask 2 people for a referral — 3 days before the deadline', 'Campus seniors and alumni work best.'),
        tsk('Track every application in the Deadline Tracker', 'Status updates keep the pipeline honest.'),
      ], pace),
      nte('Apply early: many drives close on a first-come basis, not a merit basis.'),
    ],
  }),

  behavioural: ({ company }) => ({
    title: 'Behavioural & HR', kicker: 'The human round',
    goal: `Prep the stories ${company?.name || 'the company'} actually asks for.`,
    resources: [],
    nodes: [
      tsk('Write 5 STAR stories: conflict, failure, deadline, initiative, teamwork', 'One page each — bullet points, not essays.'),
      tsk('Prepare “Why this company?” with a specific product detail', 'Generic praise reads as generic.'),
      tsk('Practise “Tell me about yourself” in 90 seconds', 'Present → past → why this role.'),
      tsk('Prepare 3 questions to ask the interviewer', 'About the team, the first 90 days, the stack.'),
      nte('Never badmouth a past employer — frame every failure as a lesson with a fix.'),
    ],
  }),

  revision: ({ company, pace }) => ({
    title: 'Review & Weak Spots', kicker: 'Sharpen before you swing',
    goal: 'Convert every mistake so far into a point you never miss again.',
    resources: collect([], DRILL_RES),
    nodes: [
      tsk('Re-solve every question you fumbled', 'Set a timer — if it’s easy now, it’s fixed.'),
      tsk('Refresh the cheat sheets you wrote in stage 1', 'Ten minutes each, the night before a round.'),
      ...pick([
        tsk('Re-read your own project README and defend each choice', 'You should be able to whiteboard it cold.'),
        tsk('Do one final timed mock at the same hour as your real interview', 'Train your body clock for that slot.'),
      ], pace),
      nte('Revision beats new material in the last week — no new topics 48 hours before a round.'),
    ],
  }),

  deepdive: ({ company }) => ({
    title: 'Company Deep-dive', kicker: 'Sound like you already work there',
    goal: `Know ${company?.name || 'the company'}’s products, rivals and engineering blog.`,
    resources: [],
    nodes: [
      tsk('Read the engineering blog and 2 recent post-mortems', 'Steal vocabulary and incident stories.'),
      tsk('List 3 competitors and how this company differs', 'Classic “what would you improve?” setup.'),
      tsk('Note one thing you would improve in their product', 'Specific, buildable, and tied to a metric.'),
      nte('“I used your product daily and here’s what broke for me” beats ten compliments.'),
    ],
  }),

  advanced: ({ stack, pace }) => ({
    title: 'Project, Production-Grade', kicker: 'Depth on your showcase piece',
    goal: 'Take the project from “demo” to “I’d deploy this on Monday”.',
    resources: collect(stack.slice(0, 2)),
    nodes: [
      tsk('Add CI: lint + tests on every push', 'One GitHub Actions workflow is enough.'),
      tsk('Handle errors, loading and empty states everywhere', 'Interviewers notice the boring parts.'),
      ...pick([
        tsk('Add auth or rate limiting', 'The feature that forces a design conversation.'),
        tsk('Measure something: logs, a dashboard, a perf budget', 'Numbers make your resume bullets credible.'),
      ], pace),
      nte('The difference between a tutorial clone and a portfolio piece is error handling and tests.'),
    ],
  }),

  aptitude: () => ({
    title: 'Aptitude & Verbal Round', kicker: 'Often the first filter',
    goal: 'Quant, logical reasoning and reading speed under time pressure.',
    resources: [],
    nodes: [
      tsk('Do 2 timed quant sets a day', 'Speed comes from pattern recognition, not formulas.'),
      tsk('Practise data interpretation tables and charts', 'Estimate first, calculate second.'),
      tsk('Read one opinion piece daily and summarise it in 3 lines', 'Feeds both verbal rounds and interviews.'),
      nte('Aptitude rounds are pass/fail gates — practise them like a skill, not like trivia.'),
    ],
  }),

  // Short-timeline variants (2 and 3 weeks) — same content, fused stages.
  fused_learn: ({ critical, nice, company, revision }) => {
    const skills = [...critical, ...nice].slice(0, 5);
    const list = skills.length ? skills : revision;
    return {
      title: 'Learn the Fundamentals', kicker: 'Core + stack in one pass',
      goal: `Compressed: learn the ${list.length} skills that matter for ${company?.name || 'the company'} before moving on.`,
      resources: collect(list),
      nodes: [
        ...list.flatMap((s) => [skl(s, company), tsk(`Learn the core concepts of ${s}`, 'Model, complexity, edge cases — explain each out loud.')]),
        nte('Two weeks leaves no room for re-learning: get it right the first time by writing code, not watching videos.'),
      ],
    };
  },

  fused_finish: ({ stack, company, pace }) => {
    const { qs, mocks } = DRILL[pace];
    return {
      title: 'Project & Interview Drill', kicker: 'Ship, then sell it',
      goal: `One public project plus ${qs}+ timed questions for ${company?.role || 'the role'}.`,
      resources: collect(stack.slice(0, 2), DRILL_RES),
      nodes: [
        tsk('Scaffold a public repo with a clear README', 'Name it, structure it, commit in small steps.'),
        tsk(`Implement the core feature using ${stack.slice(0, 3).join(', ') || 'your strongest stack'}`, 'One feature done properly beats five half-done.'),
        tsk('Deploy it or record a 2-minute demo GIF', 'A live link beats “it works on my machine”.'),
        tsk(`${mocks} timed coding mock${mocks > 1 ? 's' : ''} per week`, `~${qs} questions from LeetCode Top 150, fully clocked.`),
        tsk(`Research ${company?.name || 'the company'} and prep 5 STAR stories`, 'Own a failure, show the fix, name the metric.'),
        nte('In a 2-week sprint, apply as soon as the project is presentable — don’t wait for perfect.',
          { label: 'Tech Interview Handbook', url: 'https://www.techinterviewhandbook.org/' }),
      ],
    };
  },

  framework_project: ({ nice, stack, company, pace }) => {
    const skills = nice.length ? nice.slice(0, 4) : ['System Design', 'Linux'];
    return {
      title: 'Frameworks → Project', kicker: 'Learn, then use it',
      goal: `Pick up ${skills.join(', ')} and wire it into one public project.`,
      resources: collect([...skills, ...stack.slice(0, 2)]),
      nodes: [
        ...skills.flatMap((s) => [
          skl(s, company),
          tsk(`Complete one guided tutorial on ${s}`, 'Follow it end to end — no skipping steps.'),
        ]),
        tsk('Scaffold a public repo with a clear README', 'Name it, structure it, commit in small steps.'),
        tsk(`Build the core feature using ${skills[0]}`, 'Wire the new skill into a real feature, not a toy.'),
        ...pick([
          tsk('Add tests and one edge case you found yourself', 'The edge case is your best interview story.'),
          tsk('Deploy it or record a 2-minute demo GIF', 'A live link beats “it works on my machine”.'),
        ], pace),
        nte('Depth beats breadth: one framework understood beats three sampled.', { label: 'roadmap.sh skill maps', url: 'https://roadmap.sh/' }),
      ],
    };
  },
};

const EXTRAS = ['system', 'mocks', 'apply', 'behavioural', 'revision', 'deepdive', 'advanced', 'aptitude'];

// Timeline → stage list. 2w and 3w fuse stages; 4w is the classic plan; longer
// timelines insert extra stages before the final drill.
function pickOrder(weeks) {
  if (weeks <= 2) return ['fused_learn', 'fused_finish'];
  if (weeks === 3) return ['core', 'framework_project', 'drill'];
  if (weeks === 4) return ['core', 'frameworks', 'project', 'drill'];
  return ['core', 'frameworks', 'project', ...EXTRAS.slice(0, weeks - 4), 'drill'];
}

// Timeline-aware roadmap.sh-style plan.
// Returns { phases: [{ key, n, title, kicker, goal, resources, nodes }], total }
// Nodes: { id, type: 'skill'|'task'|'note', label/text, desc?, resources? } — the id
// is stable across timeline changes so "done" ticks survive switching weeks.
export function buildRoadmap({ critical = [], nice = [], company = null, profile = null, weeks = 4, hours = 8 }) {
  const pace = paceOf(hours);
  const stack = [...critical, ...nice];
  const revision = (profile?.skills || []).slice(0, 4);
  const ctx = { critical, nice, stack, company, pace, revision };
  const used = new Set();
  const phases = pickOrder(Number(weeks) || 4).map((key, i) => {
    const def = (PHASES[key] || PHASES.core)(ctx);
    const nodes = (def.nodes || []).map((n, j) => {
      const base = n.type === 'note' ? `note-${j}` : `${n.type === 'skill' ? 's' : 't'}-${slug(n.label)}`;
      let id = `${key}:${base}`, k = 2;
      while (used.has(id)) id = `${key}:${base}-${k++}`;
      used.add(id);
      return { ...n, id };
    });
    return { key, n: i + 1, ...def, nodes };
  });
  const total = phases.reduce((a, p) => a + p.nodes.filter((n) => n.type !== 'note').length, 0);
  return { phases, total };
}
