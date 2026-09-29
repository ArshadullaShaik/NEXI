'use client';

import { useState, useEffect, useRef } from 'react';
import { useApp } from '@/context/AppContext';
import { Card, Title, Badge, NoCompanies, inp } from './ui';
import { Mic, MicOff, Send, RefreshCw, BarChart3, AlertTriangle, TrendingUp, Volume2, ChevronRight, Building2 } from 'lucide-react';

// The mock-interview backend is a separate Node process (`npm run backend`), so it has its
// own port and its own deployment. Hardcoding localhost made this tab silently useless
// anywhere else — a phone on the same wifi, or any deployed build. Override per environment.
const API = (process.env.NEXT_PUBLIC_INTERVIEW_API || 'http://localhost:3001').replace(/\/$/, '');

// speechSynthesis is not universal (it is absent on some Android WebViews and in headless
// browsers), and a bare `speechSynthesis.cancel()` there is a TypeError, not a no-op.
const tts = typeof window !== 'undefined' ? window.speechSynthesis : null;

export default function Interview() {
  const { companies, profile } = useApp();
  const [id, setId] = useState('');
  const [questions, setQuestions] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [answers, setAnswers] = useState([]);
  const [currentEval, setCurrentEval] = useState(null);
  const [summary, setSummary] = useState(null);
  const [mode, setMode] = useState('baseline');
  const [baselineSummary, setBaselineSummary] = useState(null);
  const [showReport, setShowReport] = useState(false);
  const [recording, setRecording] = useState(false);
  const [evaluating, setEvaluating] = useState(false);
  const [followupMode, setFollowupMode] = useState(false);
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);

  const c = companies.find((x) => x.id === id) || companies[0];

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

  const company = c ? {
    name: c.name,
    role: c.role,
    package: 'N/A',
    rounds: ['Aptitude', 'Technical', 'HR'],
    requiredSkills: c.skills || [],
  } : null;

  // Load baseline from localStorage.
  // try/catch matters here: this runs inside an effect, so one corrupt value throws with no
  // error boundary above it and the whole app white-screens. Dropping the bad value and
  // carrying on is strictly better than a dead page.
  useEffect(() => {
    try {
      const saved = localStorage.getItem('baselineSummary');
      if (!saved) return;
      const parsed = JSON.parse(saved);
      if (!parsed || typeof parsed !== 'object') throw new Error('unexpected shape');
      setBaselineSummary(parsed);
      setMode('final');
    } catch {
      try { localStorage.removeItem('baselineSummary'); } catch { /* ignore */ }
    }
  }, []);

  const generateQuestions = async () => {
    if (!c) return;
    setLoading(true);
    setError('');
    setAnswers([]);
    setCurrentIndex(0);
    setCurrentEval(null);
    setSummary(null);
    setShowReport(false);
    setFollowupMode(false);
    try {
      const res = await fetch(`${API}/api/mock/questions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode, student, company, baseline: baselineSummary, count: 5, useSearch: false }),
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

  const speakQuestion = (text) => {
    if (!text || !tts || typeof SpeechSynthesisUtterance === 'undefined') return;
    tts.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.rate = 0.95;
    tts.speak(u);
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      mediaRecorderRef.current = mr;
      chunksRef.current = [];
      mr.ondataavailable = (e) => chunksRef.current.push(e.data);
      mr.onstop = async () => {
        const blob = new Blob(chunksRef.current, { type: mr.mimeType });
        stream.getTracks().forEach((t) => t.stop());
        await sendForEvaluation(blob);
      };
      mr.start();
      setRecording(true);
    } catch {
      setError('Microphone blocked. Please allow microphone access and try again.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && recording) {
      mediaRecorderRef.current.stop();
      setRecording(false);
    }
  };

  const sendForEvaluation = async (blob) => {
    setEvaluating(true);
    setError('');
    try {
      const base64 = await blobToBase64(blob);
      const mimeType = blob.type.split(';')[0];
      const q = followupMode
        ? { question: currentEval.followUp, topic: currentEval.weakTopic, idealPoints: [] }
        : questions[currentIndex];
      const res = await fetch(`${API}/api/mock/evaluate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: q, audioBase64: base64, mimeType }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      if (followupMode) {
        setAnswers((prev) => [...prev, { ...data, question: currentEval.followUp, topic: currentEval.weakTopic }]);
        setFollowupMode(false);
      } else {
        setAnswers((prev) => [...prev, { ...data, question: q.question, topic: q.topic }]);
      }
      setCurrentEval(data);
    } catch (e) {
      setError(e.message || 'Evaluation failed.');
    } finally {
      setEvaluating(false);
    }
  };

  const blobToBase64 = (blob) =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result.split(',')[1]);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });

  const nextQuestion = () => {
    setCurrentEval(null);
    setFollowupMode(false);
    if (currentIndex < questions.length - 1) {
      setCurrentIndex((i) => i + 1);
    } else {
      generateSummary();
    }
  };

  const generateSummary = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API}/api/mock/summary`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answers, baselineSummary: mode === 'final' ? baselineSummary : null }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      if (mode === 'baseline') {
        localStorage.setItem('baselineSummary', JSON.stringify(data));
        setBaselineSummary(data);
      }
      setSummary(data);
      setShowReport(true);
    } catch (e) {
      setError(e.message || 'Failed to generate summary.');
    } finally {
      setLoading(false);
    }
  };

  const resetInterview = () => {
    setShowReport(false);
    setSummary(null);
    setAnswers([]);
    setCurrentIndex(0);
    setCurrentEval(null);
    setMode('baseline');
    setFollowupMode(false);
    tts?.cancel();
  };

  if (!companies.length) {
    return (
      <>
        <Title t="Mock Interview Prep" s="" />
        <NoCompanies what="a mock interview" icon={Building2} />
      </>
    );
  }

  // Report view
  if (showReport && summary) {
    return (
      <>
        <Title t="Interview Report" s="Your readiness summary for this mock round." />
        <Card className="p-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <ReportItem label="Overall" value={summary.overall} />
            <ReportItem label="Correctness" value={summary.correctness} />
            <ReportItem label="Depth" value={summary.depth} />
            <ReportItem label="Communication" value={summary.communication} />
          </div>

          {summary.topicScores && Object.keys(summary.topicScores).length > 0 && (
            <div className="mb-4">
              <h3 className="text-sm font-medium text-slate-700 mb-2">Topic Scores</h3>
              <div className="flex flex-wrap gap-2">
                {Object.entries(summary.topicScores).map(([topic, score]) => (
                  <Badge key={topic} tone={score >= 4 ? 'green' : score >= 3 ? 'amber' : 'red'}>
                    {topic}: {score}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {summary.weakTopics?.length > 0 && (
            <div className="p-3 bg-amber-50 rounded-lg mb-4">
              <h3 className="text-sm font-medium text-amber-800 mb-1">Weak Topics</h3>
              <div className="flex flex-wrap gap-2">
                {summary.weakTopics.map((t) => <Badge key={t} tone="amber">{t}</Badge>)}
              </div>
            </div>
          )}

          {mode === 'final' && summary.delta !== undefined && (
            <div className={`p-4 rounded-lg mb-4 ${summary.delta >= 0 ? 'bg-emerald-50' : 'bg-red-50'}`}>
              <h3 className="text-sm font-medium mb-1">
                Improvement from baseline: {summary.delta >= 0 ? '+' : ''}{summary.delta} points
              </h3>
              {summary.topicDeltas && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {Object.entries(summary.topicDeltas).map(([t, d]) => (
                    <Badge key={t} tone={d >= 0 ? 'green' : 'red'}>{t}: {d >= 0 ? '+' : ''}{d}</Badge>
                  ))}
                </div>
              )}
              {summary.stillWeak?.length > 0 && (
                <p className="text-sm mt-2 text-slate-600">Still weak: {summary.stillWeak.join(', ')}</p>
              )}
            </div>
          )}

          <p className="text-xs text-slate-500 italic mb-4">Weak topics should feed the roadmap generator for focused preparation.</p>
          <button onClick={resetInterview} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors">
            <RefreshCw size={14} /> Start New Interview
          </button>
        </Card>
      </>
    );
  }

  const q = questions[currentIndex];

  return (
    <>
      <Title t="Voice Mock Interview" s="AI-powered spoken mock interviews tailored to your target company." />

      {/* Controls */}
      <Card className="p-5 mb-6">
        <div className="flex flex-wrap items-center gap-3">
          <select
            className={inp + ' max-w-xs'}
            value={c.id}
            onChange={(e) => { setId(e.target.value); setQuestions([]); setShowReport(false); }}
          >
            {companies.map((x) => (
              <option key={x.id} value={x.id}>{x.name} - {x.role}</option>
            ))}
          </select>
          <span className="text-sm text-slate-500">Role: <b className="text-slate-800">{c.role}</b></span>
          <div className="flex items-center gap-2 ml-auto">
            <select
              className={inp + ' max-w-[160px]'}
              value={mode}
              onChange={(e) => setMode(e.target.value)}
            >
              {/* "Final" is only meaningful after a baseline run. The guard lives on the
                  <option> below — a previous version also put a `disabled={… e.target.value …}`
                  on this <select>, where `e` is out of scope. That threw a ReferenceError on
                  every render, and with no error boundary above it the entire app went blank
                  the moment this tab was opened. */}
              <option value="baseline">Baseline (start of prep)</option>
              <option value="final" disabled={!baselineSummary}>Final (day before)</option>
            </select>
            <button
              onClick={generateQuestions}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors"
            >
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
              {loading ? 'Generating...' : 'Start Interview'}
            </button>
          </div>
        </div>
        {mode === 'final' && baselineSummary && (
          <p className="text-xs text-slate-500 mt-2">Final mode: focusing on your weak topics from baseline.</p>
        )}
      </Card>

      {error && (
        <Card className="p-4 mb-6 border-red-200 bg-red-50">
          <div className="flex items-center gap-2 text-red-700">
            <AlertTriangle size={16} /><span className="text-sm">{error}</span>
          </div>
        </Card>
      )}

      {loading && (
        <Card className="p-8 mb-6 text-center">
          <div className="animate-pulse space-y-3">
            <div className="h-4 bg-slate-200 rounded w-3/4 mx-auto"></div>
            <div className="h-4 bg-slate-200 rounded w-1/2 mx-auto"></div>
          </div>
          <p className="text-sm text-slate-500 mt-4">Generating personalized questions...</p>
        </Card>
      )}

      {/* Question Card */}
      {!loading && q && (
        <Card className="p-6">
          <div className="flex items-start gap-2 flex-wrap mb-3">
            <Badge tone="slate">Question {currentIndex + 1} of {questions.length}</Badge>
            <Badge tone="indigo">{q.topic}</Badge>
            {q.source === 'campus' && <Badge tone="amber">Asked at SRM AP</Badge>}
          </div>

          <p className="text-lg font-medium text-slate-800 mb-4">{q.question}</p>

          <button
            onClick={() => speakQuestion(q.question)}
            className="flex items-center gap-2 text-sm text-indigo-600 hover:text-indigo-800 mb-4"
          >
            <Volume2 size={16} /> Hear it again
          </button>

          {/* Recording */}
          {!currentEval && (
            <div className="space-y-3">
              <button
                onClick={recording ? stopRecording : startRecording}
                disabled={evaluating}
                className={`w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
                  recording ? 'bg-red-600 text-white animate-pulse' : 'bg-slate-700 text-white hover:bg-slate-800'
                }`}
              >
                {recording ? <MicOff size={16} /> : <Mic size={16} />}
                {recording ? 'Stop Recording' : 'Tap to record your answer'}
              </button>
              {evaluating && <p className="text-sm text-slate-500 text-center">Transcribing and evaluating...</p>}
            </div>
          )}

          {/* Feedback */}
          {currentEval && (
            <div className="border-t pt-4 space-y-3">
              <div className="flex items-center gap-4 flex-wrap">
                <ScorePill label="Correctness" value={currentEval.correctness} />
                <ScorePill label="Depth" value={currentEval.depth} />
                <ScorePill label="Communication" value={currentEval.communication} />
              </div>

              <div className="p-3 bg-slate-50 rounded-lg">
                <span className="text-xs font-medium text-slate-500 uppercase">What we heard</span>
                <p className="text-sm text-slate-700 mt-1">{currentEval.transcript || '(nothing detected)'}</p>
              </div>

              <div className="p-3 bg-blue-50 rounded-lg">
                <span className="text-xs font-medium text-blue-600 uppercase">Feedback</span>
                <p className="text-sm text-blue-800 mt-1">{currentEval.feedback}</p>
              </div>

              {currentEval.missed?.length > 0 && (
                <div className="p-3 bg-red-50 rounded-lg">
                  <span className="text-xs font-medium text-red-600 uppercase">Missed Points</span>
                  <ul className="list-disc list-inside text-sm text-red-800 mt-1">
                    {currentEval.missed.map((m, i) => <li key={i}>{m}</li>)}
                  </ul>
                </div>
              )}

              <div className="p-3 bg-slate-50 rounded-lg">
                <span className="text-xs font-medium text-slate-500 uppercase">Model Answer</span>
                <p className="text-sm text-slate-700 mt-1">{currentEval.modelAnswer}</p>
              </div>

              {currentEval.followUp && !followupMode && (
                <div className="p-3 bg-purple-50 rounded-lg">
                  <span className="text-xs font-medium text-purple-600 uppercase">Follow-up Question</span>
                  <p className="text-sm text-purple-800 mt-1">{currentEval.followUp}</p>
                  <button
                    onClick={() => setFollowupMode(true)}
                    className="mt-2 flex items-center gap-1 text-sm text-purple-700 hover:text-purple-900"
                  >
                    <Mic size={14} /> Answer the follow-up
                  </button>
                </div>
              )}

              {followupMode && (
                <div className="space-y-2">
                  <button
                    onClick={recording ? stopRecording : startRecording}
                    disabled={evaluating}
                    className={`w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
                      recording ? 'bg-red-600 text-white animate-pulse' : 'bg-slate-700 text-white hover:bg-slate-800'
                    }`}
                  >
                    {recording ? <MicOff size={16} /> : <Mic size={16} />}
                    {recording ? 'Stop Recording' : 'Record follow-up answer'}
                  </button>
                  {evaluating && <p className="text-sm text-slate-500 text-center">Evaluating follow-up...</p>}
                </div>
              )}

              <div className="flex gap-2 pt-2">
                <button
                  onClick={nextQuestion}
                  className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors"
                >
                  {currentIndex < questions.length - 1 ? 'Next question' : 'See results'}
                  <ChevronRight size={14} />
                </button>
              </div>
            </div>
          )}
        </Card>
      )}
    </>
  );
}

function ReportItem({ label, value }) {
  return (
    <div className="text-center p-3 bg-slate-50 rounded-lg">
      <div className="text-2xl font-bold text-indigo-600">{value}</div>
      <div className="text-xs text-slate-500">{label}</div>
    </div>
  );
}

function ScorePill({ label, value }) {
  const color = value >= 4 ? 'green' : value >= 3 ? 'amber' : 'red';
  return (
    <div className="text-center">
      <Badge tone={color}>{value}/5</Badge>
      <div className="text-xs text-slate-500 mt-1">{label}</div>
    </div>
  );
}
