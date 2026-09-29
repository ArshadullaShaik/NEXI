// Company seed data lives in ./seedData.js (Admin demo dataset).
export { seedCompanies } from './seedData';
export const QUESTIONS = {
  tech: [
    { tag: 'DSA', category: 'DSA', difficulty: 'Medium', q: 'Find the longest substring without repeating characters.', hint: 'Sliding window plus a map of last-seen indices.', a: 'Keep window [l,r] and a map char→last index; on a repeat, move l to max(l, last+1). O(n) time, O(k) space.' },
    { tag: 'SQL', category: 'CS Fundamentals', difficulty: 'Easy', q: 'Write a query for the second-highest salary.', hint: 'Subquery with MAX, or DISTINCT + OFFSET.', a: 'SELECT MAX(salary) FROM Employee WHERE salary < (SELECT MAX(salary) FROM Employee); returns NULL if none, handles ties.' },
    { tag: 'React', category: 'CS Fundamentals', difficulty: 'Easy', q: 'Why does useEffect with an object dependency re-run every render?', hint: 'Reference equality, not value equality.', a: 'The object is recreated each render, so Object.is sees a new reference. Depend on primitives, useMemo it, or hoist it out.' },
    { tag: 'Java', category: 'CS Fundamentals', difficulty: 'Medium', q: 'How does HashMap handle collisions? What changed in Java 8?', hint: 'Buckets, chains, a threshold.', a: 'Colliding keys chain in a bucket; Java 8 treeifies buckets past 8 entries (table ≥ 64), improving worst-case lookup from O(n) to O(log n).' },
    { tag: 'Python', category: 'CS Fundamentals', difficulty: 'Easy', q: 'List vs generator: when do you prefer a generator?', hint: 'Memory and laziness.', a: 'A list materialises everything; a generator yields lazily in O(1) memory, single pass. Use for large or streaming data.' },
    { tag: 'C++', category: 'CS Fundamentals', difficulty: 'Medium', q: 'Explain RAII and why it matters for exception safety.', hint: 'Resource lifetime tied to object lifetime.', a: 'Acquire in constructors, release in destructors; stack unwinding guarantees cleanup on exceptions. Basis of unique_ptr and lock_guard.' },
    { tag: 'AWS', category: 'System Design', difficulty: 'Hard', q: 'S3 vs EBS vs EFS: when do you use each?', hint: 'Object vs block vs shared file system.', a: 'S3: durable object storage. EBS: block volume for one EC2 instance. EFS: managed NFS shared across instances.' },
    { tag: 'Machine Learning', category: 'CS Fundamentals', difficulty: 'Hard', q: 'How do you detect and handle overfitting?', hint: 'Compare train vs validation error.', a: 'A large train/validation gap signals it. Fix with more data, regularisation, dropout, early stopping, simpler models, cross-validation.' },
  ],
  system: [
    { category: 'System Design', difficulty: 'Hard', q: 'Design a URL shortener.', hint: 'Start with read/write ratio and ID generation.', a: 'Base62-encode a unique ID; KV store key→URL; cache hot keys; read-heavy so replicas + CDN; decide 301 vs 302; handle expiry and abuse.' },
    { category: 'System Design', difficulty: 'Hard', q: 'Design an API rate limiter.', hint: 'Token bucket vs sliding window.', a: 'Token bucket per key in Redis via atomic Lua script; return 429 + Retry-After; discuss clock skew, per-tier limits, failure mode (fail open vs closed).' },
    { category: 'System Design', difficulty: 'Hard', q: 'Design a notification service.', hint: 'Decouple producers from delivery.', a: 'Queue (Kafka/SQS) → per-channel workers; idempotency keys, retries with backoff, dead-letter queue, user preferences, templating.' },
  ],
  hr: [
    { category: 'Behavioral', difficulty: 'Easy', q: 'Tell me about a time you failed.', hint: 'STAR format; own it; show what changed.', a: 'Brief situation; YOUR specific mistake (not the team’s); the fix; a measurable result and the process you changed afterwards.' },
    { category: 'Behavioral', difficulty: 'Easy', q: 'Why this company and this role?', hint: 'Be specific to product and team.', a: 'Tie 1–2 concrete facts about their engineering or product to your projects and skills. Avoid generic praise and compensation.' },
    { category: 'Behavioral', difficulty: 'Medium', q: 'Where do you see yourself in 3 years?', hint: 'Growth in depth, not title.', a: 'Show ambition tied to skill: owning a system, mentoring, widening domain; consistent with what this role realistically offers.' },
  ],
};
