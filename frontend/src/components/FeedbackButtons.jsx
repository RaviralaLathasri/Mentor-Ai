const FEEDBACK_OPTIONS = [
  { key: "helpful", label: "Helpful" },
  { key: "too_easy", label: "Too Easy" },
  { key: "too_hard", label: "Too Hard" },
  { key: "unclear", label: "Unclear" },
];

export default function FeedbackButtons({ disabled, onSubmit, selected }) {
  return (
    <div className="feedback-buttons">
      {FEEDBACK_OPTIONS.map((item) => (
        <button
          key={item.key}
          type="button"
          className={`feedback-btn ${selected === item.key ? "selected" : ""}`}
          disabled={disabled}
          onClick={() => onSubmit(item.key)}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}
