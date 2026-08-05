import { useEffect, useState } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Brain, RefreshCw, HelpCircle, CheckCircle, Play, AlertCircle } from "lucide-react";

import Notice from "../components/Notice";
import PageShell from "../components/PageShell";
import StudentBanner from "../components/StudentBanner";
import useStudentId from "../hooks/useStudentId";
import { wellnessApi } from "../services/api";

export default function WeaknessAnalyzer() {
  const [studentId, setStudentId] = useStudentId();
  const [quizConcept, setQuizConcept] = useState("");
  const [activeQuestion, setActiveQuestion] = useState(null);
  const [studentAnswer, setStudentAnswer] = useState("");
  const [result, setResult] = useState(null);
  const [weaknesses, setWeaknesses] = useState([]);
  const [loadingWeaknesses, setLoadingWeaknesses] = useState(false);
  const [loadingQuestion, setLoadingQuestion] = useState(false);
  const [submittingAttempt, setSubmittingAttempt] = useState(false);
  const [notice, setNotice] = useState({ type: "info", message: "" });

  const loadWeaknesses = async (targetStudentId = studentId) => {
    if (!targetStudentId) return;
    setLoadingWeaknesses(true);
    try {
      const response = await wellnessApi.getWeakestConcepts(targetStudentId, 8);
      setWeaknesses(response.weakest_concepts || []);
    } catch (error) {
      setNotice({ type: "error", message: error.message });
    } finally {
      setLoadingWeaknesses(false);
    }
  };

  useEffect(() => {
    if (!studentId) {
      setWeaknesses([]);
      setActiveQuestion(null);
      setStudentAnswer("");
      setResult(null);
      return;
    }

    loadWeaknesses(studentId);
  }, [studentId]);

  const clearStudent = () => {
    setStudentId(null);
    setResult(null);
    setWeaknesses([]);
    setActiveQuestion(null);
    setStudentAnswer("");
    setQuizConcept("");
  };

  const requestQuizQuestion = async () => {
    if (!studentId) {
      setNotice({ type: "error", message: "Load a student first." });
      return;
    }

    setLoadingQuestion(true);
    try {
      const payload = { student_id: studentId };
      if (quizConcept.trim()) {
        payload.concept_name = quizConcept.trim();
      }

      const question = await wellnessApi.getQuizQuestion(payload);
      setActiveQuestion(question);
      setStudentAnswer("");
      setResult(null);
      setNotice({ type: "success", message: `Quiz question ready for ${question.concept_name}.` });
    } catch (error) {
      setNotice({ type: "error", message: error.message });
    } finally {
      setLoadingQuestion(false);
    }
  };

  const submitAttempt = async (event) => {
    event.preventDefault();
    if (!studentId) {
      setNotice({ type: "error", message: "Load a student first." });
      return;
    }
    if (!activeQuestion) {
      setNotice({ type: "error", message: "Generate a quiz question first." });
      return;
    }
    if (!studentAnswer.trim()) {
      setNotice({ type: "error", message: "Type your answer before submitting." });
      return;
    }

    setSubmittingAttempt(true);
    try {
      const analysis = await wellnessApi.submitQuizAttempt({
        student_id: studentId,
        question_id: activeQuestion.question_id,
        concept_name: activeQuestion.concept_name,
        question: activeQuestion.question,
        student_answer: studentAnswer.trim(),
        reference_answer: activeQuestion.reference_answer,
        keywords: activeQuestion.keywords || [],
      });

      setResult(analysis);
      await loadWeaknesses(studentId);
      setNotice({
        type: "success",
        message: analysis.is_correct
          ? "Correct. Weakness score updated automatically."
          : "Incorrect. Weakness score updated automatically.",
      });
    } catch (error) {
      setNotice({ type: "error", message: error.message });
    } finally {
      setSubmittingAttempt(false);
    }
  };

  return (
    <PageShell title="Weakness Analyzer" subtitle="Test your knowledge on key topics and monitor concept weakness ranks.">
      <StudentBanner studentId={studentId} onClear={clearStudent} />
      <Notice type={notice.type} message={notice.message} />

      {!studentId ? (
        <section className="bg-white border border-brand-border rounded-2xl p-8 shadow-soft text-center space-y-4 max-w-md mx-auto mt-8">
          <Brain className="w-12 h-12 text-brand-primary/45 mx-auto" />
          <h3 className="text-lg font-bold text-brand-textPrimary font-heading">Student Context Required</h3>
          <p className="text-xs text-brand-textSecondary leading-relaxed">
            Please register or load a student profile from the Profile hub to use the weaknesses analyzer.
          </p>
        </section>
      ) : (
        <div className="space-y-6 sm:space-y-8">
          
          {/* Chart & Table Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 sm:gap-8 items-start">
            
            {/* Chart (Teal color scheme) */}
            <section className="bg-white border border-brand-border rounded-2xl p-5 sm:p-6 shadow-soft lg:col-span-2 space-y-4">
              <div className="flex justify-between items-center pb-3 border-b border-brand-border/40">
                <div>
                  <h3 className="text-sm sm:text-base font-bold text-brand-textPrimary font-heading">Weakest Concepts</h3>
                  <p className="text-xs text-brand-textSecondary">Lower scores signify higher mastery.</p>
                </div>
                <button
                  type="button"
                  className="p-1.5 text-brand-textSecondary hover:bg-brand-hoverBg rounded-lg transition-saas"
                  onClick={() => loadWeaknesses(studentId)}
                  disabled={loadingWeaknesses}
                  title="Refresh weak list"
                >
                  <RefreshCw className={`w-4 h-4 ${loadingWeaknesses ? 'animate-spin' : ''}`} />
                </button>
              </div>

              {weaknesses.length === 0 ? (
                <div className="h-[250px] flex items-center justify-center text-xs text-brand-textMuted bg-slate-50 border border-dashed border-brand-border rounded-xl">
                  No weakness logs found. Attempt a quiz concept below.
                </div>
              ) : (
                <div className="h-[260px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={weaknesses} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                      <XAxis dataKey="concept" tick={{ fontSize: 10 }} />
                      <YAxis domain={[0, 1]} tick={{ fontSize: 10 }} />
                      <Tooltip contentStyle={{ fontSize: '11px', borderRadius: '8px' }} />
                      <Bar dataKey="weakness_score" fill="#0F766E" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </section>

            {/* Ranking Table & Stacked Layout */}
            <section className="bg-white border border-brand-border rounded-2xl p-5 sm:p-6 shadow-soft space-y-4">
              <h3 className="text-sm sm:text-base font-bold text-brand-textPrimary font-heading pb-3 border-b border-brand-border/40">
                Concept Ranking
              </h3>
              
              {/* Desktop/Tablet Table */}
              <div className="hidden sm:block overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-brand-border">
                      <th className="p-2.5 font-semibold text-brand-textSecondary text-center w-10">Rank</th>
                      <th className="p-2.5 font-semibold text-brand-textSecondary">Concept</th>
                      <th className="p-2.5 font-semibold text-brand-textSecondary text-center">Score</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {weaknesses.length === 0 ? (
                      <tr>
                        <td colSpan="3" className="p-4 text-center text-brand-textMuted font-normal">
                          No ranked records.
                        </td>
                      </tr>
                    ) : (
                      weaknesses.map((item, index) => (
                        <tr key={`${item.concept}-${index}`} className="hover:bg-slate-50/50">
                          <td className="p-2.5 text-center text-brand-textSecondary font-medium">{index + 1}</td>
                          <td className="p-2.5 font-semibold text-brand-textPrimary">{item.concept}</td>
                          <td className="p-2.5 text-center font-bold text-brand-textSecondary">
                            {item.weakness_score.toFixed(2)}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Mobile Card Stack */}
              <div className="sm:hidden space-y-3">
                {weaknesses.length === 0 ? (
                  <p className="text-xs text-brand-textMuted text-center py-4">No ranked records.</p>
                ) : (
                  weaknesses.map((item, index) => (
                    <div key={`${item.concept}-${index}`} className="bg-slate-50 border border-brand-border rounded-xl p-3.5 space-y-2 text-xs">
                      <div className="flex justify-between items-center">
                        <span className="font-bold text-brand-textPrimary">{item.concept}</span>
                        <span className="font-semibold text-brand-primary">Rank #{index + 1}</span>
                      </div>
                      <div className="flex justify-between items-center text-[11px] text-brand-textSecondary">
                        <span>Weakness score</span>
                        <span className="font-bold text-brand-textPrimary">{item.weakness_score.toFixed(2)}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>

            </section>

          </div>

          {/* Interactive Quiz Area */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-8 items-start">
            
            {/* Generate form */}
            <section className="bg-white border border-brand-border rounded-2xl p-5 sm:p-6 shadow-soft space-y-4">
              <div className="flex items-center gap-2">
                <Play className="w-4 h-4 text-brand-primary" />
                <h3 className="text-sm sm:text-base font-bold text-brand-textPrimary font-heading">Trigger Active Quiz</h3>
              </div>
              <p className="text-xs text-brand-textSecondary leading-relaxed">
                Start a quiz with a specific target topic, or leave the input empty to let the adaptive engine recommend your weakest areas.
              </p>
              
              <div className="flex flex-col sm:flex-row gap-3">
                <input
                  name="quiz_concept"
                  value={quizConcept}
                  onChange={(event) => setQuizConcept(event.target.value)}
                  placeholder="e.g. statistics, gradient descent"
                  className="flex-1"
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

            {/* Answer Question Form */}
            {activeQuestion && (
              <form className="bg-white border border-brand-border rounded-2xl p-5 sm:p-6 shadow-soft space-y-5" onSubmit={submitAttempt}>
                <div className="flex items-center gap-2 pb-3 border-b border-brand-border/40">
                  <HelpCircle className="w-4 h-4 text-brand-secondary" />
                  <h3 className="text-sm sm:text-base font-bold text-brand-textPrimary font-heading">
                    Concept: <span className="text-brand-primary font-bold">{activeQuestion.concept_name}</span>
                  </h3>
                </div>

                <div className="p-4 bg-slate-50 border border-brand-border/60 rounded-xl">
                  <p className="text-[10px] text-brand-textSecondary font-semibold uppercase tracking-wider mb-1">Question</p>
                  <p className="text-xs sm:text-sm font-medium text-brand-textPrimary leading-relaxed">{activeQuestion.question}</p>
                </div>

                <label className="flex flex-col gap-1.5 text-xs font-semibold text-brand-textSecondary">
                  Your Answer
                  <textarea
                    name="student_answer"
                    value={studentAnswer}
                    onChange={(event) => setStudentAnswer(event.target.value)}
                    rows="4"
                    placeholder="Type your answer explanation here..."
                    required
                  />
                </label>

                <div className="flex gap-2">
                  <button type="submit" className="btn-primary flex-1" disabled={submittingAttempt}>
                    {submittingAttempt ? "Evaluating..." : "Submit Answer"}
                  </button>
                  <button type="button" className="btn-secondary flex-1" onClick={requestQuizQuestion} disabled={loadingQuestion}>
                    {loadingQuestion ? "Generating..." : "Next Question"}
                  </button>
                </div>
              </form>
            )}

          </div>

          {/* Analysis output */}
          {result && (
            <section className="bg-white border border-brand-border rounded-2xl p-5 sm:p-6 shadow-soft space-y-5 max-w-2xl">
              <div className="flex items-center gap-2 pb-3 border-b border-brand-border/40">
                <CheckCircle className="w-5 h-5 text-brand-accent" />
                <h3 className="text-sm sm:text-base font-bold text-brand-textPrimary font-heading">Assessment Result</h3>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="p-3 bg-slate-50 border border-brand-border rounded-xl">
                  <p className="text-[9px] sm:text-[10px] uppercase font-bold text-brand-textSecondary">Attempt</p>
                  <p className={`text-xs sm:text-sm font-bold mt-1 ${result.is_correct ? 'text-status-success' : 'text-status-danger'}`}>
                    {result.is_correct ? "Correct" : "Incorrect"}
                  </p>
                </div>
                <div className="p-3 bg-slate-50 border border-brand-border rounded-xl">
                  <p className="text-[9px] sm:text-[10px] uppercase font-bold text-brand-textSecondary">Priority</p>
                  <p className="text-xs sm:text-sm font-bold text-brand-textPrimary mt-1">{result.learning_priority || "Medium"}</p>
                </div>
                <div className="p-3 bg-slate-50 border border-brand-border rounded-xl">
                  <p className="text-[9px] sm:text-[10px] uppercase font-bold text-brand-textSecondary">Old Score</p>
                  <p className="text-xs sm:text-sm font-bold text-brand-textSecondary mt-1">{result.old_weakness_score.toFixed(2)}</p>
                </div>
                <div className="p-3 bg-slate-50 border border-brand-border rounded-xl">
                  <p className="text-[9px] sm:text-[10px] uppercase font-bold text-brand-textSecondary">New Score</p>
                  <p className="text-xs sm:text-sm font-bold text-brand-primary mt-1">{result.new_weakness_score.toFixed(2)}</p>
                </div>
              </div>

              {result.misconception_detected && (
                <div className="p-4 bg-amber-50 border border-amber-200 text-amber-900 rounded-xl space-y-1">
                  <div className="flex items-center gap-1.5">
                    <AlertCircle className="w-4.5 h-4.5 text-amber-600 shrink-0" />
                    <span className="text-[10px] font-bold uppercase tracking-wider">Misconception Detected</span>
                  </div>
                  <p className="text-xs leading-relaxed">{result.misconception_detected}</p>
                </div>
              )}

              {activeQuestion && (
                <div className="p-4 bg-emerald-50/50 border border-brand-accent/20 rounded-xl space-y-1">
                  <p className="text-xs font-bold text-brand-accent uppercase tracking-wider">Reference Answer</p>
                  <p className="text-xs text-brand-textSecondary leading-relaxed">{activeQuestion.reference_answer}</p>
                </div>
              )}
            </section>
          )}

        </div>
      )}
    </PageShell>
  );
}
