import React, { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { profileApi } from "../services/api";
import PageShell from "../components/PageShell";
import Notice from "../components/Notice";
import LoadingSpinner from "../components/LoadingSpinner";
import { User, Award, BookOpen, Target, Sliders, Edit3, X, Mail } from "lucide-react";

export default function Profile() {
  const { user } = useAuth();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editMode, setEditMode] = useState(false);
  
  // Edit Form Fields
  const [skills, setSkills] = useState("");
  const [interests, setInterests] = useState("");
  const [goals, setGoals] = useState("");
  const [confidence, setConfidence] = useState(0.5);
  const [difficulty, setDifficulty] = useState("medium");
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState({ type: "info", message: "" });

  const loadProfile = async () => {
    setLoading(true);
    try {
      const data = await profileApi.getProfileMe();
      setProfile(data);
      setSkills(data.skills ? data.skills.join(", ") : "");
      setInterests(data.interests ? data.interests.join(", ") : "");
      setGoals(data.goals || "");
      setConfidence(data.confidence_level ?? 0.5);
      setDifficulty(data.preferred_difficulty || "medium");
    } catch (err) {
      setError("Unable to load profile. Please complete onboarding.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProfile();
  }, []);

  const handleUpdate = async (e) => {
    e.preventDefault();
    setSaving(true);
    setNotice({ type: "info", message: "" });
    try {
      const payload = {
        skills: skills ? skills.split(",").map(s => s.trim()).filter(Boolean) : [],
        interests: interests ? interests.split(",").map(i => i.trim()).filter(Boolean) : [],
        goals,
        confidence_level: Number(confidence),
        preferred_difficulty: difficulty,
      };

      const updated = await profileApi.updateProfileMe(payload);
      setProfile(updated);
      setEditMode(false);
      setNotice({ type: "success", message: "Profile updated successfully!" });
    } catch (err) {
      setNotice({ type: "error", message: err.message || "Failed to update profile." });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <PageShell title="Loading Profile..." subtitle="Retrieving your personalized settings.">
        <div className="flex justify-center items-center py-24">
          <LoadingSpinner />
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell title="My Profile" subtitle="Manage your skills, learning style parameters, and Socratic preferences.">
      {notice.message && (
        <div className="mb-6">
          <Notice type={notice.type} message={notice.message} />
        </div>
      )}

      {error ? (
        <div className="bg-white border border-red-100 rounded-2xl p-8 text-center max-w-lg mx-auto shadow-sm">
          <Notice type="error" message={error} />
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
          
          {/* User Info card */}
          <div className="bg-white border border-slate-100 rounded-2xl p-6 shadow-sm space-y-6">
            <div className="flex flex-col items-center text-center">
              <div className="w-20 h-20 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold text-3xl shadow-xs border border-emerald-100 mb-4">
                {user?.name ? user.name[0].toUpperCase() : "U"}
              </div>
              <h3 className="text-lg font-bold text-slate-800">{user?.name}</h3>
              <p className="text-xs text-slate-400 mt-0.5">Socrates Learner ID: #{user?.id}</p>
              
              <div className="flex items-center gap-1.5 text-xs text-slate-500 bg-slate-50 px-3 py-1.5 rounded-full mt-3 font-medium">
                <Mail className="w-3.5 h-3.5 text-slate-400" />
                <span>{user?.email}</span>
              </div>
            </div>

            <div className="border-t border-slate-50 pt-4 flex flex-col gap-2">
              <button
                onClick={() => setEditMode(true)}
                className="w-full flex items-center justify-center gap-2 py-2 px-4 border border-slate-200 rounded-lg text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-all cursor-pointer"
              >
                <Edit3 className="w-4 h-4 text-slate-500" />
                <span>Edit Profile</span>
              </button>
            </div>
          </div>

          {/* Profile preferences card */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white border border-slate-100 rounded-2xl p-6 shadow-sm space-y-6">
              
              <div className="flex justify-between items-center pb-4 border-b border-slate-50">
                <h4 className="text-base font-bold text-slate-800">Learning Parameters</h4>
                <span className="text-xs font-semibold uppercase tracking-wider text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-md">
                  Active
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                
                {/* Confidence */}
                <div className="space-y-1.5">
                  <span className="flex items-center gap-1.5 text-xs font-bold text-slate-400 uppercase tracking-wider">
                    <Sliders className="w-4 h-4" />
                    Confidence Metric
                  </span>
                  <div className="text-sm font-semibold text-slate-800">
                    {Math.round((profile?.confidence_level ?? 0.5) * 100)}%
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-1.5 mt-2">
                    <div
                      className="bg-emerald-500 h-1.5 rounded-full transition-all duration-500"
                      style={{ width: `${(profile?.confidence_level ?? 0.5) * 100}%` }}
                    />
                  </div>
                </div>

                {/* Preferred Difficulty */}
                <div className="space-y-1.5">
                  <span className="flex items-center gap-1.5 text-xs font-bold text-slate-400 uppercase tracking-wider">
                    <Target className="w-4 h-4" />
                    Preferred Difficulty
                  </span>
                  <div className="text-sm font-semibold text-slate-800 capitalize">
                    {profile?.preferred_difficulty || "medium"}
                  </div>
                </div>

              </div>

              {/* Skills */}
              <div className="space-y-2.5">
                <span className="flex items-center gap-1.5 text-xs font-bold text-slate-400 uppercase tracking-wider">
                  <Award className="w-4 h-4" />
                  Target Skills
                </span>
                <div className="flex flex-wrap gap-2">
                  {profile?.skills && profile.skills.length > 0 ? (
                    profile.skills.map((skill, index) => (
                      <span
                        key={index}
                        className="text-xs font-semibold text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-100/50"
                      >
                        {skill}
                      </span>
                    ))
                  ) : (
                    <span className="text-xs text-slate-400 italic">No skills listed yet.</span>
                  )}
                </div>
              </div>

              {/* Interests */}
              <div className="space-y-2.5">
                <span className="flex items-center gap-1.5 text-xs font-bold text-slate-400 uppercase tracking-wider">
                  <BookOpen className="w-4 h-4" />
                  Learning Interests
                </span>
                <div className="flex flex-wrap gap-2">
                  {profile?.interests && profile.interests.length > 0 ? (
                    profile.interests.map((interest, index) => (
                      <span
                        key={index}
                        className="text-xs font-semibold text-slate-600 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-100"
                      >
                        {interest}
                      </span>
                    ))
                  ) : (
                    <span className="text-xs text-slate-400 italic">No interests listed yet.</span>
                  )}
                </div>
              </div>

              {/* Goals */}
              <div className="space-y-1.5">
                <span className="block text-xs font-bold text-slate-400 uppercase tracking-wider">
                  Short & Long Term Goals
                </span>
                <div className="text-sm text-slate-600 bg-slate-50 p-4 rounded-xl border border-slate-100/50 leading-relaxed whitespace-pre-wrap">
                  {profile?.goals || "No learning goals defined yet."}
                </div>
              </div>

            </div>
          </div>

        </div>
      )}

      {/* Edit Profile Modal */}
      {editMode && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
          <div className="bg-white border border-slate-100 max-w-lg w-full rounded-2xl shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            
            {/* Modal header */}
            <div className="flex items-center justify-between p-5 border-b border-slate-50">
              <h3 className="text-base font-bold text-slate-800">Edit Profile</h3>
              <button
                onClick={() => setEditMode(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-50 transition-all"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal body */}
            <form onSubmit={handleUpdate} className="p-6 space-y-4">
              
              {/* Skills */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Skills (comma separated)
                </label>
                <input
                  type="text"
                  value={skills}
                  onChange={(e) => setSkills(e.target.value)}
                  className="block w-full px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                  placeholder="Python, ML, React"
                />
              </div>

              {/* Interests */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Interests (comma separated)
                </label>
                <input
                  type="text"
                  value={interests}
                  onChange={(e) => setInterests(e.target.value)}
                  className="block w-full px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                  placeholder="Data Engineering, Backend, UI/UX"
                />
              </div>

              {/* Goals */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Goals
                </label>
                <textarea
                  value={goals}
                  onChange={(e) => setGoals(e.target.value)}
                  rows={3}
                  className="block w-full px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                  placeholder="Master full stack development..."
                />
              </div>

              {/* Confidence */}
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Confidence Level
                  </label>
                  <span className="text-xs font-bold text-emerald-600">
                    {Math.round(confidence * 100)}%
                  </span>
                </div>
                <input
                  type="range"
                  min="0.0"
                  max="1.0"
                  step="0.05"
                  value={confidence}
                  onChange={(e) => setConfidence(parseFloat(e.target.value))}
                  className="w-full h-1 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-emerald-600 focus:outline-none"
                />
              </div>

              {/* Difficulty */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Preferred Difficulty
                </label>
                <select
                  value={difficulty}
                  onChange={(e) => setDifficulty(e.target.value)}
                  className="block w-full px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                >
                  <option value="easy">Easy</option>
                  <option value="medium">Medium</option>
                  <option value="hard">Hard</option>
                </select>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-3 pt-4 border-t border-slate-50 justify-end">
                <button
                  type="button"
                  onClick={() => setEditMode(false)}
                  className="py-2 px-4 border border-slate-200 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-50 transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="py-2 px-5 border border-transparent text-xs font-bold rounded-lg text-white bg-emerald-600 hover:bg-emerald-700 focus:outline-none disabled:opacity-50 transition-all cursor-pointer shadow-xs"
                >
                  {saving ? "Saving..." : "Save Changes"}
                </button>
              </div>

            </form>

          </div>
        </div>
      )}
    </PageShell>
  );
}
