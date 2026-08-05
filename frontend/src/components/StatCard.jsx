export default function StatCard({ title, value, hint }) {
  return (
    <article className="bg-white border border-brand-border rounded-2xl shadow-soft hover:shadow-softHover hover:-translate-y-0.5 transition-saas p-5 flex flex-col justify-between min-h-[110px]">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-brand-textSecondary">{title}</p>
        <p className="text-2xl font-bold mt-2 text-brand-textPrimary font-heading">{value}</p>
      </div>
      {hint && (
        <p className="text-xs text-brand-textMuted mt-1.5 font-normal">{hint}</p>
      )}
    </article>
  );
}
