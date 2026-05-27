import { useEffect, useState } from "react";

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
    <PageShell title="Student Profile" subtitle="Manage skills, interests, goals, and confidence level.">
      <StudentBanner studentId={studentId} onClear={clearStudent} />
      <Notice type={notice.type} message={notice.message} />

      <section className="panel">
        <h3>Load Existing Student</h3>
        <div className="inline-form">
          <input
            value={manualId}
            onChange={(event) => setManualId(event.target.value)}
            placeholder="Enter student ID"
            type="number"
            min="1"
          />
          <button type="button" className="secondary-btn" onClick={loadManualStudent}>
            Load
          </button>
        </div>
      </section>

      <form className="panel form-grid" onSubmit={handleSubmit}>
        <h3>{studentId ? "Update Profile" : "Create Profile"}</h3>

        <label>
          Full Name
          <input
            name="name"
            value={form.name}
            onChange={handleChange}
            placeholder="Student name"
            required
            disabled={Boolean(studentId)}
          />
        </label>

        <label>
          Email
          <input
            name="email"
            type="email"
            value={form.email}
            onChange={handleChange}
            placeholder="student@example.com"
            required
            disabled={Boolean(studentId)}
          />
        </label>

        <label>
          Skills (comma separated)
          <input name="skills" value={form.skills} onChange={handleChange} placeholder="Python, SQL, Statistics" />
        </label>

        <label>
          Interests (comma separated)
          <input name="interests" value={form.interests} onChange={handleChange} placeholder="NLP, Vision, Data Engineering" />
        </label>

        <label className="full-width">
          Goals
          <textarea name="goals" value={form.goals} onChange={handleChange} rows="4" placeholder="Describe your learning goals" />
        </label>

        <label>
          Confidence Level ({Number(form.confidence_level).toFixed(2)})
          <input
            type="range"
            name="confidence_level"
            min="0"
            max="1"
            step="0.05"
            value={form.confidence_level}
            onChange={handleChange}
          />
        </label>

        <label>
          Preferred Difficulty
          <select name="preferred_difficulty" value={form.preferred_difficulty} onChange={handleChange}>
            <option value="easy">Easy</option>
            <option value="medium">Medium</option>
            <option value="hard">Hard</option>
          </select>
        </label>

        <div className="button-row full-width">
          <button type="submit" className="primary-btn" disabled={saving || loading}>
            {saving ? "Saving..." : studentId ? "Update Profile" : "Create Profile"}
          </button>
        </div>
      </form>
    </PageShell>
  );
}
