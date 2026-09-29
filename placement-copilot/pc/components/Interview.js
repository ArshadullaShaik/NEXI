'use client';

import { useState, useEffect, useCallback } from 'react';
import { useApp } from '@/context/AppContext';
import { QUESTIONS } from '@/lib/mockData';
import { Card, Title, Badge, Empty, inp } from './ui';
import { Lightbulb, Eye, Timer, Clock, Check } from 'lucide-react';

export default function Interview() {
  const { companies } = useApp();
  const [id, setId] = useState('');
  const [open, setOpen] = useState({});
  const [practiceMode, setPracticeMode] = useState(false);
  const [timer, setTimer] = useState(0);

  if (!companies.length) {
    return (
      <><Title t="Mock Interview Prep" s="" /><Card><Empty text="Add a company first in Admin Data Feed." /></Card></>
    );
  }

  const c = companies.find((x) => x.id === id) || companies[0];
  const role = c.role;

  // Collect all questions from all categories, filtered by company skills
  const allQuestions = [
    ...QUESTIONS.tech,
    ...QUESTIONS.system,
    ...QUESTIONS.hr,
  ].filter((q) => c.skills.includes(q.tag));

  // If practice mode is active, start a timer when first entering practice mode
  useEffect(() => {
    if (practiceMode) {
      const timerId = setTimeout(() => {
        setTimer((t) => t + 1);
      }, 5000); // 5 second "thinking timer"
      return () => clearTimeout(timerId);
    }
  }, [practiceMode]);

  // Convert tag to category name
  const getCategoryName = (tag) => {
    const mapping = {
      DSA: 'DSA',
      SQL: 'CS Fundamentals',
      React: 'CS Fundamentals',
      Java: 'CS Fundamentals',
      Python: 'CS Fundamentals',
      'C++': 'CS Fundamentals',
      AWS: 'System Design',
      MachineLearning: 'CS Fundamentals',
    };
    return mapping[tag] || 'CS Fundamentals';
  };

  // Convert difficulty to badge color
  const getDifficultyColor = (difficulty) => {
    switch (difficulty) {
      case 'Easy': return 'green';
      case 'Medium': return 'amber';
      case 'Hard': return 'red';
      default: return 'slate';
    }
  };

  return (
    <>
      <Title
        t="Mock Interview Prep"
        s="Attempt each question out loud before revealing anything. Peeking early is how you fail live."
      />
      <Card className="p-5 mb-6 flex flex-wrap items-center gap-3">
        <select
          className={inp + ' max-w-xs'}
          value={c.id}
          onChange={(e) => {
            setId(e.target.value);
            setOpen({});
            setPracticeMode(false);
            setTimer(0);
          }}
        >
          {companies.map((x) => (
            <option key={x.id} value={x.id}>
              {x.name} - {role}</option>
          ))}
        </select>
        <span className="text-sm text-slate-500">
          Role: <b className="text-slate-800">{role}</b>
        </span>
      </Card>

      {/* Practice Mode Toggle */}
      <Card className="p-4 mb-6 rounded-xl bg-gradient-to-r from-indigo-50 to-violet-50">
        <div className="flex items-center gap-3">
          <input
            type="checkbox"
            checked={practiceMode}
            onChange={(e) => setPracticeMode(e.target.checked)}
            className="rounded border-indigo-600 w-4 h-4 focus:ring-indigo-500"
          />
          <span className="text-sm text-slate-700">
            Practice Mode{' '}
            <Badge tone="indigo">{practiceMode ? 'ON' : 'OFF'}</Badge>
          </span>
          {practiceMode && (
            <span className="text-xs text-amber-600">
              Timer: {timer}s remaining
            </span>
          )}
        </div>
      </Card>

      <div className="space-y-6">
        {/* Tech / DSA Section */}
        <section>
          <h2 className="font-medium mb-3 text-indigo-600">
            Technical / DSA{' '}
            <Badge tone="indigo">DSA</Badge>
          </h2>
          <div className="space-y-4">
            {allQuestions
              .filter((q) => q.category === 'DSA')
              .map((q, i) => (
                <QuestionCard
                  key={q.q}
                  question={q}
                  isPracticeMode={practiceMode}
                  onToggle={setOpen}
                  timer={timer}
                  setTimer={setTimer}
                />
              ))}
          </div>
        </section>

        {/* System Design Section */}
        <section>
          <h2 className="font-medium mb-3 text-orange-600">
            System Design{' '}
            <Badge tone="orange">System Design</Badge>
          </h2>
          <div className="space-y-4">
            {allQuestions
              .filter((q) => q.category === 'System Design')
              .map((q, i) => (
                <QuestionCard
                  key={q.q}
                  question={q}
                  isPracticeMode={practiceMode}
                  onToggle={setOpen}
                  timer={timer}
                  setTimer={setTimer}
                />
              ))}
          </div>
        </section>

        {/* HR / Behavioral Section */}
        <section>
          <h2 className="font-medium mb-3 text-emerald-600">
            Behavioral{' '}
            <Badge tone="emerald">Behavioral</Badge>
          </h2>
          <div className="space-y-4">
            {allQuestions
              .filter((q) => q.category === 'Behavioral')
              .map((q, i) => (
                <QuestionCard
                  key={q.q}
                  question={q}
                  isPracticeMode={practiceMode}
                  onToggle={setOpen}
                  timer={timer}
                  setTimer={setTimer}
                />
              ))}
          </div>
        </section>
      </div>
    </>
  );
}

/** ************ QuestionCard Component ************ */
function QuestionCard({
  question,
  isPracticeMode,
  onToggle,
  timer,
  setTimer,
}) {
  const [expandedHint, setExpandedHint] = useState(false);
  const [expandedAnswer, setExpandedAnswer] = useState(false);

  // In practice mode, answer is hidden until timer expires or user reveals it
  const shouldShowAnswer = !isPracticeMode || timer >= 5;

  return (
    <Card key={question.q} className="p-4">
      <div className="flex flex-col gap-3">
        {/* Question header with tags */}
        <div className="flex items-start gap-2">
          {/* Category tag */}
          <Badge tone={{
            DSA: 'indigo',
            'System Design': 'orange',
            Behavioral: 'emerald',
            'CS Fundamentals': 'blue',
          }[question.category] || 'slate'}>
            {question.category}
          </Badge>

          {/* Difficulty badge */}
          <Badge tone={{
            Easy: 'green',
            Medium: 'amber',
            Hard: 'red',
          }[question.difficulty] || 'slate'}>
            {question.difficulty}
          </Badge>
        </div>

        {/* Question text */}
        <p className="text-sm font-medium text-slate-800">{question.q}</p>

        {/* Key Concepts / Hint expandable section */}
        <details
          onClick={(e) => e.stopPropagation()}
          className="cursor-pointer"
        >
          <summary>
            <div className="flex items-center justify-between">
              <span className="text-sm text-amber-600 font-medium">
                Key Concepts / Hint
              </span>
              <Lightbulb size={16} />
            </div>
          </summary>
          {expandedHint && (
            <p className="mt-2 text-sm text-amber-800 bg-amber-50 rounded-lg p-3">
              {question.hint}
            </p>
          )}
        </details>

        {/* Sample Ideal Answer / Approach expandable section */}
        <details
          onClick={(e) => e.stopPropagation()}
          className="cursor-pointer mt-3"
        >
          <summary>
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-600 font-medium">
                Sample Ideal Answer / Approach
              </span>
              <Eye size={16} />
            </div>
          </summary>
          {shouldShowAnswer && (
            <p className="mt-2 text-sm text-slate-700 bg-slate-50 rounded-lg p-3">
              {question.a}
            </p>
          )}
        </details>
      </div>
    </Card>
  );
}
