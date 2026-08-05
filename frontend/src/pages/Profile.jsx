import { useEffect, useState } from "react";
import { UserCheck, Award, Target, BookOpen, AlertTriangle } from "lucide-react";

import Notice from "../components/Notice";
import PageShell from "../components/PageShell";
import StudentBanner from "../components/StudentBanner";
import useStudentId from "../hooks/useStudentId";
import { profileApi } from "../services/api";

const defaultForm = {
  name: "",
  email: "",
  skills: "",
  interests: "",
  goals: "",
  confidence_level: 0.5,
  preferred_difficulty: "medium",
};

export default function StudentProfile() {
  const [studentId, setStudentId] = useStudentId();
  const [form, setForm] = useState(defaultForm);
  const [manualId, setManualId] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState({ type: "info", message: "" });

  useEffect(() => {
    if (!studentId) {
      setForm(defaultForm);
      return;
    }

    const load = async () => {
      setLoading(true);
      try {
        const [student, profile] = await Promise.all([
          profileApi.getStudent(studentId),
          profileApi.getProfile(studentId),
        ]);

        setForm({
          name: student.name,
          email: student.email,
          skills: (profile.skills || []).join(", "),
          interests: (profile.interests || []).join(", "),
          goals: profile.goals || "",
          confidence_level: profile.confidence_level ?? 0.5,
          preferred_difficulty: profile.preferred_difficulty || "medium",
        });
      } catch (error) {
        setNotice({ type: "error", message: error.message });
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [studentId]);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((previous) => ({ ...previous, [name]: value }));
  };

  const clearStudent = () => {
    setStudentId(null);
    setForm(defaultForm);
    setNotice({ type: "info", message: "Student context cleared." });
  };

  const loadManualStudent = async () => {
    const parsed = Number(manualId);
    if (!parsed) {
      setNotice({ type: "error", message: "Enter a valid student ID." });
      return;
    }

    setStudentId(parsed);
    setNotice({ type: "success", message: `Loaded student ${parsed}.` });
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    const payload = {
      skills: form.skills
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean),
      interests: form.interests
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean),
      goals: form.goals,
      confidence_level: Number(form.confidence_level),
      preferred_difficulty: form.preferred_difficulty,
    };

    setSaving(true);
    try {
      let activeStudentId = studentId;

      if (!activeStudentId) {
        const created = await profileApi.createStudent({
          name: form.name,
          email: form.email,
        });
        activeStudentId = created.id;
        setStudentId(activeStudentId);
      }

      await profileApi.updateProfile(activeStudentId, payload);
      setNotice({ type: "success", message: `Profile saved for student ${activeStudentId}.` });
    } catch (error) {
      setNotice({ type: "error", message: error.message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <PageShell title="Profile Manager" subtitle="Personalize your core skills, targets, confidence metrics, and difficulty ranges.">
      <StudentBanner studentId={studentId} onClear={clearStudent} />
      <Notice type={notice.type} message={notice.message} />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
        
        {/* Left Column: Context Load & Info */}
        <div className="space-y-6">
          <section className="bg-white border border-brand-border rounded-2xl p-6 shadow-soft space-y-4">
            <div className="flex items-center gap-2">
              <UserCheck className="w-5 h-5 text-brand-primary" />
              <h3 className="text-base font-bold text-brand-textPrimary font-heading">Load Student Session</h3>
            </div>
            <p className="text-xs text-brand-textSecondary leading-relaxed">
              If you have already created a student profile in the database, input your student ID below to restore parameters.
            </p>
            <div className="flex gap-2">
              <input
                value={manualId}
                onChange={(event) => setManualId(event.target.value)}
                placeholder="Enter student ID"
                type="number"
                min="1"
                className="max-w-[150px]"
              />
              <button type="button" className="btn-secondary py-2 px-4" onClick={loadManualStudent}>
                Load
              </button>
            </div>
          </section>

          <section className="bg-white border border-brand-border rounded-2xl p-6 shadow-soft space-y-4">
            <div className="flex items-center gap-2">
              <Target className="w-5 h-5 text-brand-secondary" />
              <h3 className="text-base font-bold text-brand-textPrimary font-heading">Adaptive Metrics</h3>
            </div>
            <ul className="text-xs text-brand-textSecondary space-y-3 leading-relaxed">
              <li className="flex items-start gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-brand-primary mt-1.5"></span>
                <span><strong>Skills:</strong> Mapped to target weaknesses during quizzes.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-brand-primary mt-1.5"></span>
                <span><strong>Confidence:</strong> Influences Socratic prompt complexity metrics.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-brand-primary mt-1.5"></span>
                <span><strong>Difficulty:</strong> Determines the standard complexity weights of replies.</span>
              </li>
            </ul>
          </section>
        </div>

        {/* Right Columns: Main Form */}
        <form className="bg-white border border-brand-border rounded-2xl p-6 shadow-soft space-y-6 lg:col-span-2" onSubmit={handleSubmit}>
          <div className="pb-3 border-b border-brand-border/40">
            <h3 className="text-base font-bold text-brand-textPrimary font-heading">
              {studentId ? "Update Profile Information" : "Create New Student Profile"}
            </h3>
            <p className="text-xs text-brand-textSecondary mt-0.5">
              Fill out your details to synchronize AI weights.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <label className="flex flex-col gap-1.5 text-xs font-semibold text-brand-textSecondary">
              Full Name
              <input
                name="name"
                value={form.name}
                onChange={handleChange}
                placeholder="Student name"
                required
                disabled={Boolean(studentId)}
                className="disabled:bg-slate-50 disabled:text-brand-textMuted disabled:cursor-not-allowed"
              />
            </label>

            <label className="flex flex-col gap-1.5 text-xs font-semibold text-brand-textSecondary">
              Email Address
              <input
                name="email"
                type="email"
                value={form.email}
                onChange={handleChange}
                placeholder="student@example.com"
                required
                disabled={Boolean(studentId)}
                className="disabled:bg-slate-50 disabled:text-brand-textMuted disabled:cursor-not-allowed"
              />
            </label>

            <label className="flex flex-col gap-1.5 text-xs font-semibold text-brand-textSecondary">
              Skills (comma separated)
              <input
                name="skills"
                value={form.skills}
                onChange={handleChange}
                placeholder="Python, SQL, Statistics"
              />
            </label>

            <label className="flex flex-col gap-1.5 text-xs font-semibold text-brand-textSecondary">
              Interests (comma separated)
              <input
                name="interests"
                value={form.interests}
                onChange={handleChange}
                placeholder="NLP, Vision, Data Engineering"
              />
            </label>

            <label className="flex flex-col gap-1.5 text-xs font-semibold text-brand-textSecondary md:col-span-2">
              Goals
              <textarea
                name="goals"
                value={form.goals}
                onChange={handleChange}
                rows="3"
                placeholder="Describe your learning goals (e.g. Master statistics for AI engineering)"
              />
            </label>

            {/* Slider */}
            <div className="flex flex-col gap-2">
              <span className="text-xs font-semibold text-brand-textSecondary">
                Confidence Level: <strong className="text-brand-primary text-sm">{Number(form.confidence_level).toFixed(2)}</strong>
              </span>
              <input
                type="range"
                name="confidence_level"
                min="0"
                max="1"
                step="0.05"
                value={form.confidence_level}
                onChange={handleChange}
                className="h-1.5 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-brand-primary border-none p-0"
              />
              <span className="text-[10px] text-brand-textMuted">0.0 (Unconfident) to 1.0 (Confident)</span>
            </div>

            {/* Select Dropdown */}
            <label className="flex flex-col gap-1.5 text-xs font-semibold text-brand-textSecondary">
              Preferred Difficulty
              <select name="preferred_difficulty" value={form.preferred_difficulty} onChange={handleChange}>
                <option value="easy">Easy</option>
                <option value="medium">Medium</option>
                <option value="hard">Hard</option>
              </select>
            </label>
          </div>

          <div className="pt-4 border-t border-brand-border/40 flex justify-end">
            <button type="submit" className="btn-primary px-6" disabled={saving || loading}>
              {saving ? "Saving..." : studentId ? "Update Profile" : "Create Profile"}
            </button>
          </div>
        </form>

      </div>
    </PageShell>
  );
}
