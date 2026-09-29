'use client';

import { useState, useEffect, useCallback } from 'react';
import { useApp } from '@/context/AppContext';
import { Card, Title, Badge, Empty, inp } from './ui';
import { Lightbulb, Eye, Timer, Clock, Check, Mic, MicOff, Send, RefreshCw, BarChart3, AlertTriangle, TrendingUp } from 'lucide-react';

const API = 'http://localhost:3001';

export default function Interview() {
  const { companies, profile } = useApp();
  const [id, setId] = useState('');
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [answers, setAnswers] = useState({});
  const [evaluations, setEvaluations] = useState({});
  const [summary, setSummary] = useState(null);
  const [recording, setRecording] = useState(null);
  const [practiceMode, setPracticeMode] = useState(false);
  const [timer, setTimer] = useState(0);
  const [mode, setMode] = useState('baseline');

  const c = companies.find((x) => x.id === id) || companies[0];

  // Build student profile from AppContext profile or use defaults
  const student = profile || {
    name: 'Student',
    branch: 'CSE',
    year: 3,
    cgpa: 7.5,
    backlogs: 0,
    skills: c?.skills || [],
    projects: [],
    skillGaps: [],
  };

  // Map frontend company to backend company format
  const company = c ? {
    name: c.name,
    role: c.role,
    package: 'N/A',
    rounds: ['Aptitude', 'Technical', 'HR'],
    requiredSkills: c.skills || [],
  } : null;

  const generateQuestions = async () => {
    if (!c) return;
    setLoading(true);
    setError('');
    setSummary(null);
    setEvaluations({});
    setAnswers({});
    try {
      const res = await fetch(`${API}/api/mock/questions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode,
          student,
          company,
          count: 5,
          useSearch: false,
        }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setQuestions(data);
    } catch (e) {
      setError(e.message || 'Failed to generate questions. Is the backend running?');
    } finally {
      setLoading(false);
    }
  };

  const evaluateAnswer = async (question, answerText) => {
    if (!answerText?.trim()) return;
    try {
      const res = await fetch(`${API}/api/mock/evaluate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question, textAnswer: answerText }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setEvaluations((prev) => ({ ...prev, [question.question]: data }));
      return data;
    } catch (e) {
      console.error('Evaluate error:', e);
    }
  };

  const generateSummary = async () => {
    const allAnswers = Object.values(evaluations);
    if (!allAnswers.length) return;
    try {
      const res = await fetch(`${API}/api/mock/summary`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answers: allAnswers }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setSummary(data);
    } catch (e) {
      console.error('Summary error:', e);
    }
  };

  // Auto-generate questions when company changes
  useEffect(() => {
    if (c && questions.length === 0) {
      generateQuestions();
    }
  }, [c?.id]);

  // Practice mode timer
  useEffect(() => {
    if (practiceMode) {
      const timerId = setTimeout(() => {
        setTimer((t) => t + 1);
      }, 5000);
      return () => clearTimeout(timerId);
    }
  }, [practiceMode]);

  if (!companies.length) {
    return (
      <><Title t="Mock Interview Prep" s="" /><Card><Empty text="Add a company first in Admin Data Feed." /></Card></>
    );
  }

  return (
    <>
      <Title
        t="Mock Interview Prep"
        s="AI-powered mock interviews tailored to your target company. Answer out loud or type your response."
      />

      {/* Controls */}
      <Card className="p-5 mb-6 flex flex-wrap items-center gap-3">
        <select
          className={inp + ' max-w-xs'}
          value={c.id}
          onChange={(e) => {
            setId(e.target.value);
            setQuestions([]);
            setSummary(null);
            setEvaluations({});
            setAnswers({});
          }}
        >
          {companies.map((x) => (
            <option key={x.id} value={x.id}>
              {x.name} - {x.role}
            </option>
          ))}
        </select>
        <span className="text-sm text-slate-500">
          Role: <b className="text-slate-800">{c.role}</b>
        </span>
        <div className="flex items-center gap-2 ml-auto">
          <select
            className={inp + ' max-w-[140px]'}
            value={mode}
            onChange={(e) => setMode(e.target.value)}
          >
            <option value="baseline">Baseline</option>
            <option value="final">Final</option>
          </select>
          <button
            onClick={generateQuestions}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            {loading ? 'Generating...' : 'New Questions'}
          </button>
        </div>
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

      {/* Error */}
      {error && (
        <Card className="p-4 mb-6 border-red-200 bg-red-50">
          <div className="flex items-center gap-2 text-red-700">
            <AlertTriangle size={16} />
            <span className="text-sm">{error}</span>
          </div>
        </Card>
      )}

      {/* Loading */}
      {loading && (
        <Card className="p-8 mb-6 text-center">
          <div className="animate-pulse space-y-3">
            <div className="h-4 bg-slate-200 rounded w-3/4 mx-auto"></div>
            <div className="h-4 bg-slate-200 rounded w-1/2 mx-auto"></div>
            <div className="h-4 bg-slate-200 rounded w-2/3 mx-auto"></div>
          </div>
          <p className="text-sm text-slate-500 mt-4">Generating personalized questions...</p>
        </Card>
      )}

      {/* Questions */}
      {!loading && questions.length > 0 && (
        <div className="space-y-6">
          {questions.map((q, i) => (
            <QuestionCard
              key={q.question}
              question={q}
              index={i}
              answer={answers[q.question] || ''}
              evaluation={evaluations[q.question]}
              isPracticeMode={practiceMode}
              timer={timer}
              onAnswerChange={(text) => setAnswers((prev) => ({ ...prev, [q.question]: text }))}
              onEvaluate={() => evaluateAnswer(q, answers[q.question])}
            />
          ))}
        </div>
      )}

      {/* Summary Section */}
      {!loading && Object.keys(evaluations).length > 0 && (
        <Card className="p-5 mt-8">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-slate-800 flex items-center gap-2">
              <BarChart3 size={18} className="text-indigo-600" />
              Interview Summary
            </h3>
            <button
              onClick={generateSummary}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 transition-colors"
            >
              <TrendingUp size={14} />
              Generate Summary
            </button>
          </div>

          {summary ? (
            <div className="space-y-4">
              {/* Overall Score */}
              <div className="flex items-center gap-4">
                <div className="text-center">
                  <div className="text-3xl font-bold text-indigo-600">{summary.overall}</div>
                  <div className="text-xs text-slate-500">Overall</div>
                </div>
                <div className="flex-1 grid grid-cols-3 gap-3">
                  <ScorePill label="Correctness" value={summary.correctness} />
                  <ScorePill label="Depth" value={summary.depth} />
                  <ScorePill label="Communication" value={summary.communication} />
                </div>
              </div>

              {/* Topic Scores */}
              {summary.topicScores && Object.keys(summary.topicScores).length > 0 && (
                <div>
                  <h4 className="text-sm font-medium text-slate-700 mb-2">Topic Breakdown</h4>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(summary.topicScores).map(([topic, score]) => (
                      <Badge key={topic} tone={score >= 4 ? 'green' : score >= 3 ? 'amber' : 'red'}>
                        {topic}: {score}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* Weak Topics */}
              {summary.weakTopics?.length > 0 && (
                <div className="p-3 bg-amber-50 rounded-lg">
                  <h4 className="text-sm font-medium text-amber-800 mb-1">Weak Topics to Improve</h4>
                  <div className="flex flex-wrap gap-2">
                    {summary.weakTopics.map((t) => (
                      <Badge key={t} tone="amber">{t}</Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <p className="text-sm text-slate-500">Answer some questions and click "Generate Summary" to see your readiness report.</p>
          )}
        </Card>
      )}
    </>
  );
}

/** ************ QuestionCard Component ************ */
function QuestionCard({
  question,
  index,
  answer,
  evaluation,
  isPracticeMode,
  timer,
  onAnswerChange,
  onEvaluate,
}) {
  const [expandedHint, setExpandedHint] = useState(false);
  const [expandedAnswer, setExpandedAnswer] = useState(false);
  const [isRecording, setIsRecording] = useState(false);

  const shouldShowAnswer = !isPracticeMode || timer >= 5;

  const getDifficultyColor = (difficulty) => {
    if (difficulty <= 2) return 'green';
    if (difficulty <= 3) return 'amber';
    return 'red';
  };

  const getSourceColor = (source) => {
    switch (source) {
      case 'resume': return 'blue';
      case 'campus': return 'purple';
      case 'gap': return 'orange';
      case 'role': return 'indigo';
      default: return 'slate';
    }
  };

  return (
    <Card className="p-4">
      <div className="flex flex-col gap-3">
        {/* Question header */}
        <div className="flex items-start gap-2 flex-wrap">
          <Badge tone="slate">Q{index + 1}</Badge>
          <Badge tone={getDifficultyColor(question.difficulty)}>
            {question.difficulty <= 2 ? 'Easy' : question.difficulty <= 3 ? 'Medium' : 'Hard'}
          </Badge>
          <Badge tone={getSourceColor(question.source)}>
            {question.source}
          </Badge>
          <Badge tone="slate">{question.topic}</Badge>
        </div>

        {/* Question text */}
        <p className="text-sm font-medium text-slate-800">{question.question}</p>

        {/* Ideal Points / Hint */}
        <details
          onClick={(e) => e.stopPropagation()}
          className="cursor-pointer"
        >
          <summary>
            <div className="flex items-center justify-between">
              <span className="text-sm text-amber-600 font-medium">
                Key Concepts / Ideal Points
              </span>
              <Lightbulb size={16} />
            </div>
          </summary>
          {expandedHint && (
            <div className="mt-2 text-sm text-amber-800 bg-amber-50 rounded-lg p-3">
              <ul className="list-disc list-inside space-y-1">
                {(question.idealPoints || []).map((point, i) => (
                  <li key={i}>{point}</li>
                ))}
              </ul>
            </div>
          )}
        </details>

        {/* Answer Input */}
        <div className="space-y-2">
          <label className="text-sm text-slate-600 font-medium">Your Answer</label>
          <textarea
            className={inp + ' w-full h-24 resize-none'}
            placeholder="Type your answer here (or use voice recording)..."
            value={answer}
            onChange={(e) => onAnswerChange(e.target.value)}
          />
          <div className="flex items-center gap-2">
            <button
              onClick={onEvaluate}
              disabled={!answer.trim()}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <Send size={14} />
              Submit Answer
            </button>
          </div>
        </div>

        {/* Evaluation Result */}
        {evaluation && (
          <div className="border-t pt-3 space-y-3">
            {/* Scores */}
            <div className="flex items-center gap-3 flex-wrap">
              <ScorePill label="Correctness" value={evaluation.correctness} />
              <ScorePill label="Depth" value={evaluation.depth} />
              <ScorePill label="Communication" value={evaluation.communication} />
            </div>

            {/* Transcript (if voice) */}
            {evaluation.transcript && (
              <div className="p-3 bg-slate-50 rounded-lg">
                <span className="text-xs font-medium text-slate-500 uppercase">Transcript</span>
                <p className="text-sm text-slate-700 mt-1">{evaluation.transcript}</p>
              </div>
            )}

            {/* Feedback */}
            {evaluation.feedback && (
              <div className="p-3 bg-blue-50 rounded-lg">
                <span className="text-xs font-medium text-blue-600 uppercase">Feedback</span>
                <p className="text-sm text-blue-800 mt-1">{evaluation.feedback}</p>
              </div>
            )}

            {/* Missed Points */}
            {evaluation.missed?.length > 0 && (
              <div className="p-3 bg-red-50 rounded-lg">
                <span className="text-xs font-medium text-red-600 uppercase">Missed Points</span>
                <ul className="list-disc list-inside text-sm text-red-800 mt-1 space-y-1">
                  {evaluation.missed.map((m, i) => (
                    <li key={i}>{m}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Model Answer */}
            {evaluation.modelAnswer && (
              <details className="cursor-pointer">
                <summary className="text-sm text-slate-600 font-medium flex items-center gap-2">
                  <Eye size={14} />
                  Model Answer
                </summary>
                <p className="mt-2 text-sm text-slate-700 bg-slate-50 rounded-lg p-3">
                  {evaluation.modelAnswer}
                </p>
              </details>
            )}

            {/* Follow-up */}
            {evaluation.followUp && (
              <div className="p-3 bg-purple-50 rounded-lg">
                <span className="text-xs font-medium text-purple-600 uppercase">Follow-up Question</span>
                <p className="text-sm text-purple-800 mt-1">{evaluation.followUp}</p>
              </div>
            )}
          </div>
        )}
      </div>
    </Card>
  );
}

/** ************ ScorePill Component ************ */
function ScorePill({ label, value }) {
  const color = value >= 4 ? 'green' : value >= 3 ? 'amber' : 'red';
  return (
    <div className="text-center">
      <Badge tone={color}>{value}/5</Badge>
      <div className="text-xs text-slate-500 mt-1">{label}</div>
    </div>
  );
}
