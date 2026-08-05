const FEEDBACK_OPTIONS = [
  { key: "helpful", label: "Helpful" },
  { key: "too_easy", label: "Too Easy" },
  { key: "too_hard", label: "Too Hard" },
  { key: "unclear", label: "Unclear" },
];

export default function FeedbackButtons({ disabled, onSubmit, selected }) {
  return (
    <div className="flex flex-wrap gap-2">
      {FEEDBACK_OPTIONS.map((item) => {
        const isSelected = selected === item.key;
        return (
          <button
            key={item.key}
            type="button"
            className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-saas ${
              isSelected
                ? "bg-brand-primaryLight border-brand-primary text-brand-primary"
                : "bg-white border-brand-border text-brand-textSecondary hover:bg-brand-hoverBg hover:text-brand-textPrimary"
            }`}
            disabled={disabled}
            onClick={() => onSubmit(item.key)}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
}
