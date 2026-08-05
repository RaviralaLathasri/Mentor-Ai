import { Award, CheckCircle, AlertTriangle, Lightbulb } from "lucide-react";

export default function InterviewReport({ report }) {
  if (!report) return null;

  return (
    <div className="space-y-6">
      
      {/* Score Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 bg-brand-primaryLight/40 border border-brand-primary/10 rounded-xl text-center">
          <Award className="w-6 h-6 text-brand-primary mx-auto mb-1" />
          <span className="text-[10px] uppercase font-bold text-brand-textSecondary block">Total Score</span>
          <span className="text-xl font-extrabold text-brand-primary">{report.total_score} / 10</span>
        </div>
        <div className="p-4 bg-blue-50/50 border border-blue-150 rounded-xl text-center">
          <span className="text-[10px] uppercase font-bold text-brand-textSecondary block">Technical Score</span>
          <span className="text-xl font-extrabold text-blue-700">{report.technical_knowledge_score} / 10</span>
        </div>
        <div className="p-4 bg-emerald-50/50 border border-emerald-150 rounded-xl text-center">
          <span className="text-[10px] uppercase font-bold text-brand-textSecondary block">Communication Score</span>
          <span className="text-xl font-extrabold text-emerald-700">{report.communication_score} / 10</span>
        </div>
      </div>

      {/* Bullets lists */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        <section className="bg-slate-50 border border-brand-border rounded-xl p-4 space-y-2">
          <h4 className="text-xs font-bold text-brand-accent flex items-center gap-1.5 uppercase tracking-wider">
            <CheckCircle className="w-4 h-4 shrink-0" />
            <span>Key Strengths</span>
          </h4>
          <ul className="list-disc list-inside text-xs text-brand-textSecondary space-y-1 pl-1">
            {(report.strengths || []).map((str, idx) => (
              <li key={`str-${idx}`} className="leading-relaxed">{str}</li>
            ))}
          </ul>
        </section>

        <section className="bg-slate-50 border border-brand-border rounded-xl p-4 space-y-2">
          <h4 className="text-xs font-bold text-status-danger flex items-center gap-1.5 uppercase tracking-wider">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>Gaps identified</span>
          </h4>
          <ul className="list-disc list-inside text-xs text-brand-textSecondary space-y-1 pl-1">
            {(report.weaknesses || []).map((wk, idx) => (
              <li key={`wk-${idx}`} className="leading-relaxed">{wk}</li>
            ))}
          </ul>
        </section>

      </div>

      <section className="bg-brand-primaryLight/20 border border-brand-primary/10 rounded-xl p-4 space-y-2">
        <h4 className="text-xs font-bold text-brand-primary flex items-center gap-1.5 uppercase tracking-wider">
          <Lightbulb className="w-4 h-4 shrink-0" />
          <span>Socratic Recommendations</span>
        </h4>
        <ul className="list-disc list-inside text-xs text-brand-textSecondary space-y-1.5 pl-1 leading-relaxed">
          {(report.improvement_suggestions || []).map((imp, idx) => (
            <li key={`imp-${idx}`}>{imp}</li>
          ))}
        </ul>
      </section>

    </div>
  );
}
