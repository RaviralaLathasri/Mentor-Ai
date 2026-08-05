import { useState } from "react";
import { Sparkles, HelpCircle, AlertTriangle, Lightbulb, BookOpen } from "lucide-react";

import Notice from "../components/Notice";
import PageShell from "../components/PageShell";
import StudentBanner from "../components/StudentBanner";
import useStudentId from "../hooks/useStudentId";
import { explainApi } from "../services/api";

const initialForm = {
  concept: "",
  question: "",
  student_answer: "",
  correct_answer: "",
};

export default function ExplainMistake() {
  const [studentId, setStudentId] = useStudentId();
  const [form, setForm] = useState(initialForm);
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState({ type: "info", message: "" });
  const [explanation, setExplanation] = useState(null);

  const clearStudent = () => {
    setStudentId(null);
    setExplanation(null);
  };

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((previous) => ({ ...previous, [name]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!studentId) {
      setNotice({ type: "error", message: "Load a student first." });
      return;
    }

    setLoading(true);
    try {
      const response = await explainApi.explainMistake({
        student_id: studentId,
        concept: form.concept,
        question: form.question,
        student_answer: form.student_answer,
        correct_answer: form.correct_answer,
      });

      setExplanation(response);
      setNotice({ type: "success", message: "Generated mistake explanation." });
    } catch (error) {
      setNotice({ type: "error", message: error.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <PageShell title="Explain My Mistake" subtitle="Submit incorrect solutions to decode learning gaps and identify misconceptions.">
      <StudentBanner studentId={studentId} onClear={clearStudent} />
      <Notice type={notice.type} message={notice.message} />

      {!studentId ? (
        <section className="bg-white border border-brand-border rounded-2xl p-8 shadow-soft text-center space-y-4 max-w-md mx-auto mt-8">
          <AlertTriangle className="w-12 h-12 text-amber-500/80 mx-auto" />
          <h3 className="text-lg font-bold text-brand-textPrimary font-heading">Student Context Required</h3>
          <p className="text-xs text-brand-textSecondary leading-relaxed">
            Please register or load a student profile from the Profile hub to submit questions for explanation.
          </p>
        </section>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
          
          {/* Submit Form */}
          <form className="bg-white border border-brand-border rounded-2xl p-6 shadow-soft space-y-5 lg:col-span-2" onSubmit={handleSubmit}>
            <div className="pb-3 border-b border-brand-border/40">
              <h3 className="text-base font-bold text-brand-textPrimary font-heading">Submit Mistake Details</h3>
              <p className="text-xs text-brand-textSecondary mt-0.5">
                Explain what concept you attempted, the question, and where you fell short.
              </p>
            </div>

            <div className="space-y-4">
              <label className="flex flex-col gap-1.5 text-xs font-semibold text-brand-textSecondary">
                Focus Concept
                <input
                  name="concept"
                  value={form.concept}
                  onChange={handleChange}
                  placeholder="e.g. gradient descent, backpropagation"
                  required
                />
              </label>

              <label className="flex flex-col gap-1.5 text-xs font-semibold text-brand-textSecondary">
                Original Question / Prompt (optional)
                <textarea
                  name="question"
                  value={form.question}
                  onChange={handleChange}
                  rows="2"
                  placeholder="Paste the problem statement or question here..."
                />
              </label>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <label className="flex flex-col gap-1.5 text-xs font-semibold text-brand-textSecondary">
                  Your Answer
                  <textarea
                    name="student_answer"
                    value={form.student_answer}
                    onChange={handleChange}
                    rows="4"
                    placeholder="Describe your incorrect attempt here..."
                    required
                  />
                </label>

                <label className="flex flex-col gap-1.5 text-xs font-semibold text-brand-textSecondary">
                  Expected / Correct Answer
                  <textarea
                    name="correct_answer"
                    value={form.correct_answer}
                    onChange={handleChange}
                    rows="4"
                    placeholder="Enter the textbook correct solution or code..."
                    required
                  />
                </label>
              </div>
            </div>

            <div className="pt-4 border-t border-brand-border/40 flex justify-end">
              <button type="submit" className="btn-primary px-6" disabled={loading}>
                <span>{loading ? "Analyzing..." : "Explain Mistake"}</span>
                <Sparkles className="w-4 h-4" />
              </button>
            </div>
          </form>

          {/* Explanation Output */}
          <div className="space-y-6">
            {explanation ? (
              <section className="bg-white border border-brand-border rounded-2xl p-6 shadow-soft space-y-5">
                <div className="flex items-center gap-2 pb-3 border-b border-brand-border/40">
                  <Lightbulb className="w-5 h-5 text-brand-primary" />
                  <h3 className="text-base font-bold text-brand-textPrimary font-heading">Conceptual Correction</h3>
                </div>

                <div className="space-y-4">
                  <div className="space-y-1">
                    <h4 className="text-[10px] uppercase font-bold text-brand-textSecondary">Misconception Identified</h4>
                    <p className="text-xs text-brand-textPrimary leading-relaxed bg-red-50/50 border border-red-100 rounded-xl p-3">
                      {explanation.misconception_identified}
                    </p>
                  </div>

                  <div className="space-y-1">
                    <h4 className="text-[10px] uppercase font-bold text-brand-textSecondary">Why Your Answer Was Wrong</h4>
                    <p className="text-xs text-brand-textSecondary leading-relaxed bg-amber-50/50 border border-amber-100 rounded-xl p-3">
                      {explanation.why_wrong}
                    </p>
                  </div>

                  <div className="space-y-1">
                    <h4 className="text-[10px] uppercase font-bold text-brand-textSecondary">Correct Concept Explanation</h4>
                    <p className="text-xs text-brand-textSecondary leading-relaxed bg-brand-primaryLight/35 border border-brand-primary/10 rounded-xl p-3">
                      {explanation.correct_explanation}
                    </p>
                  </div>

                  <div className="space-y-1">
                    <h4 className="text-[10px] uppercase font-bold text-brand-textSecondary">Guiding Question</h4>
                    <p className="text-xs font-semibold text-brand-primary bg-white border border-brand-border rounded-xl p-3 italic">
                      "{explanation.guiding_question}"
                    </p>
                  </div>
                </div>

                {(explanation.learning_tips || []).length > 0 && (
                  <div className="pt-4 border-t border-brand-border/40 space-y-2">
                    <h4 className="text-xs font-bold text-brand-textPrimary font-heading flex items-center gap-1">
                      <BookOpen className="w-4 h-4 text-brand-primary" />
                      <span>Suggested Study Tips</span>
                    </h4>
                    <ul className="list-disc list-inside text-[11px] text-brand-textSecondary space-y-1 pl-1">
                      {explanation.learning_tips.map((tip) => (
                        <li key={tip}>{tip}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </section>
            ) : (
              <section className="bg-slate-50 border border-dashed border-brand-border rounded-2xl p-6 text-center text-brand-textMuted py-16 space-y-2">
                <HelpCircle className="w-10 h-10 text-brand-textMuted/45 mx-auto" />
                <h4 className="text-xs font-bold uppercase tracking-wider text-brand-textSecondary">Awaiting submission</h4>
                <p className="text-[11px] text-brand-textSecondary leading-relaxed max-w-xs mx-auto">
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
