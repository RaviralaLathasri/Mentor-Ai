import { useState } from "react";

import Notice from "../components/Notice";
import PageShell from "../components/PageShell";
import StudentBanner from "../components/StudentBanner";
import useStudentId from "../hooks/useStudentId";
import { resumeApi } from "../services/api";

export default function ResumeMentor() {
  const [studentId, setStudentId] = useStudentId();
  const [resumeFile, setResumeFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState({ type: "info", message: "" });
  const [analysis, setAnalysis] = useState(null);

  const clearStudent = () => {
    setStudentId(null);
    setAnalysis(null);
    setResumeFile(null);
  };

  const submitResume = async (event) => {
    event.preventDefault();
    if (!resumeFile) {
      setNotice({ type: "error", message: "Select a resume file first." });
      return;
    }

    setLoading(true);
    try {
      const result = await resumeApi.analyze(resumeFile, studentId || undefined);
      setAnalysis(result);
      setNotice({ type: "success", message: "Resume analyzed with mentoring suggestions." });
    } catch (error) {
      setNotice({ type: "error", message: error.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <PageShell
      title="Resume Mentor"
      subtitle="Upload your resume and get Socratic mentoring to strengthen impact, skills, and structure."
    >
      <StudentBanner studentId={studentId} onClear={clearStudent} />
      <Notice type={notice.type} message={notice.message} />

      <form className="panel form-grid" onSubmit={submitResume}>
        <h3>Upload Resume</h3>
        <label>
          Resume File (.pdf, .docx, .txt, .md)
          <input
            type="file"
            accept=".pdf,.docx,.txt,.md"
            onChange={(event) => setResumeFile(event.target.files?.[0] || null)}
            required
          />
        </label>
        <small>Mentor output focuses on weak bullet points, missing skills, unclear achievements, and structure gaps.</small>
        <div className="button-row full-width">
          <button type="submit" className="primary-btn" disabled={loading}>
            {loading ? "Analyzing..." : "Analyze Resume"}
          </button>
        </div>
      </form>

      {analysis ? (
        <>
          <section className="panel">
            <h3>Overall Review</h3>
            <p>
              <strong>File:</strong> {analysis.file_name}
            </p>
            <p>
              <strong>Assessment:</strong> {analysis.overall_assessment}
            </p>
            <p>
              <strong>Resume Score:</strong> {typeof analysis.resume_score === "number" ? `${analysis.resume_score} / 100` : "N/A"}
            </p>
            {analysis.missing_sections?.length ? (
              <p>
                <strong>Missing Sections:</strong> {analysis.missing_sections.join(", ")}
              </p>
            ) : (
              <p>
                <strong>Missing Sections:</strong> None
              </p>
            )}
          </section>

          <section className="panel">
            <h3>Keyword Analysis</h3>
            <p>
              <strong>Detected Keywords:</strong>{" "}
              {analysis.detected_keywords?.length ? analysis.detected_keywords.join(", ") : "None"}
            </p>
            <p>
              <strong>Missing Keywords:</strong>{" "}
              {analysis.missing_keywords?.length ? analysis.missing_keywords.join(", ") : "None"}
            </p>
          </section>

          <section className="panel">
            <h3>Improvement Suggestions</h3>
            {(analysis.improvement_suggestions || []).length ? (
              <ul>
                {(analysis.improvement_suggestions || []).map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            ) : (
              <p>No additional improvement suggestions.</p>
            )}
          </section>

          <section className="panel">
            <h3>Strengths</h3>
            <ul>
              {(analysis.strengths || []).map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </section>

          <section className="panel">
            <h3>Weaknesses</h3>
            <ul>
              {(analysis.weaknesses || []).map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </section>

          <section className="panel">
            <h3>Socratic Mentoring Advice</h3>
            <ul>
              {(analysis.mentoring_advice || []).map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </section>

          <section className="panel">
            <h3>Section Analysis</h3>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Section</th>
                  <th>Score</th>
                  <th>Findings</th>
                  <th>Socratic Questions</th>
                </tr>
              </thead>
              <tbody>
                {(analysis.section_analysis || []).map((section) => (
                  <tr key={section.section_name}>
                    <td>{section.section_name}</td>
                    <td>{section.score}</td>
                    <td>{(section.findings || []).join(" | ")}</td>
                    <td>{(section.mentoring_questions || []).join(" | ")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        </>
      ) : null}
    </PageShell>
  );
}
