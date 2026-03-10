import { useState } from "react";

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
      subtitle="Generate a practical, phase-by-phase learning plan for your target career role."
    >
      <Notice type={notice.type} message={notice.message} />

      <section className="panel form-grid">
        <h3>Roadmap Inputs</h3>
        <div className="grid three">
          <label>
            Career Role
            <select value={form.role} onChange={updateField("role")}>
              {ROLE_OPTIONS.map((role) => (
                <option key={role} value={role}>
                  {role}
                </option>
              ))}
            </select>
          </label>

          <label>
            Level
            <select value={form.level} onChange={updateField("level")}>
              {LEVEL_OPTIONS.map((level) => (
                <option key={level} value={level}>
                  {level}
                </option>
              ))}
            </select>
          </label>

          <div className="grid two">
            <label>
              Time Available
              <input
                type="number"
                min="1"
                value={form.durationValue}
                onChange={updateField("durationValue")}
              />
            </label>
            <label>
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

        <div className="button-row">
          <button type="button" className="primary-btn" onClick={handleGenerate} disabled={loading}>
            {loading ? "Generating..." : "Generate Roadmap"}
          </button>
          <button type="button" className="secondary-btn" onClick={handleLoadLatest} disabled={loading}>
            {loading ? "Loading..." : "Load Latest by Role"}
          </button>
        </div>
      </section>

      {!roadmap ? null : (
        <>
          <section className="panel">
            <div className="grid three">
              <p>
                <strong>Role:</strong> {roadmap.role}
              </p>
              <p>
                <strong>Level:</strong> {roadmap.level}
              </p>
              <p>
                <strong>Duration:</strong> {roadmap.duration}
              </p>
            </div>
          </section>

          <section className="panel">
            <h3>Timeline Roadmap</h3>
            <div className="grid two">
              {(roadmap.timeline || []).map((phase) => (
                <article key={phase.phase_title} className="recommendation-card">
                  <h4>{phase.phase_title}</h4>
                  <p>
                    <strong>Duration:</strong> {phase.duration_label}
                  </p>
                  <p>
                    <strong>Learning Goals:</strong>
                  </p>
                  <ul>
                    {(phase.learning_goals || []).map((goal) => (
                      <li key={`${phase.phase_title}-${goal}`}>{goal}</li>
                    ))}
                  </ul>
                  <p>
                    <strong>Milestones:</strong>
                  </p>
                  <ul>
                    {(phase.milestones || []).map((milestone) => (
                      <li key={`${phase.phase_title}-${milestone}`}>{milestone}</li>
                    ))}
                  </ul>
                </article>
              ))}
            </div>
          </section>

          <section className="panel">
            <h3>Skills and Tools</h3>
            <div className="grid two">
              <div>
                <h4>Skills to Master</h4>
                <ul>
                  {(roadmap.skills_to_master || []).map((skill) => (
                    <li key={skill}>{skill}</li>
                  ))}
                </ul>
              </div>
              <div>
                <h4>Tools to Learn</h4>
                <ul>
                  {(roadmap.tools || []).map((tool) => (
                    <li key={tool}>{tool}</li>
                  ))}
                </ul>
              </div>
            </div>
          </section>

          <section className="panel">
            <h3>Learning Resources</h3>
            <div className="grid three">
              <div>
                <h4>Courses</h4>
                <ul>
                  {(roadmap.courses || []).map((resource) => (
                    <li key={resource.link}>
                      <a href={resource.link} target="_blank" rel="noreferrer">
                        {resource.title}
                      </a>{" "}
                      ({resource.platform})
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <h4>YouTube</h4>
                <ul>
                  {(roadmap.youtube_resources || []).map((resource) => (
                    <li key={resource.link}>
                      <a href={resource.link} target="_blank" rel="noreferrer">
                        {resource.title}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <h4>Documentation</h4>
                <ul>
                  {(roadmap.documentation || []).map((resource) => (
                    <li key={resource.link}>
                      <a href={resource.link} target="_blank" rel="noreferrer">
                        {resource.title}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </section>

          <section className="panel">
            <h3>Projects to Build</h3>
            <div className="grid three">
              <div>
                <h4>Beginner</h4>
                <ul>
                  {(roadmap.projects?.beginner || []).map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
              <div>
                <h4>Intermediate</h4>
                <ul>
                  {(roadmap.projects?.intermediate || []).map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
              <div>
                <h4>Advanced</h4>
                <ul>
                  {(roadmap.projects?.advanced || []).map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
            </div>
          </section>

          <section className="panel">
            <h3>Certifications</h3>
            <ul>
              {(roadmap.certifications || []).map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </section>

          <section className="panel">
            <h3>Interview Preparation</h3>
            <div className="grid three">
              <div>
                <h4>Important Topics</h4>
                <ul>
                  {(roadmap.interview_preparation?.important_topics || []).map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
              <div>
                <h4>Practice Platforms</h4>
                <ul>
                  {(roadmap.interview_preparation?.practice_platforms || []).map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
              <div>
                <h4>Sample Questions</h4>
                <ul>
                  {(roadmap.interview_preparation?.sample_questions || []).map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
            </div>
          </section>

          <section className="panel">
            <h3>Portfolio Tips</h3>
            <ul>
              {(roadmap.portfolio_tips || []).map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </section>

          <section className="panel">
            <h3>Career Advice</h3>
            <ul>
              {(roadmap.career_advice || []).map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </section>
        </>
      )}
    </PageShell>
  );
}
