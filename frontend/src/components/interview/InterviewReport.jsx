export default function InterviewReport({ report }) {
  if (!report) return null;

  return (
    <div className="report-grid">
      <p>
        <strong>Total Score:</strong> {report.total_score} / 10
      </p>
      <p>
        <strong>Technical Knowledge:</strong> {report.technical_knowledge_score} / 10
      </p>
      <p>
        <strong>Communication:</strong> {report.communication_score} / 10
      </p>

      <p>
        <strong>Strengths:</strong> {(report.strengths || []).join(" | ") || "n/a"}
      </p>
      <p>
        <strong>Weaknesses:</strong> {(report.weaknesses || []).join(" | ") || "n/a"}
      </p>
      <p>
        <strong>Improvement Suggestions:</strong> {(report.improvement_suggestions || []).join(" | ") || "n/a"}
      </p>
    </div>
  );
}

