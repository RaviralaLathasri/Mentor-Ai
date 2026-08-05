import { useState, useEffect } from "react";
import { UploadCloud, FileText, CheckCircle, AlertTriangle, Sparkles, PlusCircle } from "lucide-react";

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

  // Load latest analysis from local storage on mount
  useEffect(() => {
    const stored = localStorage.getItem("mentor_resume_analysis");
    if (stored) {
      try {
        setAnalysis(JSON.parse(stored));
      } catch (e) {
        // ignore
      }
    }
  }, []);

  const clearStudent = () => {
    setStudentId(null);
    setAnalysis(null);
    setResumeFile(null);
    localStorage.removeItem("mentor_resume_analysis");
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
      localStorage.setItem("mentor_resume_analysis", JSON.stringify(result));
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
      subtitle="Upload your resume to retrieve detailed Socratic mentoring guidelines, keyword mappings, and score breakdowns."
    >
      <StudentBanner studentId={studentId} onClear={clearStudent} />
      <Notice type={notice.type} message={notice.message} />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 sm:gap-8 items-start">
        
        {/* Upload Column */}
        <div className="space-y-6">
          <form className="bg-white border border-brand-border rounded-2xl p-5 sm:p-6 shadow-soft space-y-4" onSubmit={submitResume}>
            <div className="pb-2 border-b border-brand-border/40">
              <h3 className="text-sm sm:text-base font-bold text-brand-textPrimary font-heading">Upload Resume</h3>
            </div>
            
            <div className="border-2 border-dashed border-brand-border hover:border-brand-primary rounded-2xl p-6 text-center cursor-pointer transition-saas relative">
              <input
                type="file"
                accept=".pdf,.docx,.txt,.md"
                onChange={(event) => setResumeFile(event.target.files?.[0] || null)}
                required
                className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
              />
              <UploadCloud className="w-10 h-10 text-brand-textMuted mx-auto mb-2" />
              {resumeFile ? (
                <div className="space-y-1">
                  <p className="text-xs font-semibold text-brand-primary truncate">{resumeFile.name}</p>
                  <p className="text-[10px] text-brand-textSecondary">Ready to analyze</p>
                </div>
              ) : (
                <div className="space-y-1">
                  <p className="text-xs font-semibold text-brand-textPrimary">Select Resume File</p>
                  <p className="text-[10px] text-brand-textSecondary">Accepts PDF, DOCX, TXT, MD</p>
                </div>
              )}
            </div>

            <p className="text-[10px] text-brand-textSecondary leading-normal">
              Analysis identifies structural gaps, weak bullets, Socratic improvements, and industry alignment.
            </p>

            <button type="submit" className="btn-primary w-full py-2.5" disabled={loading}>
              {loading ? "Analyzing..." : "Analyze Resume"}
            </button>
          </form>

          {analysis && (
            <article className="bg-white border border-brand-border rounded-2xl p-5 sm:p-6 shadow-soft space-y-4">
              <h3 className="text-sm font-bold text-brand-textPrimary font-heading flex items-center gap-1.5 pb-2 border-b border-brand-border/40">
                <CheckCircle className="w-4 h-4 text-brand-accent" />
                <span>Overall Assessment</span>
              </h3>
              <div className="space-y-3 text-xs leading-relaxed">
                <div>
                  <span className="font-semibold text-brand-textSecondary block">Uploaded File</span>
                  <span className="text-brand-textPrimary font-medium">{analysis.file_name}</span>
                </div>
                <div>
                  <span className="font-semibold text-brand-textSecondary block">Resume Score</span>
                  <span className="text-xl font-bold text-brand-primary">{analysis.resume_score} / 100</span>
                </div>
                <div>
                  <span className="font-semibold text-brand-textSecondary block">Summary Assessment</span>
                  <span className="text-brand-textPrimary">{analysis.overall_assessment}</span>
                </div>
                {analysis.missing_sections?.length > 0 && (
                  <div>
                    <span className="font-semibold text-brand-textSecondary block">Missing Sections</span>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {analysis.missing_sections.map(sec => (
                        <span key={sec} className="bg-red-50 text-red-700 px-2 py-0.5 rounded text-[10px] font-bold border border-red-100">
                          {sec}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </article>
          )}
        </div>

        {/* Results Columns */}
        <div className="lg:col-span-2 space-y-6">
          {analysis ? (
            <>
              {/* Keyword Analysis */}
              <section className="bg-white border border-brand-border rounded-2xl p-5 sm:p-6 shadow-soft space-y-4">
                <h3 className="text-sm sm:text-base font-bold text-brand-textPrimary font-heading pb-2 border-b border-brand-border/40">
                  Keyword Alignment
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs leading-relaxed">
                  <div className="space-y-1.5">
                    <h4 className="font-semibold text-brand-accent">Detected Keywords</h4>
                    {analysis.detected_keywords?.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {analysis.detected_keywords.map((kw) => (
                          <span key={kw} className="bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded text-[10px] font-medium border border-emerald-100">
                            {kw}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <p className="text-brand-textMuted italic">No core keywords detected.</p>
                    )}
                  </div>
                  <div className="space-y-1.5">
                    <h4 className="font-semibold text-status-warning">Missing Key Terms</h4>
                    {analysis.missing_keywords?.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {analysis.missing_keywords.map((kw) => (
                          <span key={kw} className="bg-amber-50 text-amber-700 px-2 py-0.5 rounded text-[10px] font-medium border border-amber-100">
                            {kw}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <p className="text-brand-textMuted italic">No missing keywords identified.</p>
                    )}
                  </div>
                </div>
              </section>

              {/* Strengths & Weaknesses */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <section className="bg-white border border-brand-border rounded-2xl p-5 sm:p-6 shadow-soft space-y-3">
                  <h3 className="text-sm font-bold text-brand-textPrimary font-heading pb-2 border-b border-brand-border/40">
                    Strengths
                  </h3>
                  <ul className="list-disc list-inside text-xs text-brand-textSecondary space-y-2 pl-1 leading-relaxed">
                    {(analysis.strengths || []).map((str) => (
                      <li key={str}>{str}</li>
                    ))}
                  </ul>
                </section>
                
                <section className="bg-white border border-brand-border rounded-2xl p-5 sm:p-6 shadow-soft space-y-3">
                  <h3 className="text-sm font-bold text-brand-textPrimary font-heading pb-2 border-b border-brand-border/40">
                    Weakness Gaps
                  </h3>
                  <ul className="list-disc list-inside text-xs text-brand-textSecondary space-y-2 pl-1 leading-relaxed">
                    {(analysis.weaknesses || []).map((weak) => (
                      <li key={weak}>{weak}</li>
                    ))}
                  </ul>
                </section>
              </div>

              {/* Suggestions & Advice */}
              <section className="bg-white border border-brand-border rounded-2xl p-5 sm:p-6 shadow-soft space-y-4">
                <h3 className="text-sm sm:text-base font-bold text-brand-textPrimary font-heading pb-2 border-b border-brand-border/40">
                  Socratic Mentoring Advice
                </h3>
                <div className="space-y-4 text-xs leading-relaxed">
                  <div className="space-y-1">
                    <h4 className="font-semibold text-brand-primary">Mentoring Action Items</h4>
                    <ul className="list-disc list-inside text-brand-textSecondary space-y-1.5 pl-1">
                      {(analysis.mentoring_advice || []).map((adv) => (
                        <li key={adv}>{adv}</li>
                      ))}
                    </ul>
                  </div>
                  
                  {analysis.improvement_suggestions?.length > 0 && (
                    <div className="space-y-1 pt-3 border-t border-brand-border/40">
                      <h4 className="font-semibold text-brand-textPrimary">Structural Improvement Steps</h4>
                      <ul className="list-disc list-inside text-brand-textSecondary space-y-1.5 pl-1">
                        {analysis.improvement_suggestions.map((imp) => (
                          <li key={imp}>{imp}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </section>

              {/* Section Analysis Breakdown (Responsive table/card stack) */}
              <section className="bg-white border border-brand-border rounded-2xl p-5 sm:p-6 shadow-soft space-y-4">
                <h3 className="text-sm sm:text-base font-bold text-brand-textPrimary font-heading pb-2 border-b border-brand-border/40">
                  Section Analysis Breakdown
                </h3>
                
                {/* Desktop/Tablet Table */}
                <div className="hidden sm:block overflow-x-auto border border-brand-border rounded-xl">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b border-brand-border">
                        <th className="p-3 font-semibold text-brand-textSecondary">Section Name</th>
                        <th className="p-3 font-semibold text-brand-textSecondary text-center w-20">Score</th>
                        <th className="p-3 font-semibold text-brand-textSecondary">Findings</th>
                        <th className="p-3 font-semibold text-brand-textSecondary">Socratic Challenges</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 leading-normal">
                      {(analysis.section_analysis || []).map((sec) => (
                        <tr key={sec.section_name} className="hover:bg-slate-50/50">
                          <td className="p-3 font-semibold text-brand-textPrimary">{sec.section_name}</td>
                          <td className="p-3 text-center font-bold text-brand-primary">{sec.score}</td>
                          <td className="p-3 text-brand-textSecondary text-[11px] max-w-[200px]">
                            {(sec.findings || []).join(" | ")}
                          </td>
                          <td className="p-3 text-brand-primary text-[11px] italic font-medium">
                            {(sec.mentoring_questions || []).join(" | ")}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Mobile Card Stack */}
                <div className="sm:hidden space-y-3">
                  {(analysis.section_analysis || []).map((sec) => (
                    <div key={sec.section_name} className="bg-slate-50 border border-brand-border rounded-xl p-4 space-y-2 text-xs">
                      <div className="flex justify-between items-center pb-2 border-b border-brand-border/40">
                        <span className="font-bold text-brand-textPrimary">{sec.section_name}</span>
                        <span className="font-bold text-brand-primary">Score: {sec.score}</span>
                      </div>
                      <div className="space-y-1 pt-1">
                        <span className="text-[10px] uppercase font-bold text-brand-textSecondary block">Findings</span>
                        <p className="text-brand-textSecondary leading-relaxed">
                          {(sec.findings || []).join(" | ") || "No findings recorded."}
                        </p>
                      </div>
                      <div className="space-y-1 pt-1.5 border-t border-brand-border/20">
                        <span className="text-[10px] uppercase font-bold text-brand-primary block">Socratic Challenge</span>
                        <p className="text-brand-primary font-medium italic leading-relaxed">
                          {(sec.mentoring_questions || []).join(" | ") || "No mentoring prompts."}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>

              </section>
            </>
          ) : (
            <section className="bg-slate-50 border border-dashed border-brand-border rounded-2xl p-16 text-center text-brand-textMuted py-24 space-y-2">
              <FileText className="w-12 h-12 text-brand-textMuted/45 mx-auto" />
              <h4 className="text-base font-bold uppercase tracking-wider text-brand-textSecondary">Awaiting Resume Upload</h4>
              <p className="text-xs text-brand-textSecondary max-w-xs mx-auto leading-relaxed">
                Add your resume file in the left panel to trigger analysis and view detailed scoring, missing keywords, and strengths.
              </p>
            </section>
          )}
        </div>

      </div>
    </PageShell>
  );
}
