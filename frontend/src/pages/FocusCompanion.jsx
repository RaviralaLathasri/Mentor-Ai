import React, { useState, useEffect } from "react";
import {
  Timer as TimerIcon,
  Play,
  Pause,
  RotateCcw,
  BookOpen,
  Award,
  Calendar,
  Sparkles,
  CheckCircle,
  HelpCircle,
  AlertCircle,
  Flame,
  ChevronRight
} from "lucide-react";
import PageShell from "../components/PageShell";
import Notice from "../components/Notice";
import LoadingSpinner from "../components/LoadingSpinner";
import { focusApi } from "../services/api";

const FOCUS_DURATION = 25 * 60;
const BREAK_DURATION = 5 * 60;
const TEST_FOCUS_DURATION = 10;
const TEST_BREAK_DURATION = 5;

export default function FocusCompanion() {
  const [activeTab, setActiveTab] = useState("timer");
  const [notice, setNotice] = useState({ type: "info", message: "" });
  const [loading, setLoading] = useState(false);

  // ── Pomodoro Timer State ──
  const [isTestMode, setIsTestMode] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState(FOCUS_DURATION);
  const [timerRunning, setTimerRunning] = useState(false);
  const [timerMode, setTimerMode] = useState("focus"); // 'focus' or 'break'
  const [focusConcept, setFocusConcept] = useState("");
  const [summary, setSummary] = useState("");
  const [submittingSummary, setSubmittingSummary] = useState(false);
  const [sessionFeedback, setSessionFeedback] = useState("");

  // ── Recall Cards State ──
  const [cards, setCards] = useState([]);
  const [currentCardIndex, setCurrentCardIndex] = useState(0);
  const [recallAnswer, setRecallAnswer] = useState("");
  const [submittingRecall, setSubmittingRecall] = useState(false);
  const [recallResult, setRecallResult] = useState(null);
  const [generatingCards, setGeneratingCards] = useState(false);

  // ── Focus Statistics State ──
  const [stats, setStats] = useState({
    total_focus_minutes: 0,
    completed_sessions_count: 0,
    streak_days: 0,
    sessions: []
  });

  const currentDuration = timerMode === "focus" 
    ? (isTestMode ? TEST_FOCUS_DURATION : FOCUS_DURATION) 
    : (isTestMode ? TEST_BREAK_DURATION : BREAK_DURATION);

  // ── Timer Effect ──
  useEffect(() => {
    setTimeRemaining(currentDuration);
  }, [timerMode, isTestMode]);

  useEffect(() => {
    let interval = null;
    if (timerRunning && timeRemaining > 0) {
      interval = setInterval(() => {
        setTimeRemaining((prev) => prev - 1);
      }, 1000);
    } else if (timeRemaining === 0 && timerRunning) {
      setTimerRunning(false);
      handleTimerComplete();
    }
    return () => clearInterval(interval);
  }, [timerRunning, timeRemaining]);

  const handleTimerComplete = () => {
    if (timerMode === "focus") {
      setNotice({ type: "success", message: "Focus session completed! Log your summary below to receive Socratic feedback." });
      setTimerMode("break");
    } else {
      setNotice({ type: "info", message: "Break ended. Ready for another focus block?" });
      setTimerMode("focus");
      setSummary("");
      setSessionFeedback("");
    }
  };

  const toggleTimer = () => {
    setTimerRunning(!timerRunning);
  };

  const resetTimer = () => {
    setTimerRunning(false);
    setTimeRemaining(currentDuration);
  };

  const handleSummarySubmit = async (e) => {
    e.preventDefault();
    if (!summary.trim()) return;

    setSubmittingSummary(true);
    try {
      const response = await focusApi.logFocusSession({
        focus_concept: focusConcept || "General Study",
        completed: true,
        summary: summary.trim()
      });
      setSessionFeedback(response.mentor_feedback);
      setNotice({ type: "success", message: "Socratic feedback generated successfully!" });
      loadStats();
    } catch (err) {
      setNotice({ type: "error", message: err.message || "Failed to log session." });
    } finally {
      setSubmittingSummary(false);
    }
  };

  // ── Spaced Repetition Recall Cards Load ──
  const loadCards = async () => {
    setLoading(true);
    try {
      const data = await focusApi.getRecallCards();
      setCards(data);
      setCurrentCardIndex(0);
      setRecallAnswer("");
      setRecallResult(null);
    } catch (err) {
      setNotice({ type: "error", message: "Failed to load flashcard deck." });
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      const data = await focusApi.getFocusStats();
      setStats(data);
    } catch (err) {
      // Quietly ignore or set notice
    }
  };

  useEffect(() => {
    if (activeTab === "cards") {
      loadCards();
    } else if (activeTab === "history") {
      loadStats();
    }
  }, [activeTab]);

  useEffect(() => {
    loadStats();
  }, []);

  const handleGenerateCards = async () => {
    setGeneratingCards(true);
    setNotice({ type: "info", message: "Socrates is analyzing your weaknesses to generate flashcards..." });
    try {
      const response = await focusApi.generateRecallCards();
      setNotice({ type: "success", message: response.message });
      await loadCards();
    } catch (err) {
      setNotice({ type: "error", message: err.message || "Failed to generate recall cards." });
    } finally {
      setGeneratingCards(false);
    }
  };

  const handleSubmitRecall = async (e) => {
    e.preventDefault();
    if (!recallAnswer.trim() || !cards[currentCardIndex]) return;

    setSubmittingRecall(true);
    try {
      const cardId = cards[currentCardIndex].id;
      const response = await focusApi.submitRecallReview(cardId, {
        student_answer: recallAnswer.trim()
      });
      setRecallResult(response);
      setNotice({ type: "success", message: `Active recall graded: Score ${response.score}/5` });
    } catch (err) {
      setNotice({ type: "error", message: err.message || "Failed to submit card review." });
    } finally {
      setSubmittingRecall(false);
    }
  };

  const handleNextCard = () => {
    setRecallResult(null);
    setRecallAnswer("");
    if (currentCardIndex + 1 < cards.length) {
      setCurrentCardIndex(currentCardIndex + 1);
    } else {
      // Reload deck
      loadCards();
    }
  };

  // Timer values calculation
  const minutes = Math.floor(timeRemaining / 60);
  const seconds = timeRemaining % 60;
  const progressPercent = ((currentDuration - timeRemaining) / currentDuration) * 100;

  return (
    <PageShell title="Socratic Focus Companion" subtitle="Boost deep focus, recall weak concepts, and study Socratic-style.">
      
      {/* Notice Message */}
      {notice.message && (
        <div className="mb-6">
          <Notice type={notice.type} message={notice.message} />
        </div>
      )}

      {/* Tab selectors */}
      <div className="flex gap-2 border-b border-slate-100 pb-3 mb-6 max-w-7xl mx-auto">
        <button
          onClick={() => setActiveTab("timer")}
          className={`flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
            activeTab === "timer"
              ? "bg-emerald-50 text-emerald-600 border border-emerald-100/50"
              : "text-slate-500 hover:bg-slate-50 hover:text-slate-800 border border-transparent"
          }`}
        >
          <TimerIcon className="w-4 h-4" />
          Focus Timer
        </button>
        <button
          onClick={() => setActiveTab("cards")}
          className={`flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
            activeTab === "cards"
              ? "bg-emerald-50 text-emerald-600 border border-emerald-100/50"
              : "text-slate-500 hover:bg-slate-50 hover:text-slate-800 border border-transparent"
          }`}
        >
          <BookOpen className="w-4 h-4" />
          Active Recall Deck
        </button>
        <button
          onClick={() => setActiveTab("history")}
          className={`flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
            activeTab === "history"
              ? "bg-emerald-50 text-emerald-600 border border-emerald-100/50"
              : "text-slate-500 hover:bg-slate-50 hover:text-slate-800 border border-transparent"
          }`}
        >
          <Award className="w-4 h-4" />
          Focus Statistics
        </button>
      </div>

      {/* ── Timer Tab ── */}
      {activeTab === "timer" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start max-w-7xl mx-auto">
          
          {/* Circular Countdown widget */}
          <section className="bg-white border border-slate-100 rounded-2xl p-8 shadow-xs flex flex-col items-center justify-center lg:col-span-1 space-y-6">
            <div className="w-full flex justify-between items-center text-xs font-bold uppercase tracking-wider text-slate-400">
              <span className={timerMode === "focus" ? "text-emerald-600" : "text-slate-400"}>
                {timerMode === "focus" ? "• Focus Session" : "Break Block"}
              </span>
              
              {/* Test mode toggle */}
              <button 
                onClick={() => setIsTestMode(!isTestMode)}
                className={`px-2 py-1 rounded border text-[10px] cursor-pointer transition-all ${
                  isTestMode ? "bg-amber-50 border-amber-200 text-amber-600" : "bg-slate-50 border-slate-200 text-slate-400"
                }`}
              >
                {isTestMode ? "Test Timer: On" : "Normal Timer"}
              </button>
            </div>

            {/* Circular progress SVG */}
            <div className="relative w-48 h-48 flex items-center justify-center">
              <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                {/* Background path */}
                <circle
                  cx="50"
                  cy="50"
                  r="45"
                  className="stroke-slate-100 fill-transparent"
                  strokeWidth="6"
                />
                {/* Active progress path */}
                <circle
                  cx="50"
                  cy="50"
                  r="45"
                  className={`fill-transparent transition-all duration-300 ${
                    timerMode === "focus" ? "stroke-emerald-500" : "stroke-amber-500"
                  }`}
                  strokeWidth="6"
                  strokeDasharray="283"
                  strokeDashoffset={283 - (283 * progressPercent) / 100}
                  strokeLinecap="round"
                />
              </svg>
              
              {/* Central Time text */}
              <div className="absolute flex flex-col items-center justify-center">
                <span className="text-3xl font-extrabold text-slate-800 tracking-tighter">
                  {String(minutes).padStart(2, "0")}:{String(seconds).padStart(2, "0")}
                </span>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">
                  {timerRunning ? "Focusing" : "Paused"}
                </span>
              </div>
            </div>

            {/* Timer controls */}
            <div className="flex gap-4 w-full pt-2">
              <button
                onClick={toggleTimer}
                className={`flex-1 py-2.5 px-4 rounded-xl text-xs font-bold text-white transition-all cursor-pointer shadow-sm flex items-center justify-center gap-1.5 ${
                  timerRunning 
                    ? "bg-slate-700 hover:bg-slate-800" 
                    : "bg-emerald-600 hover:bg-emerald-700"
                }`}
              >
                {timerRunning ? (
                  <>
                    <Pause className="w-4 h-4" />
                    <span>Pause</span>
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4" />
                    <span>Start Session</span>
                  </>
                )}
              </button>
              <button
                onClick={resetTimer}
                className="py-2.5 px-3 border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-xl text-xs font-semibold cursor-pointer"
                title="Reset timer"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
            </div>
          </section>

          {/* Socratic summary feedback & Concept input */}
          <section className="bg-white border border-slate-100 rounded-2xl p-6 shadow-xs lg:col-span-2 space-y-6">
            <div className="pb-3 border-b border-slate-50">
              <h3 className="text-base font-bold text-slate-800">Focus Concept Summary</h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Set your study goal and summarize what you learned during your break.
              </p>
            </div>

            <form onSubmit={handleSummarySubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Target Study Topic
                </label>
                <input
                  type="text"
                  value={focusConcept}
                  onChange={(e) => setFocusConcept(e.target.value)}
                  placeholder="e.g. Backpropagation algorithm, Redux state management"
                  disabled={timerRunning}
                  className="block w-full px-3 py-2 border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-sm transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Focus Block break check-in (1-2 sentences summary)
                </label>
                <textarea
                  value={summary}
                  onChange={(e) => setSummary(e.target.value)}
                  rows="3"
                  placeholder="What core concept did you grasp? e.g. 'I studied how learning rate scales weight gradients during gradient updates. A high learning rate causes weights to oscillate.'"
                  className="block w-full px-3 py-2 border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-sm transition-all"
                />
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  disabled={submittingSummary || !summary.trim()}
                  className="btn-primary py-2 px-5"
                >
                  {submittingSummary ? "Evaluating..." : "Submit Break Check-in"}
                </button>
              </div>
            </form>

            {/* Socratic feedback output */}
            {sessionFeedback && (
              <section className="bg-emerald-50/20 border border-emerald-100 rounded-xl p-5 space-y-3 animate-in fade-in duration-300">
                <div className="flex items-center gap-2 pb-2 border-b border-emerald-100/50">
                  <Sparkles className="w-4 h-4 text-emerald-600" />
                  <h4 className="text-xs font-bold text-slate-800">Socrates Focus Feedback</h4>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed italic">
                  "{sessionFeedback}"
                </p>
              </section>
            )}
          </section>

        </div>
      )}

      {/* ── Active Recall Cards Tab ── */}
      {activeTab === "cards" && (
        <div className="max-w-3xl mx-auto space-y-6">
          
          {loading ? (
            <div className="flex justify-center items-center py-20 bg-white border border-slate-100 rounded-2xl shadow-xs">
              <LoadingSpinner />
            </div>
          ) : cards.length === 0 ? (
            <div className="bg-white border border-slate-100 rounded-2xl p-8 text-center space-y-4 shadow-xs py-16">
              <CheckCircle className="w-12 h-12 text-emerald-600 mx-auto" />
              <h3 className="text-lg font-bold text-slate-800">Zero Due Flashcards</h3>
              <p className="text-xs text-slate-400 max-w-sm mx-auto leading-relaxed">
                You are completely caught up! Socrates can auto-generate new active recall flashcards from your quiz mistake history and weakest concepts.
              </p>
              <div className="pt-2">
                <button
                  onClick={handleGenerateCards}
                  disabled={generatingCards}
                  className="btn-primary py-2 px-5 cursor-pointer disabled:opacity-50"
                >
                  {generatingCards ? "Generating..." : "Generate Cards from Weaknesses"}
                </button>
              </div>
            </div>
          ) : (
            <div className="bg-white border border-slate-100 rounded-2xl p-6 shadow-xs space-y-6">
              
              {/* Card Header progress tracker */}
              <div className="flex justify-between items-center pb-3 border-b border-slate-50">
                <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded">
                  {cards[currentCardIndex].concept}
                </span>
                <span className="text-xs text-slate-400 font-semibold">
                  Card {currentCardIndex + 1} of {cards.length}
                </span>
              </div>

              {/* Question card */}
              <div className="p-5 bg-slate-50 border border-slate-100 rounded-xl space-y-2">
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Active Recall Prompt</p>
                <p className="text-sm font-semibold text-slate-800 leading-relaxed">
                  {cards[currentCardIndex].question}
                </p>
              </div>

              {/* Answer input form */}
              {!recallResult ? (
                <form onSubmit={handleSubmitRecall} className="space-y-4">
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Your Active Recall Answer
                  </label>
                  <textarea
                    value={recallAnswer}
                    onChange={(e) => setRecallAnswer(e.target.value)}
                    rows="4"
                    placeholder="Type your explanation here. Challenge yourself to recall definitions and mechanisms from memory before submitting..."
                    required
                    className="block w-full px-3 py-2 border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-xs font-medium transition-all"
                  />
                  <div className="flex justify-end pt-2">
                    <button
                      type="submit"
                      disabled={submittingRecall || !recallAnswer.trim()}
                      className="btn-primary py-2 px-6"
                    >
                      {submittingRecall ? "Verifying..." : "Verify Recall Answer"}
                    </button>
                  </div>
                </form>
              ) : (
                /* Evaluated active recall output */
                <section className="space-y-6 animate-in fade-in duration-200">
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    <div className="p-3.5 bg-slate-50 border border-slate-100 rounded-xl">
                      <p className="text-[9px] uppercase font-bold text-slate-400">Recall Score</p>
                      <p className={`text-sm font-bold mt-0.5 ${
                        recallResult.score >= 3 ? "text-emerald-600" : "text-red-600"
                      }`}>
                        {recallResult.score} / 5
                      </p>
                    </div>
                    <div className="p-3.5 bg-slate-50 border border-slate-100 rounded-xl">
                      <p className="text-[9px] uppercase font-bold text-slate-400">Interval Adjust</p>
                      <p className="text-sm font-bold text-slate-800 mt-0.5">
                        +{recallResult.interval_days} Days
                      </p>
                    </div>
                    <div className="p-3.5 bg-slate-50 border border-slate-100 rounded-xl col-span-2 md:col-span-1">
                      <p className="text-[9px] uppercase font-bold text-slate-400">Status</p>
                      <p className="text-sm font-bold text-slate-500 mt-0.5">
                        {recallResult.score >= 3 ? "Passed" : "Reset due"}
                      </p>
                    </div>
                  </div>

                  {/* Socratic correction feedback */}
                  <div className="p-4 bg-emerald-50/20 border border-emerald-100 rounded-xl space-y-1.5">
                    <div className="flex items-center gap-1.5">
                      <Sparkles className="w-4 h-4 text-emerald-600" />
                      <span className="text-[10px] font-bold text-slate-700 uppercase tracking-wider">Socratic Feedback</span>
                    </div>
                    <p className="text-xs text-slate-600 leading-relaxed italic">
                      "{recallResult.feedback}"
                    </p>
                  </div>

                  {/* Ideal answer definition comparison */}
                  <div className="p-4 bg-slate-50 border border-slate-100 rounded-xl space-y-1.5">
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Ideal Concept Reference</p>
                    <p className="text-xs text-slate-700 leading-relaxed">
                      {recallResult.ideal_explanation}
                    </p>
                  </div>

                  <div className="flex justify-end pt-2 border-t border-slate-50">
                    <button
                      onClick={handleNextCard}
                      className="py-2.5 px-6 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-sm"
                    >
                      <span>{currentCardIndex + 1 < cards.length ? "Next Flashcard" : "Complete Review"}</span>
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>

                </section>
              )}

            </div>
          )}

        </div>
      )}

      {/* ── Focus Statistics Tab ── */}
      {activeTab === "history" && (
        <div className="space-y-8 max-w-7xl mx-auto">
          
          {/* Streak & hours grids */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            
            <div className="bg-white border border-slate-100 rounded-2xl p-6 shadow-xs flex items-center gap-4">
              <div className="p-3 bg-red-50 text-red-500 rounded-xl">
                <Flame className="w-6 h-6" />
              </div>
              <div>
                <p className="text-[10px] uppercase font-bold text-slate-400">Current Streak</p>
                <p className="text-lg font-bold text-slate-800 mt-0.5">{stats.streak_days} Days</p>
              </div>
            </div>

            <div className="bg-white border border-slate-100 rounded-2xl p-6 shadow-xs flex items-center gap-4">
              <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
                <TimerIcon className="w-6 h-6" />
              </div>
              <div>
                <p className="text-[10px] uppercase font-bold text-slate-400">Total Focus Time</p>
                <p className="text-lg font-bold text-slate-800 mt-0.5">{stats.total_focus_minutes} Minutes</p>
              </div>
            </div>

            <div className="bg-white border border-slate-100 rounded-2xl p-6 shadow-xs flex items-center gap-4">
              <div className="p-3 bg-slate-50 text-slate-600 rounded-xl">
                <Award className="w-6 h-6" />
              </div>
              <div>
                <p className="text-[10px] uppercase font-bold text-slate-400">Sessions Completed</p>
                <p className="text-lg font-bold text-slate-800 mt-0.5">{stats.completed_sessions_count} Blocks</p>
              </div>
            </div>

          </div>

          {/* Historical sessions table/log list */}
          <section className="bg-white border border-slate-100 rounded-2xl p-6 shadow-xs space-y-4">
            <h3 className="text-base font-bold text-slate-800 pb-3 border-b border-slate-50">
              Focus History Logs
            </h3>

            {stats.sessions.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-10 font-medium">
                No focus logs recorded yet. Start your first Pomodoro timer!
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-100">
                      <th className="p-3 font-semibold text-slate-500">Date</th>
                      <th className="p-3 font-semibold text-slate-500">Focus Topic</th>
                      <th className="p-3 font-semibold text-slate-500">My Summary</th>
                      <th className="p-3 font-semibold text-slate-500">Socrates Feedback</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {stats.sessions.map((session) => (
                      <tr key={session.id} className="hover:bg-slate-50/50">
                        <td className="p-3 font-medium text-slate-400 whitespace-nowrap">
                          {new Date(session.created_at).toLocaleDateString()}
                        </td>
                        <td className="p-3 font-bold text-slate-700 whitespace-nowrap">
                          {session.focus_concept}
                        </td>
                        <td className="p-3 text-slate-500 font-medium max-w-xs truncate" title={session.summary}>
                          {session.summary || "No summary provided."}
                        </td>
                        <td className="p-3 text-slate-500 leading-relaxed font-normal max-w-sm truncate italic" title={session.mentor_feedback}>
                          {session.mentor_feedback || "None."}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

        </div>
      )}

    </PageShell>
  );
}
