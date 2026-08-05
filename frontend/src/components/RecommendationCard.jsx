export default function RecommendationCard({ recommendation }) {
  const priority = (recommendation.priority || "low").toLowerCase();

  const priorityStyles = {
    high: {
      border: "border-l-4 border-l-status-danger",
      pill: "bg-red-50 text-red-700 border border-red-150",
    },
    medium: {
      border: "border-l-4 border-l-status-warning",
      pill: "bg-amber-50 text-amber-700 border border-amber-150",
    },
    low: {
      border: "border-l-4 border-l-status-success",
      pill: "bg-emerald-50 text-emerald-700 border border-emerald-150",
    },
  };

  const currentStyle = priorityStyles[priority] || priorityStyles.low;

  return (
    <article className={`bg-white border border-brand-border rounded-2xl shadow-soft hover:shadow-softHover hover:-translate-y-0.5 transition-saas p-5 ${currentStyle.border}`}>
      <div className="flex items-center gap-2 mb-3">
        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${currentStyle.pill}`}>
          {priority}
        </span>
        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider bg-blue-50 text-blue-700 border border-blue-150">
          {recommendation.recommendation_type || recommendation.type}
        </span>
      </div>
      
      <div className="space-y-3">
        <div>
          <h4 className="text-xs font-semibold text-brand-textMuted uppercase tracking-wider">Suggested Action</h4>
          <p className="text-sm font-medium text-brand-textPrimary mt-1">
            {recommendation.suggested_action || recommendation.action || "No action provided."}
          </p>
        </div>
        <div>
          <h4 className="text-xs font-semibold text-brand-textMuted uppercase tracking-wider">Explanation</h4>
          <p className="text-xs font-normal text-brand-textSecondary mt-1 leading-relaxed">
            {recommendation.explanation || recommendation.reason || "No explanation available."}
          </p>
        </div>
      </div>
    </article>
  );
}
