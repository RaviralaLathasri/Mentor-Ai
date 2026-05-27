import { useEffect, useState } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

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
    <PageShell title="Weakness Analyzer" subtitle="Take quick quizzes and track concept weaknesses automatically.">
      <StudentBanner studentId={studentId} onClear={clearStudent} />
      <Notice type={notice.type} message={notice.message} />

      {!studentId ? (
        <section className="panel">
          <p>Create or load a student profile before using the analyzer.</p>
        </section>
      ) : (
        <>
          <section className="panel chart-panel">
            <div className="section-header-inline">
              <h3>Weakest Concept Graph</h3>
              <button
                type="button"
                className="secondary-btn"
                onClick={() => loadWeaknesses(studentId)}
                disabled={loadingWeaknesses}
              >
                {loadingWeaknesses ? "Refreshing..." : "Refresh"}
              </button>
            </div>
            {weaknesses.length === 0 ? <p>No weakness data yet. Take one quiz below to start tracking.</p> : null}
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

          <section className="panel form-grid">
            <h3>Take Quiz</h3>
            <label>
              Preferred Concept (optional)
              <input
                name="quiz_concept"
                value={quizConcept}
                onChange={(event) => setQuizConcept(event.target.value)}
                placeholder="e.g., machine learning"
              />
            </label>
            <div className="button-row full-width">
              <button type="button" className="secondary-btn" onClick={requestQuizQuestion} disabled={loadingQuestion}>
                {loadingQuestion ? "Generating..." : "Get Question"}
              </button>
            </div>
          </section>

          {activeQuestion ? (
            <form className="panel form-grid" onSubmit={submitAttempt}>
              <h3>Answer Question</h3>
              <label>
                Concept
                <input name="concept_name" value={activeQuestion.concept_name} readOnly />
              </label>

              <label className="full-width">
                Quiz Question
                <textarea value={activeQuestion.question} rows="3" readOnly />
              </label>

              <label>
                Your Answer
                <textarea
                  name="student_answer"
                  value={studentAnswer}
                  onChange={(event) => setStudentAnswer(event.target.value)}
                  rows="3"
                  placeholder="Type your answer here"
                  required
                />
              </label>

              <div className="button-row full-width">
                <button type="submit" className="primary-btn" disabled={submittingAttempt}>
                  {submittingAttempt ? "Checking..." : "Submit Answer"}
                </button>
                <button type="button" className="secondary-btn" onClick={requestQuizQuestion} disabled={loadingQuestion}>
                  {loadingQuestion ? "Generating..." : "Next Question"}
                </button>
              </div>
            </form>
          ) : null}

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
                  <strong>Result:</strong> {result.is_correct ? "Correct" : "Incorrect"}
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
              {activeQuestion ? (
                <p>
                  <strong>Reference Answer:</strong> {activeQuestion.reference_answer}
                </p>
              ) : null}
            </section>
          ) : null}
        </>
      )}
    </PageShell>
  );
}
