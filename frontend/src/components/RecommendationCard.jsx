const priorityClass = {
  high: "priority-high",
  medium: "priority-medium",
  low: "priority-low",
};

export default function RecommendationCard({ recommendation }) {
  const priority = (recommendation.priority || "low").toLowerCase();

  return (
    <article className={`recommendation-card ${priorityClass[priority] || "priority-low"}`}>
      <div className="recommendation-meta">
        <span className="pill">Priority: {priority}</span>
        <span className="pill">Type: {recommendation.recommendation_type || recommendation.type}</span>
      </div>
      <h4>Suggested Action</h4>
      <p>{recommendation.suggested_action || recommendation.action || "No action provided."}</p>
      <h4>Explanation</h4>
      <p>{recommendation.explanation || recommendation.reason || "No explanation available."}</p>
    </article>
  );
}
