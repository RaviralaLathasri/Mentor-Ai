import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import {
  Send,
  Sparkles,
  User,
  AlertCircle,
  RefreshCw,
  MessageSquare,
  HelpCircle,
  Lightbulb,
  BookOpen,
  Brain,
  CheckCircle,
  Play
} from "lucide-react";

import FeedbackButtons from "../components/FeedbackButtons";
import Notice from "../components/Notice";
import PageShell from "../components/PageShell";
import { useAuth } from "../context/AuthContext";
import { feedbackApi, mentorApi, explainApi, wellnessApi } from "../services/api";

const CHAT_STORAGE_PREFIX = "mentor_chat_messages_v1_";

function chatStorageKey(studentId) {
  return `${CHAT_STORAGE_PREFIX}${studentId}`;
}

function defaultWelcomeMessage(studentId) {
  return {
    id: `welcome-${studentId}`,
    role: "assistant",
    text: "Start with a concept question. I will guide you through our topics using Socratic prompts.",
  };
}

function loadStoredMessages(studentId) {
  if (!studentId) return [];
  const raw = localStorage.getItem(chatStorageKey(studentId));
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item) => item && item.id && item.role && item.text);
  } catch {
    return [];
  }
}

function storeMessages(studentId, messages) {
  if (!studentId) return;
  localStorage.setItem(chatStorageKey(studentId), JSON.stringify(messages));
}

const initialExplainForm = {
  concept: "",
  question: "",
  student_answer: "",
  correct_answer: "",
};

export default function Chat() {
  const { user } = useAuth();
  const studentId = user?.id;
  const [searchParams, setSearchParams] = useSearchParams();
  
  // Set tab options: 'chat', 'quiz', 'explain'
  const activeTab = searchParams.get("tab") === "quiz" ? "quiz" : searchParams.get("tab") === "explain" ? "explain" : "chat";

  // Tab change handler
  const setActiveTab = (tab) => {
    setSearchParams({ tab });
  };

  // ── Socratic Chat State ──
  const [messages, setMessages] = useState([]);
  const [query, setQuery] = useState("");
  const [sending, setSending] = useState(false);
  const [chatNotice, setChatNotice] = useState({ type: "info", message: "" });
  const endRef = useRef(null);

  // ── Explain Mistakes State ──
  const [explainForm, setExplainForm] = useState(initialExplainForm);
  const [explainLoading, setExplainLoading] = useState(false);
  const [explainNotice, setExplainNotice] = useState({ type: "info", message: "" });
  const [explanation, setExplanation] = useState(null);

  // ── Active Quiz & Weakness Analyzer State ──
  const [quizConcept, setQuizConcept] = useState("");
  const [activeQuestion, setActiveQuestion] = useState(null);
  const [quizStudentAnswer, setQuizStudentAnswer] = useState("");
  const [quizResult, setQuizResult] = useState(null);
  const [weaknesses, setWeaknesses] = useState([]);
  const [loadingWeaknesses, setLoadingWeaknesses] = useState(false);
  const [loadingQuestion, setLoadingQuestion] = useState(false);
  const [submittingAttempt, setSubmittingAttempt] = useState(false);
  const [quizNotice, setQuizNotice] = useState({ type: "info", message: "" });

  // ── Chat Hooks ──
  useEffect(() => {
    if (!studentId) {
      setMessages([]);
      return;
    }

    const stored = loadStoredMessages(studentId);
    if (stored.length > 0) {
      setMessages(stored);
      return;
    }

    setMessages([defaultWelcomeMessage(studentId)]);
  }, [studentId]);

  useEffect(() => {
    if (activeTab === "chat") {
      endRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, activeTab]);

  useEffect(() => {
    if (!studentId) return;
    if (!messages.length) return;
    storeMessages(studentId, messages);
  }, [studentId, messages]);

  // ── Quiz Weakness Loading Hooks ──
  const loadWeaknesses = async (targetStudentId = studentId) => {
    if (!targetStudentId) return;
    setLoadingWeaknesses(true);
    try {
      const response = await wellnessApi.getWeakestConcepts(targetStudentId, 8);
      setWeaknesses(response.weakest_concepts || []);
    } catch (error) {
      setQuizNotice({ type: "error", message: error.message });
    } finally {
      setLoadingWeaknesses(false);
    }
  };

  useEffect(() => {
    if (studentId && activeTab === "quiz") {
      loadWeaknesses(studentId);
    }
  }, [studentId, activeTab]);

  const canSend = useMemo(() => Boolean(studentId && query.trim() && !sending), [studentId, query, sending]);

  const requestMentorResponse = async (payload, retries = 1) => {
    try {
      return await mentorApi.respond(payload);
    } catch (error) {
      const message = (error?.message || "").toLowerCase();
      const isTransient =
        message.includes("timeout") ||
        message.includes("network") ||
        message.includes("failed to fetch") ||
        message.includes("503") ||
        message.includes("502") ||
        message.includes("500");

      if (retries > 0 && isTransient) {
        await new Promise((resolve) => setTimeout(resolve, 600));
        return requestMentorResponse(payload, retries - 1);
      }
      throw error;
    }
  };

  const sendCurrentMessage = async () => {
    if (!canSend) return;

    const text = query.trim();
    setQuery("");

    setMessages((previous) => [...previous, { id: `u-${Date.now()}`, role: "user", text }]);
    setSending(true);

    try {
      const response = await requestMentorResponse({
        student_id: studentId,
        query: text,
      });

      setMessages((previous) => [
        ...previous,
        {
          id: `a-${response.response_id}`,
          role: "assistant",
          text: response.response,
          responseId: response.response_id,
          concept: response.target_concept,
          style: response.explanation_style,
          followUp: response.follow_up_question,
          feedback: "",
        },
      ]);
      setChatNotice({ type: "success", message: "Mentor response generated." });
    } catch (error) {
      const errorText = error?.message || "Could not generate mentor response.";
      setChatNotice({ type: "error", message: errorText });
      setMessages((previous) => [
        ...previous,
        {
          id: `a-error-${Date.now()}`,
          role: "assistant",
          text: `I could not reply due to a temporary issue: ${errorText}. Please press Send again.`,
        },
      ]);
    } finally {
      setSending(false);
    }
  };

  const sendMessage = async (event) => {
    event.preventDefault();
    await sendCurrentMessage();
  };

  const handleTextareaKeyDown = async (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      await sendCurrentMessage();
    }
  };

  const submitFeedback = async (messageIndex, feedbackType) => {
    const message = messages[messageIndex];
    if (!message?.responseId || !studentId) return;

    try {
      await feedbackApi.submit({
        student_id: studentId,
        response_id: message.responseId,
        feedback_type: feedbackType,
        focus_concept: message.concept,
      });

      setMessages((previous) => {
        const copy = [...previous];
        copy[messageIndex] = { ...copy[messageIndex], feedback: feedbackType };
        return copy;
      });
      setChatNotice({ type: "success", message: `Feedback recorded as ${feedbackType}.` });
    } catch (error) {
      setChatNotice({ type: "error", message: error.message });
    }
  };

  // ── Explain Mistake Handlers ──
  const handleExplainChange = (event) => {
    const { name, value } = event.target;
    setExplainForm((previous) => ({ ...previous, [name]: value }));
  };

  const handleExplainSubmit = async (event) => {
    event.preventDefault();
    setExplainLoading(true);
    setExplainNotice({ type: "info", message: "" });
    try {
      const response = await explainApi.explainMistake({
        student_id: studentId,
        concept: explainForm.concept,
        question: explainForm.question,
        student_answer: explainForm.student_answer,
        correct_answer: explainForm.correct_answer,
      });

      setExplanation(response);
      setExplainNotice({ type: "success", message: "Generated mistake explanation." });
    } catch (error) {
      setExplainNotice({ type: "error", message: error.message });
    } finally {
      setExplainLoading(false);
    }
  };

  // ── Quiz Handlers ──
  const requestQuizQuestion = async () => {
    if (!studentId) return;
    setLoadingQuestion(true);
    setQuizNotice({ type: "info", message: "" });
    try {
      const payload = { student_id: studentId };
      if (quizConcept.trim()) {
        payload.concept_name = quizConcept.trim();
      }

      const question = await wellnessApi.getQuizQuestion(payload);
      setActiveQuestion(question);
      setQuizStudentAnswer("");
      setQuizResult(null);
      setQuizNotice({ type: "success", message: `Quiz question ready for ${question.concept_name}.` });
    } catch (error) {
      setQuizNotice({ type: "error", message: error.message });
    } finally {
      setLoadingQuestion(false);
    }
  };

  const submitQuizAttempt = async (event) => {
    event.preventDefault();
    if (!studentId || !activeQuestion || !quizStudentAnswer.trim()) return;

    setSubmittingAttempt(true);
    setQuizNotice({ type: "info", message: "" });
    try {
      const analysis = await wellnessApi.submitQuizAttempt({
        student_id: studentId,
        question_id: activeQuestion.question_id,
        concept_name: activeQuestion.concept_name,
        question: activeQuestion.question,
        student_answer: quizStudentAnswer.trim(),
        reference_answer: activeQuestion.reference_answer,
        keywords: activeQuestion.keywords || [],
      });

      setQuizResult(analysis);
      await loadWeaknesses(studentId);
      setQuizNotice({
        type: "success",
        message: analysis.is_correct
          ? "Correct. Weakness scores recalculated."
          : "Incorrect. Weakness scores recalculated.",
      });
    } catch (error) {
      setQuizNotice({ type: "error", message: error.message });
    } finally {
      setSubmittingAttempt(false);
    }
  };

  return (
    <PageShell title="Mentor Workspace" subtitle="Collaborate with your Socratic guide, test your limits, and explain code mistakes.">
      
      {/* Sub Tabs Toggle (3 Tabs) */}
      <div className="flex gap-2 border-b border-slate-100 pb-3 mb-6 max-w-7xl mx-auto">
        <button
          onClick={() => setActiveTab("chat")}
          className={`flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
            activeTab === "chat"
              ? "bg-emerald-50 text-emerald-600 border border-emerald-100/50"
              : "text-slate-500 hover:bg-slate-50 hover:text-slate-800 border border-transparent"
          }`}
        >
          <MessageSquare className="w-4 h-4" />
          Socratic Chat
        </button>
        <button
          onClick={() => setActiveTab("quiz")}
          className={`flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
            activeTab === "quiz"
              ? "bg-emerald-50 text-emerald-600 border border-emerald-100/50"
              : "text-slate-500 hover:bg-slate-50 hover:text-slate-800 border border-transparent"
          }`}
        >
          <Brain className="w-4 h-4" />
          Active Quiz
        </button>
        <button
          onClick={() => setActiveTab("explain")}
          className={`flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
            activeTab === "explain"
              ? "bg-emerald-50 text-emerald-600 border border-emerald-100/50"
              : "text-slate-500 hover:bg-slate-50 hover:text-slate-800 border border-transparent"
          }`}
        >
          <HelpCircle className="w-4 h-4" />
          Explain My Mistake
        </button>
      </div>

      {/* ── Conversational Chat Tab ── */}
      {activeTab === "chat" && (
        <div className="grid grid-cols-1 gap-6 max-w-4xl mx-auto">
          {chatNotice.message && (
            <Notice type={chatNotice.type} message={chatNotice.message} />
          )}

          {/* Messages window */}
          <section className="bg-white border border-slate-100 rounded-2xl p-6 shadow-xs min-h-[400px] max-h-[500px] overflow-y-auto flex flex-col gap-6">
            {messages.map((message, index) => {
              const isAssistant = message.role === "assistant";
              return (
                <article
                  key={message.id}
                  className={`flex gap-4 max-w-[85%] ${
                    isAssistant ? "self-start" : "self-end flex-row-reverse"
                  }`}
                >
                  {/* Icon Avatar */}
                  <div
                    className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 shadow-xs border ${
                      isAssistant
                        ? "bg-emerald-50 text-emerald-600 border-emerald-100"
                        : "bg-slate-50 text-slate-600 border-slate-100"
                    }`}
                  >
                    {isAssistant ? <Sparkles className="w-4 h-4" /> : <User className="w-4 h-4" />}
                  </div>

                  {/* Speech Bubble */}
                  <div className="space-y-3">
                    <div
                      className={`p-4 rounded-2xl text-sm leading-relaxed border shadow-xs ${
                        isAssistant
                          ? "bg-slate-50/50 border-slate-100 text-slate-800"
                          : "bg-emerald-600 text-white border-transparent"
                      }`}
                    >
                      <p className="whitespace-pre-wrap">{message.text}</p>
                      
                      {isAssistant && message.followUp && (
                        <div className="mt-3 pt-3 border-t border-slate-100 text-emerald-600 font-medium text-xs">
                          <span>Follow-up:</span> <span className="font-semibold text-slate-800">{message.followUp}</span>
                        </div>
                      )}
                    </div>

                    {/* Socratic Feedback & Meta Data */}
                    {isAssistant && message.responseId && (
                      <div className="space-y-2 pl-1.5">
                        <div className="flex items-center gap-3">
                          <FeedbackButtons
                            selected={message.feedback}
                            disabled={Boolean(message.feedback)}
                            onSubmit={(type) => submitFeedback(index, type)}
                          />
                        </div>
                        <div className="text-[10px] text-slate-400 flex items-center gap-2">
                          {message.feedback ? (
                            <span className="font-semibold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded">
                              Feedback: {message.feedback.replace("_", " ")}
                            </span>
                          ) : (
                            <>
                              <span>Style: <strong>{message.style}</strong></span>
                              <span>•</span>
                              <span>Target: <strong>{message.concept}</strong></span>
                            </>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </article>
              );
            })}
            
            {sending && (
              <div className="flex gap-4 max-w-[80%] self-start">
                <div className="w-9 h-9 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-100 flex items-center justify-center animate-pulse shadow-sm">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div className="bg-slate-50 border border-slate-100 text-slate-500 px-4 py-3 rounded-2xl text-xs flex items-center gap-2">
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Thinking about Socratic adaptation...</span>
                </div>
              </div>
            )}

            <div ref={endRef} />
          </section>

          {/* Form input area */}
          <form className="bg-white border border-slate-100 rounded-2xl p-5 shadow-xs space-y-3" onSubmit={sendMessage}>
            <label className="flex flex-col gap-1.5 text-xs font-semibold text-slate-700">
              Ask Socratic Mentor
              <textarea
                rows="3"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={handleTextareaKeyDown}
                placeholder="Example: Why does gradient descent use the negative gradient?"
                className="resize-none block w-full px-3 py-2 border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-sm transition-all"
              />
            </label>
            <div className="flex justify-between items-center gap-4">
              <span className="text-[10px] text-slate-400">
                Press <strong>Enter</strong> to send. Use <strong>Shift + Enter</strong> for a new line.
              </span>
              <button
                type="submit"
                className="btn-primary py-2 px-5 shrink-0"
                disabled={!canSend}
              >
                <span>Send</span>
                <Send className="w-3.5 h-3.5" />
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ── Active Quiz Tab ── */}
      {activeTab === "quiz" && (
        <div className="space-y-8 max-w-7xl mx-auto">
          
          {/* Top section: Quiz trigger and answering */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
            
            {/* Trigger card */}
            <section className="bg-white border border-slate-100 rounded-2xl p-6 shadow-xs space-y-4">
              <div className="flex items-center gap-2">
                <Play className="w-4 h-4 text-emerald-600" />
                <h3 className="text-base font-bold text-slate-800">Trigger Active Quiz</h3>
              </div>
              <p className="text-xs text-slate-500 leading-relaxed">
                Generate an adaptive quiz target. Enter a specific concept (e.g. "statistics") or leave empty to let Socrates select based on your weakest concept ranks.
              </p>

              {quizNotice.message && (
                <div className="mb-2">
                  <Notice type={quizNotice.type} message={quizNotice.message} />
                </div>
              )}

              <div className="flex flex-col sm:flex-row gap-3 pt-2">
                <input
                  name="quiz_concept"
                  value={quizConcept}
                  onChange={(event) => setQuizConcept(event.target.value)}
                  placeholder="e.g. statistics, gradient descent"
                  className="flex-1 block px-3 py-2 border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-sm transition-all"
                />
                <button
                  type="button"
                  className="btn-primary w-full sm:w-auto py-2 px-5 shrink-0"
                  onClick={requestQuizQuestion}
                  disabled={loadingQuestion}
                >
                  {loadingQuestion ? "Generating..." : "Get Question"}
                </button>
              </div>
            </section>

            {/* Answer Quiz question card */}
            {activeQuestion && (
              <form className="bg-white border border-slate-100 rounded-2xl p-6 shadow-xs space-y-5 animate-in fade-in duration-200" onSubmit={submitQuizAttempt}>
                <div className="flex items-center gap-2 pb-3 border-b border-slate-50">
                  <HelpCircle className="w-4 h-4 text-emerald-600" />
                  <h3 className="text-sm font-bold text-slate-800">
                    Concept: <span className="text-emerald-600 font-bold">{activeQuestion.concept_name}</span>
                  </h3>
                </div>

                <div className="p-4 bg-slate-50/50 border border-slate-100 rounded-xl">
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1">Question</p>
                  <p className="text-xs font-semibold text-slate-700 leading-relaxed">{activeQuestion.question}</p>
                </div>

                <label className="flex flex-col gap-1.5 text-xs font-bold text-slate-700">
                  Your Answer
                  <textarea
                    value={quizStudentAnswer}
                    onChange={(event) => setQuizStudentAnswer(event.target.value)}
                    rows="3"
                    placeholder="Type your explanation or response..."
                    required
                    className="block w-full px-3 py-2 border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-xs font-medium transition-all"
                  />
                </label>

                <div className="flex gap-3">
                  <button type="submit" className="btn-primary flex-1 py-2" disabled={submittingAttempt}>
                    {submittingAttempt ? "Evaluating..." : "Submit Answer"}
                  </button>
                  <button type="button" className="w-full flex-1 py-2 border border-slate-200 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-50 transition-all cursor-pointer text-center" onClick={requestQuizQuestion} disabled={loadingQuestion}>
                    {loadingQuestion ? "Generating..." : "Next Question"}
                  </button>
                </div>
              </form>
            )}

          </div>

          {/* Assessment Result Output (If available) */}
          {quizResult && (
            <section className="bg-white border border-slate-100 rounded-2xl p-6 shadow-xs space-y-5 max-w-4xl mx-auto animate-in fade-in duration-200">
              <div className="flex items-center gap-2 pb-3 border-b border-slate-50">
                <CheckCircle className="w-5 h-5 text-emerald-600" />
                <h3 className="text-sm font-bold text-slate-800">Quiz Assessment Result</h3>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl">
                  <p className="text-[9px] uppercase font-bold text-slate-400">Attempt</p>
                  <p className={`text-xs font-bold mt-1 ${quizResult.is_correct ? 'text-emerald-600' : 'text-red-600'}`}>
                    {quizResult.is_correct ? "Correct" : "Incorrect"}
                  </p>
                </div>
                <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl">
                  <p className="text-[9px] uppercase font-bold text-slate-400">Priority</p>
                  <p className="text-xs font-bold text-slate-800 mt-1">{quizResult.learning_priority || "Medium"}</p>
                </div>
                <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl">
                  <p className="text-[9px] uppercase font-bold text-slate-400">Old Score</p>
                  <p className="text-xs font-bold text-slate-500 mt-1">{(quizResult.old_weakness_score ?? 0).toFixed(2)}</p>
                </div>
                <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl">
                  <p className="text-[9px] uppercase font-bold text-slate-400">New Score</p>
                  <p className="text-xs font-bold text-emerald-600 mt-1">{(quizResult.new_weakness_score ?? 0).toFixed(2)}</p>
                </div>
              </div>

              {quizResult.misconception_detected && (
                <div className="p-4 bg-amber-50 border border-amber-100 text-amber-900 rounded-xl space-y-1">
                  <div className="flex items-center gap-1.5">
                    <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                    <span className="text-[10px] font-bold uppercase tracking-wider">Misconception Detected</span>
                  </div>
                  <p className="text-xs leading-relaxed">{quizResult.misconception_detected}</p>
                </div>
              )}

              {activeQuestion && (
                <div className="p-4 bg-emerald-50/20 border border-emerald-100 rounded-xl space-y-1">
                  <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider">Reference Answer</p>
                  <p className="text-xs text-slate-600 leading-relaxed">{activeQuestion.reference_answer}</p>
                </div>
              )}
            </section>
          )}

          {/* Bottom Section: Weakness List and Chart */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
            
            {/* Chart (emerald colors) */}
            <section className="bg-white border border-slate-100 rounded-2xl p-6 shadow-xs lg:col-span-2 space-y-4">
              <div className="flex justify-between items-center pb-3 border-b border-slate-50">
                <div>
                  <h3 className="text-sm font-bold text-slate-800">Weakest Concepts</h3>
                  <p className="text-xs text-slate-400">Lower scores signify higher mastery.</p>
                </div>
                <button
                  type="button"
                  className="p-1.5 text-slate-500 hover:bg-slate-50 rounded-lg transition-all"
                  onClick={() => loadWeaknesses(studentId)}
                  disabled={loadingWeaknesses}
                  title="Refresh list"
                >
                  <RefreshCw className={`w-4 h-4 ${loadingWeaknesses ? 'animate-spin' : ''}`} />
                </button>
              </div>

              {weaknesses.length === 0 ? (
                <div className="h-[250px] flex items-center justify-center text-xs text-slate-400 bg-slate-50/50 border border-dashed border-slate-200 rounded-xl">
                  No weakness logs found. Attempt a quiz concept above.
                </div>
              ) : (
                <div className="h-[260px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={weaknesses} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                      <XAxis dataKey="concept" tick={{ fontSize: 9 }} />
                      <YAxis domain={[0, 1]} tick={{ fontSize: 9 }} />
                      <Tooltip contentStyle={{ fontSize: '10px', borderRadius: '8px' }} />
                      <Bar dataKey="weakness_score" fill="#059669" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </section>

            {/* Ranking list */}
            <section className="bg-white border border-slate-100 rounded-2xl p-6 shadow-xs space-y-4">
              <h3 className="text-sm font-bold text-slate-800 pb-3 border-b border-slate-50">
                Concept Ranking
              </h3>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-100">
                      <th className="p-2 font-semibold text-slate-500 text-center w-10">Rank</th>
                      <th className="p-2 font-semibold text-slate-500">Concept</th>
                      <th className="p-2 font-semibold text-slate-500 text-center">Score</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {weaknesses.length === 0 ? (
                      <tr>
                        <td colSpan="3" className="p-4 text-center text-slate-400 font-normal">
                          No ranked records yet.
                        </td>
                      </tr>
                    ) : (
                      weaknesses.map((item, index) => (
                        <tr key={`${item.concept}-${index}`} className="hover:bg-slate-50/50">
                          <td className="p-2 text-center text-slate-500 font-medium">{index + 1}</td>
                          <td className="p-2 font-bold text-slate-700">{item.concept}</td>
                          <td className="p-2 text-center font-extrabold text-slate-600">
                            {item.weakness_score.toFixed(2)}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </section>

          </div>

        </div>
      )}

      {/* ── Explain Mistakes Tab ── */}
      {activeTab === "explain" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start max-w-7xl mx-auto">
          
          {/* Submit Form */}
          <form className="bg-white border border-slate-100 rounded-2xl p-6 shadow-xs space-y-5 lg:col-span-2" onSubmit={handleExplainSubmit}>
            <div className="pb-3 border-b border-slate-50">
              <h3 className="text-base font-bold text-slate-800">Submit Mistake Details</h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Explain what concept you attempted, the question, and where you fell short.
              </p>
            </div>

            {explainNotice.message && (
              <Notice type={explainNotice.type} message={explainNotice.message} />
            )}

            <div className="space-y-4">
              <label className="flex flex-col gap-1.5 text-xs font-semibold text-slate-700">
                Focus Concept
                <input
                  name="concept"
                  value={explainForm.concept}
                  onChange={handleExplainChange}
                  placeholder="e.g. gradient descent, backpropagation"
                  required
                  className="block w-full px-3 py-2 border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-sm transition-all"
                />
              </label>

              <label className="flex flex-col gap-1.5 text-xs font-semibold text-slate-700">
                Original Question / Prompt (optional)
                <textarea
                  name="question"
                  value={explainForm.question}
                  onChange={handleExplainChange}
                  rows="2"
                  placeholder="Paste the problem statement or question here..."
                  className="block w-full px-3 py-2 border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-sm transition-all"
                />
              </label>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <label className="flex flex-col gap-1.5 text-xs font-semibold text-slate-700">
                  Your Answer
                  <textarea
                    name="student_answer"
                    value={explainForm.student_answer}
                    onChange={handleExplainChange}
                    rows="4"
                    placeholder="Describe your incorrect attempt here..."
                    required
                    className="block w-full px-3 py-2 border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-sm transition-all"
                  />
                </label>

                <label className="flex flex-col gap-1.5 text-xs font-semibold text-slate-700">
                  Expected / Correct Answer
                  <textarea
                    name="correct_answer"
                    value={explainForm.correct_answer}
                    onChange={handleExplainChange}
                    rows="4"
                    placeholder="Enter the textbook correct solution or code..."
                    required
                    className="block w-full px-3 py-2 border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-sm transition-all"
                  />
                </label>
              </div>
            </div>

            <div className="pt-4 border-t border-slate-50 flex justify-end">
              <button type="submit" className="btn-primary px-6" disabled={explainLoading}>
                <span>{explainLoading ? "Analyzing..." : "Explain Mistake"}</span>
                <Sparkles className="w-4 h-4" />
              </button>
            </div>
          </form>

          {/* Explanation Output */}
          <div className="space-y-6">
            {explanation ? (
              <section className="bg-white border border-slate-100 rounded-2xl p-6 shadow-xs space-y-5 animate-in fade-in duration-200">
                <div className="flex items-center gap-2 pb-3 border-b border-slate-50">
                  <Lightbulb className="w-5 h-5 text-emerald-600" />
                  <h3 className="text-base font-bold text-slate-800">Conceptual Correction</h3>
                </div>

                <div className="space-y-4">
                  <div className="space-y-1">
                    <h4 className="text-[10px] uppercase font-bold text-slate-400">Misconception Identified</h4>
                    <p className="text-xs text-red-700 leading-relaxed bg-red-50/50 border border-red-100 rounded-xl p-3">
                      {explanation.misconception_identified}
                    </p>
                  </div>

                  <div className="space-y-1">
                    <h4 className="text-[10px] uppercase font-bold text-slate-400">Why Your Answer Was Wrong</h4>
                    <p className="text-xs text-amber-700 leading-relaxed bg-amber-50/50 border border-amber-100 rounded-xl p-3">
                      {explanation.why_wrong}
                    </p>
                  </div>

                  <div className="space-y-1">
                    <h4 className="text-[10px] uppercase font-bold text-slate-400">Correct Concept Explanation</h4>
                    <p className="text-xs text-slate-600 leading-relaxed bg-emerald-50/20 border border-emerald-100/50 rounded-xl p-3">
                      {explanation.correct_explanation}
                    </p>
                  </div>

                  <div className="space-y-1">
                    <h4 className="text-[10px] uppercase font-bold text-slate-400">Guiding Question</h4>
                    <p className="text-xs font-semibold text-emerald-600 bg-white border border-slate-100 rounded-xl p-3 italic">
                      "{explanation.guiding_question}"
                    </p>
                  </div>
                </div>

                {(explanation.learning_tips || []).length > 0 && (
                  <div className="pt-4 border-t border-slate-50 space-y-2">
                    <h4 className="text-xs font-bold text-slate-800 flex items-center gap-1">
                      <BookOpen className="w-4 h-4 text-emerald-600" />
                      <span>Suggested Study Tips</span>
                    </h4>
                    <ul className="list-disc list-inside text-[11px] text-slate-500 space-y-1 pl-1">
                      {explanation.learning_tips.map((tip) => (
                        <li key={tip}>{tip}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </section>
            ) : (
              <section className="bg-slate-50 border border-dashed border-slate-200 rounded-2xl p-6 text-center py-16 space-y-2">
                <HelpCircle className="w-10 h-10 text-slate-300 mx-auto" />
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">Awaiting submission</h4>
                <p className="text-[11px] text-slate-500 leading-relaxed max-w-xs mx-auto">
                  Submit your incorrect answer details to extract Socratic lessons and suggestions.
                </p>
              </section>
            )}
          </div>

        </div>
      )}
    </PageShell>
  );
}
