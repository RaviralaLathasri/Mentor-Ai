import { useState, useEffect } from "react";
import { Sparkles, Calendar, BookOpen, Target, ExternalLink, ArrowRight, Briefcase } from "lucide-react";

import Notice from "../components/Notice";
import PageShell from "../components/PageShell";
import { careerApi } from "../services/api";

const ROLE_OPTIONS = ["Data Analyst", "Data Scientist", "AI Engineer", "Backend Developer"];
const LEVEL_OPTIONS = ["Beginner", "Intermediate", "Advanced"];
const DURATION_UNITS = ["weeks", "months"];

export default function CareerRoadmap() {
  const [form, setForm] = useState({
    role: "Data Analyst",
    level: "Beginner",
    durationValue: 6,
    durationUnit: "months",
  });
  const [loading, setLoading] = useState(false);
  const [roadmap, setRoadmap] = useState(null);
  const [notice, setNotice] = useState({ type: "info", message: "" });

  // Load existing roadmap from local storage on mount
  useEffect(() => {
    const stored = localStorage.getItem("mentor_career_roadmap");
    if (stored) {
      try {
        setRoadmap(JSON.parse(stored));
      } catch (e) {
        // ignore
      }
    }
  }, []);

  const updateField = (field) => (event) => {
    setForm((prev) => ({ ...prev, [field]: event.target.value }));
  };

  const buildDuration = () => {
    const value = Number(form.durationValue);
    const safeValue = Number.isFinite(value) ? Math.max(1, value) : 1;
    return `${safeValue} ${form.durationUnit}`;
  };

  const handleGenerate = async () => {
    setLoading(true);
    setNotice({ type: "info", message: "" });
    try {
      const result = await careerApi.generateRoadmap({
        role: form.role,
        level: form.level,
        duration: buildDuration(),
      });
      setRoadmap(result);
      localStorage.setItem("mentor_career_roadmap", JSON.stringify(result));
      setNotice({ type: "success", message: "Career roadmap generated successfully." });
    } catch (error) {
      setNotice({ type: "error", message: error.message });
    } finally {
      setLoading(false);
    }
  };

  const handleLoadLatest = async () => {
    setLoading(true);
    setNotice({ type: "info", message: "" });
    try {
      const result = await careerApi.getRoadmap(form.role, {
        duration: buildDuration(),
        level: form.level,
      });
      setRoadmap(result);
      localStorage.setItem("mentor_career_roadmap", JSON.stringify(result));
      setNotice({ type: "success", message: "Latest roadmap loaded." });
    } catch (error) {
      setNotice({ type: "error", message: error.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <PageShell
      title="Career Roadmap Generator"
      subtitle="Outline step-by-step career path projections, project lists, and skill targets matching your timelines."
    >
      <Notice type={notice.type} message={notice.message} />

      {/* Input panel */}
      <section className="bg-white border border-brand-border rounded-2xl p-6 shadow-soft space-y-5">
        <div className="flex items-center gap-2 pb-2 border-b border-brand-border/40">
          <Briefcase className="w-4.5 h-4.5 text-brand-primary" />
          <h3 className="text-base font-bold text-brand-textPrimary font-heading">Roadmap Inputs</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <label className="flex flex-col gap-1.5 text-xs font-semibold text-brand-textSecondary">
            Career Role
            <select value={form.role} onChange={updateField("role")}>
              {ROLE_OPTIONS.map((role) => (
                <option key={role} value={role}>
                  {role}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1.5 text-xs font-semibold text-brand-textSecondary">
            Complexity Level
            <select value={form.level} onChange={updateField("level")}>
              {LEVEL_OPTIONS.map((level) => (
                <option key={level} value={level}>
                  {level}
                </option>
              ))}
            </select>
          </label>

          <div className="grid grid-cols-2 gap-4">
            <label className="flex flex-col gap-1.5 text-xs font-semibold text-brand-textSecondary">
              Time Available
              <input
                type="number"
                min="1"
                value={form.durationValue}
                onChange={updateField("durationValue")}
              />
            </label>
            <label className="flex flex-col gap-1.5 text-xs font-semibold text-brand-textSecondary">
              Unit
              <select value={form.durationUnit} onChange={updateField("durationUnit")}>
                {DURATION_UNITS.map((unit) => (
                  <option key={unit} value={unit}>
                    {unit}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>

        <div className="pt-3 flex gap-2 justify-end border-t border-brand-border/40">
          <button type="button" className="btn-primary py-2 px-5" onClick={handleGenerate} disabled={loading}>
            <span>{loading ? "Generating..." : "Generate Roadmap"}</span>
            <Sparkles className="w-3.5 h-3.5" />
          </button>
          <button type="button" className="btn-secondary py-2 px-5" onClick={handleLoadLatest} disabled={loading}>
            {loading ? "Loading..." : "Load Latest"}
          </button>
        </div>
      </section>

      {roadmap ? (
        <div className="space-y-8">
          
          {/* Metadata banner */}
          <section className="bg-slate-50 border border-brand-border rounded-2xl p-5 flex flex-wrap gap-x-8 gap-y-2 text-xs">
            <div>
              <span className="text-brand-textSecondary font-semibold block uppercase tracking-wider text-[10px]">Target Role</span>
              <span className="text-brand-textPrimary font-bold text-sm font-heading">{roadmap.role}</span>
            </div>
            <div>
              <span className="text-brand-textSecondary font-semibold block uppercase tracking-wider text-[10px]">Assigned Tier</span>
              <span className="text-brand-textPrimary font-bold text-sm font-heading">{roadmap.level}</span>
            </div>
            <div>
              <span className="text-brand-textSecondary font-semibold block uppercase tracking-wider text-[10px]">Target Duration</span>
              <span className="text-brand-textPrimary font-bold text-sm font-heading">{roadmap.duration}</span>
            </div>
          </section>

          {/* Timeline Roadmap */}
          <section className="space-y-4">
            <div className="flex items-center gap-2">
              <Calendar className="w-5 h-5 text-brand-primary" />
              <h3 className="text-base font-bold text-brand-textPrimary font-heading">Timeline Roadmap Phases</h3>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {(roadmap.timeline || []).map((phase) => (
                <article key={phase.phase_title} className="bg-white border border-brand-border rounded-2xl p-5 shadow-soft space-y-4 hover:shadow-softHover hover:-translate-y-0.5 transition-saas">
                  <div>
                    <h4 className="text-sm font-bold text-brand-textPrimary font-heading">{phase.phase_title}</h4>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-brand-primary bg-brand-primaryLight px-2 py-0.5 rounded mt-1.5 inline-block">
                      Duration: {phase.duration_label}
                    </span>
                  </div>

                  <div className="space-y-3 pt-2 text-xs leading-relaxed">
                    <div>
                      <span className="font-semibold text-brand-textSecondary block mb-1">Learning Goals</span>
                      <ul className="list-disc list-inside space-y-0.5 text-brand-textSecondary pl-1">
                        {(phase.learning_goals || []).map((goal, index) => (
                          <li key={`${phase.phase_title}-g-${index}`}>{goal}</li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <span className="font-semibold text-brand-textSecondary block mb-1">Milestones Checklist</span>
                      <ul className="list-disc list-inside space-y-0.5 text-brand-textSecondary pl-1">
                        {(phase.milestones || []).map((milestone, index) => (
                          <li key={`${phase.phase_title}-m-${index}`}>{milestone}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </section>

          {/* Skills and Tools */}
          <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <article className="bg-white border border-brand-border rounded-2xl p-6 shadow-soft space-y-3">
              <h3 className="text-sm font-bold text-brand-textPrimary font-heading pb-2 border-b border-brand-border/40">
                Skills to Master
              </h3>
              <div className="flex flex-wrap gap-1.5 pt-1">
                {(roadmap.skills_to_master || []).map((skill) => (
                  <span key={skill} className="bg-slate-100 border border-brand-border text-brand-textPrimary px-2.5 py-1 rounded-full text-xs font-semibold">
                    {skill}
                  </span>
                ))}
              </div>
            </article>
            
            <article className="bg-white border border-brand-border rounded-2xl p-6 shadow-soft space-y-3">
              <h3 className="text-sm font-bold text-brand-textPrimary font-heading pb-2 border-b border-brand-border/40">
                Tools to Learn
              </h3>
              <div className="flex flex-wrap gap-1.5 pt-1">
                {(roadmap.tools || []).map((tool) => (
                  <span key={tool} className="bg-slate-100 border border-brand-border text-brand-textPrimary px-2.5 py-1 rounded-full text-xs font-semibold">
                    {tool}
                  </span>
                ))}
              </div>
            </article>
          </section>

          {/* Learning Resources */}
          <section className="bg-white border border-brand-border rounded-2xl p-6 shadow-soft space-y-4">
            <h3 className="text-base font-bold text-brand-textPrimary font-heading pb-2 border-b border-brand-border/40">
              Curated Learning Resources
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-xs">
              
              <div className="space-y-2">
                <h4 className="font-bold text-brand-primary uppercase tracking-wider text-[10px]">Academic Courses</h4>
                <ul className="space-y-2 leading-relaxed">
                  {(roadmap.courses || []).map((resource, index) => (
                    <li key={`crs-${index}`} className="flex items-start gap-1">
                      <a href={resource.link} target="_blank" rel="noreferrer" className="text-brand-textPrimary hover:text-brand-primary font-medium hover:underline inline-flex items-center gap-0.5">
                        <span>{resource.title}</span>
                        <ExternalLink className="w-3 h-3 shrink-0" />
                      </a>
                      <span className="text-brand-textSecondary text-[10px]">({resource.platform})</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="space-y-2">
                <h4 className="font-bold text-brand-secondary uppercase tracking-wider text-[10px]">YouTube Playlists</h4>
                <ul className="space-y-2 leading-relaxed">
                  {(roadmap.youtube_resources || []).map((resource, index) => (
                    <li key={`yt-${index}`}>
                      <a href={resource.link} target="_blank" rel="noreferrer" className="text-brand-textPrimary hover:text-brand-primary font-medium hover:underline inline-flex items-center gap-0.5">
                        <span>{resource.title}</span>
                        <ExternalLink className="w-3 h-3 shrink-0" />
                      </a>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="space-y-2">
                <h4 className="font-bold text-brand-accent uppercase tracking-wider text-[10px]">Core Documentation</h4>
                <ul className="space-y-2 leading-relaxed">
                  {(roadmap.documentation || []).map((resource, index) => (
                    <li key={`doc-${index}`}>
                      <a href={resource.link} target="_blank" rel="noreferrer" className="text-brand-textPrimary hover:text-brand-primary font-medium hover:underline inline-flex items-center gap-0.5">
                        <span>{resource.title}</span>
                        <ExternalLink className="w-3 h-3 shrink-0" />
                      </a>
                    </li>
                  ))}
                </ul>
              </div>

            </div>
          </section>

          {/* Projects to Build */}
          <section className="bg-white border border-brand-border rounded-2xl p-6 shadow-soft space-y-4">
            <h3 className="text-base font-bold text-brand-textPrimary font-heading pb-2 border-b border-brand-border/40 flex items-center gap-1.5">
              <Target className="w-4.5 h-4.5 text-brand-primary" />
              <span>Project Building Assignments</span>
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-xs">
              <div className="p-4 bg-slate-50 border border-brand-border/60 rounded-xl space-y-2">
                <h4 className="font-bold text-brand-primary uppercase tracking-wider text-[10px]">Beginner Level</h4>
                <ul className="list-disc list-inside text-brand-textSecondary space-y-1 pl-0.5 leading-relaxed">
                  {(roadmap.projects?.beginner || []).map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>

              <div className="p-4 bg-slate-50 border border-brand-border/60 rounded-xl space-y-2">
                <h4 className="font-bold text-brand-secondary uppercase tracking-wider text-[10px]">Intermediate Level</h4>
                <ul className="list-disc list-inside text-brand-textSecondary space-y-1 pl-0.5 leading-relaxed">
                  {(roadmap.projects?.intermediate || []).map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>

              <div className="p-4 bg-slate-50 border border-brand-border/60 rounded-xl space-y-2">
                <h4 className="font-bold text-brand-accent uppercase tracking-wider text-[10px]">Advanced Level</h4>
                <ul className="list-disc list-inside text-brand-textSecondary space-y-1 pl-0.5 leading-relaxed">
                  {(roadmap.projects?.advanced || []).map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
            </div>
          </section>

          {/* Certifications & Interview Prep */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            <section className="bg-white border border-brand-border rounded-2xl p-6 shadow-soft space-y-3">
              <h3 className="text-sm font-bold text-brand-textPrimary font-heading pb-2 border-b border-brand-border/40">
                Recommended Certifications
              </h3>
              <ul className="list-disc list-inside text-xs text-brand-textSecondary space-y-1.5 pl-1 leading-relaxed">
                {(roadmap.certifications || []).map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </section>

            <section className="bg-white border border-brand-border rounded-2xl p-6 shadow-soft space-y-4">
              <h3 className="text-sm font-bold text-brand-textPrimary font-heading pb-2 border-b border-brand-border/40">
                Interview Preparation targets
              </h3>
              <div className="space-y-3 text-xs leading-relaxed">
                <div>
                  <span className="font-semibold text-brand-textSecondary block mb-0.5">Key topics to prepare</span>
                  <p className="text-brand-textPrimary font-medium">
                    {(roadmap.interview_preparation?.important_topics || []).join(" | ")}
                  </p>
                </div>
                <div>
                  <span className="font-semibold text-brand-textSecondary block mb-0.5">Practice channels</span>
                  <p className="text-brand-textPrimary font-medium">
                    {(roadmap.interview_preparation?.practice_platforms || []).join(" | ")}
                  </p>
                </div>
                <div>
                  <span className="font-semibold text-brand-textSecondary block mb-1">Sample assessment prompts</span>
                  <ul className="list-disc list-inside space-y-0.5 text-brand-textSecondary pl-1">
                    {(roadmap.interview_preparation?.sample_questions || []).map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </section>

          </div>

          {/* Portfolio & Career Advice */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <section className="bg-white border border-brand-border rounded-2xl p-6 shadow-soft space-y-3">
              <h3 className="text-sm font-bold text-brand-textPrimary font-heading pb-2 border-b border-brand-border/40">
                Portfolio Development Advice
              </h3>
              <ul className="list-disc list-inside text-xs text-brand-textSecondary space-y-1.5 pl-1 leading-relaxed">
                {(roadmap.portfolio_tips || []).map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </section>
            
            <section className="bg-white border border-brand-border rounded-2xl p-6 shadow-soft space-y-3">
              <h3 className="text-sm font-bold text-brand-textPrimary font-heading pb-2 border-b border-brand-border/40">
                General Career Mentorship
              </h3>
              <ul className="list-disc list-inside text-xs text-brand-textSecondary space-y-1.5 pl-1 leading-relaxed">
                {(roadmap.career_advice || []).map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </section>
          </div>

        </div>
      ) : null}
    </PageShell>
  );
}
