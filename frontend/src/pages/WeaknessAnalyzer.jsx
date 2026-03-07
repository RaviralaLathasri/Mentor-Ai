import { useEffect, useState } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import Notice from "../components/Notice";
import PageShell from "../components/PageShell";
import StudentBanner from "../components/StudentBanner";
import useStudentId from "../hooks/useStudentId";
import { wellnessApi } from "../services/api";

const initialQuizForm = {
  concept_name: "",
  is_correct: false,
  student_answer: "",
  correct_answer: "",
};

export default function WeaknessAnalyzer() {
  const [studentId, setStudentId] = useStudentId();
  const [quizForm, setQuizForm] = useState(initialQuizForm);
  const [result, setResult] = useState(null);
  const [weaknesses, setWeaknesses] = useState([]);
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState({ type: "info", message: "" });

  useEffect(() => {
    if (!studentId) {
      setWeaknesses([]);
      return;
    }

    const loadWeaknesses = async () => {
      setLoading(true);
      try {
        const response = await wellnessApi.getWeakestConcepts(studentId, 8);
        setWeaknesses(response.weakest_concepts || []);
      } catch (error) {
        setNotice({ type: "error", message: error.message });
      } finally {
        setLoading(false);
      }
    };

    loadWeaknesses();
  }, [studentId]);

  const clearStudent = () => {
    setStudentId(null);
    setResult(null);
    setWeaknesses([]);
  };

  const handleChange = (event) => {
    const { name, value } = event.target;
    setQuizForm((previous) => ({ ...previous, [name]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!studentId) {
      setNotice({ type: "error", message: "Load a student first." });
      return;
    }

    setLoading(true);
    try {
      const analysis = await wellnessApi.submitQuiz({
        student_id: studentId,
        concept_name: quizForm.concept_name,
        is_correct: quizForm.is_correct === "true" || quizForm.is_correct === true,
        student_answer: quizForm.student_answer,
        correct_answer: quizForm.correct_answer,
      });
      setResult(analysis);

      const updated = await wellnessApi.getWeakestConcepts(studentId, 8);
      setWeaknesses(updated.weakest_concepts || []);
      setNotice({ type: "success", message: "Weakness scores updated." });
      setQuizForm(initialQuizForm);
    } catch (error) {
      setNotice({ type: "error", message: error.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <PageShell title="Weakness Analyzer" subtitle="Track concept weaknesses using quiz outcomes.">
      <StudentBanner studentId={studentId} onClear={clearStudent} />
      <Notice type={notice.type} message={notice.message} />

      {!studentId ? (
        <section className="panel">
          <p>Create or load a student profile before using the analyzer.</p>
        </section>
      ) : (
        <>
          <form className="panel form-grid" onSubmit={handleSubmit}>
            <h3>Submit Quiz Outcome</h3>
            <label>
              Concept
              <input
                name="concept_name"
                value={quizForm.concept_name}
                onChange={handleChange}
                placeholder="e.g., backpropagation"
                required
              />
            </label>

            <label>
              Was the student answer correct?
              <select name="is_correct" value={String(quizForm.is_correct)} onChange={handleChange}>
                <option value="false">Incorrect</option>
                <option value="true">Correct</option>
              </select>
            </label>

            <label>
              Student Answer
              <textarea
                name="student_answer"
                value={quizForm.student_answer}
                onChange={handleChange}
                rows="3"
                placeholder="Student response"
              />
            </label>

            <label>
              Correct Answer
              <textarea
                name="correct_answer"
                value={quizForm.correct_answer}
                onChange={handleChange}
                rows="3"
                placeholder="Reference answer"
              />
            </label>

            <div className="button-row full-width">
              <button type="submit" className="primary-btn" disabled={loading}>
                {loading ? "Analyzing..." : "Analyze"}
              </button>
            </div>
          </form>

          {result ? (
            <section className="panel">
              <h3>Latest Analysis</h3>
              <div className="grid two">
                <p>
                  <strong>Concept:</strong> {result.concept_name}
                </p>
                <p>
                  <strong>Priority:</strong> {result.learning_priority}
                </p>
                <p>
                  <strong>Old Score:</strong> {result.old_weakness_score}
                </p>
                <p>
                  <strong>New Score:</strong> {result.new_weakness_score}
                </p>
              </div>
              {result.misconception_detected ? (
                <p>
                  <strong>Detected Misconception:</strong> {result.misconception_detected}
                </p>
              ) : null}
            </section>
          ) : null}

          <section className="panel chart-panel">
            <h3>Weakest Concept Graph</h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={weaknesses}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="concept" />
                <YAxis domain={[0, 1]} />
                <Tooltip />
                <Bar dataKey="weakness_score" fill="#ef4444" />
              </BarChart>
            </ResponsiveContainer>
          </section>

          <section className="panel">
            <h3>Concept Ranking</h3>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Rank</th>
                  <th>Concept</th>
                  <th>Weakness Score</th>
                  <th>Priority</th>
                </tr>
              </thead>
              <tbody>
                {weaknesses.length === 0 ? (
                  <tr>
                    <td colSpan="4">No weakness data yet.</td>
                  </tr>
                ) : (
                  weaknesses.map((item, index) => (
                    <tr key={`${item.concept}-${index}`}>
                      <td>{index + 1}</td>
                      <td>{item.concept}</td>
                      <td>{item.weakness_score}</td>
                      <td>{item.learning_priority}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </section>
        </>
      )}
    </PageShell>
  );
}
