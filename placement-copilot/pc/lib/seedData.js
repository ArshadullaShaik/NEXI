// Admin demo dataset — the single source of truth for "Reset to Demo Data".
// Deadlines are generated relative to call time so the demo always shows live
// urgency (red/yellow/green) instead of instantly-expired dates.
const HOUR = 36e5;
const at = (hoursFromNow) => new Date(Date.now() + hoursFromNow * HOUR).toISOString();

// Skill names intentionally use the resume parser's vocabulary (lib/logic.js SKILLS)
// so skill matching works out of the box — e.g. "Node.js", not "NodeJS".
export const seedCompanies = () => [
  { id: 'seed-google', name: 'Google', role: 'SDE Intern', minCgpa: 8.5, branches: ['CSE', 'IT'], skills: ['C++', 'DSA', 'System Design', 'Python'], deadline: at(22) },
  { id: 'seed-microsoft', name: 'Microsoft', role: 'Software Engineer', minCgpa: 8.0, branches: ['CSE', 'IT', 'ECE'], skills: ['C++', 'DSA', 'System Design', 'Git'], deadline: at(46) },
  { id: 'seed-adobe', name: 'Adobe', role: 'Member of Technical Staff', minCgpa: 8.0, branches: ['CSE', 'IT'], skills: ['C++', 'DSA', 'JavaScript', 'System Design'], deadline: at(74) },
  { id: 'seed-amazon', name: 'Amazon', role: 'SDE-1', minCgpa: 7.5, branches: ['CSE', 'IT', 'ECE'], skills: ['Java', 'DSA', 'AWS', 'SQL'], deadline: at(120) },
  { id: 'seed-flipkart', name: 'Flipkart', role: 'Software Development Engineer', minCgpa: 7.5, branches: ['CSE', 'IT', 'ECE'], skills: ['Java', 'DSA', 'SQL', 'MongoDB'], deadline: at(168) },
  { id: 'seed-razorpay', name: 'Razorpay', role: 'Frontend Engineer', minCgpa: 7.0, branches: ['CSE', 'IT'], skills: ['React', 'JavaScript', 'TypeScript', 'Node.js'], deadline: at(240) },
  { id: 'seed-accenture', name: 'Accenture', role: 'Associate Software Engineer', minCgpa: 6.5, branches: ['Any'], skills: ['Java', 'Python', 'SQL', 'Git'], deadline: at(360) },
  { id: 'seed-infosys', name: 'Infosys', role: 'Systems Engineer', minCgpa: 6.5, branches: ['Any'], skills: ['Java', 'SQL', 'Linux'], deadline: at(480) },
  { id: 'seed-tcs', name: 'TCS', role: 'Assistant System Engineer', minCgpa: 6.0, branches: ['Any'], skills: ['Java', 'SQL', 'Git'], deadline: at(600) },
  { id: 'seed-wipro', name: 'Wipro', role: 'Project Engineer', minCgpa: 6.0, branches: ['Any'], skills: ['Python', 'SQL', 'Git'], deadline: at(720) },
];
