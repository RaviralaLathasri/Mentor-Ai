import { useState } from "react";

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
    <PageShell title="Explain My Mistake" subtitle="Get conceptual correction and a guiding follow-up question.">
      <StudentBanner studentId={studentId} onClear={clearStudent} />
      <Notice type={notice.type} message={notice.message} />

      {!studentId ? (
        <section className="panel">
          <p>Create or load a student profile first.</p>
        </section>
      ) : (
        <>
          <form className="panel form-grid" onSubmit={handleSubmit}>
            <h3>Submit Incorrect Answer</h3>

            <label>
              Concept
              <input
                name="concept"
                value={form.concept}
                onChange={handleChange}
                placeholder="e.g., gradient descent"
                required
              />
            </label>

            <label className="full-width">
              Original Question
              <textarea
                name="question"
                value={form.question}
                onChange={handleChange}
                rows="3"
                placeholder="Paste the question prompt"
              />
            </label>

            <label>
              Student Answer
              <textarea
                name="student_answer"
                value={form.student_answer}
                onChange={handleChange}
                rows="4"
                required
              />
            </label>

            <label>
              Correct Answer
              <textarea
                name="correct_answer"
                value={form.correct_answer}
                onChange={handleChange}
                rows="4"
                required
              />
            </label>

            <div className="button-row full-width">
              <button type="submit" className="primary-btn" disabled={loading}>
                {loading ? "Generating..." : "Explain Mistake"}
              </button>
            </div>
          </form>

          {explanation ? (
            <section className="panel">
              <h3>Conceptual Correction</h3>
              <p>
                <strong>Misconception:</strong> {explanation.misconception_identified}
              </p>
              <p>
                <strong>Why Answer Is Wrong:</strong> {explanation.why_wrong}
              </p>
              <p>
                <strong>Correct Concept:</strong> {explanation.correct_explanation}
              </p>
              <p>
                <strong>Related Concept:</strong> {explanation.related_concept}
              </p>
              <p>
                <strong>Guiding Question:</strong> {explanation.guiding_question}
              </p>
              <h4>Learning Tips</h4>
              <ul>
                {(explanation.learning_tips || []).map((tip) => (
                  <li key={tip}>{tip}</li>
                ))}
              </ul>
            </section>
          ) : null}
        </>
      )}
    </PageShell>
  );
}
