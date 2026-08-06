import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { profileApi } from "../services/api";
import { Sparkles, Sliders, BookOpen, Award, CheckCircle } from "lucide-react";

export default function Onboarding() {
  const { user, setUser } = useAuth();
  const navigate = useNavigate();
  const [skills, setSkills] = useState("");
  const [interests, setInterests] = useState("");
  const [goals, setGoals] = useState("");
  const [confidence, setConfidence] = useState(0.5);
  const [difficulty, setDifficulty] = useState("medium");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Pre-fill profile values if they exist
  useEffect(() => {
    async function checkExistingProfile() {
      try {
        const profile = await profileApi.getProfileMe();
        if (profile) {
          setSkills(profile.skills ? profile.skills.join(", ") : "");
          setInterests(profile.interests ? profile.interests.join(", ") : "");
          setGoals(profile.goals || "");
          setConfidence(profile.confidence_level ?? 0.5);
          setDifficulty(profile.preferred_difficulty || "medium");
        }
      } catch (err) {
        // No existing profile, which is expected for new users
      }
    }
    if (user?.has_profile) {
      checkExistingProfile();
    }
  }, [user]);

  const handleSave = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const payload = {
        skills: skills ? skills.split(",").map(s => s.trim()).filter(Boolean) : [],
        interests: interests ? interests.split(",").map(i => i.trim()).filter(Boolean) : [],
        goals,
        confidence_level: Number(confidence),
        preferred_difficulty: difficulty,
      };

      await profileApi.upsertProfileMe(payload);
      
      // Update local auth user state so route protection allows entry to app
      setUser(prev => ({ ...prev, has_profile: true }));
      
      navigate("/dashboard");
    } catch (err) {
      setError(err.message || "Failed to save profile. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleSkip = () => {
    // If they skip, set has_profile to true anyway (using defaults) and navigate
    setUser(prev => ({ ...prev, has_profile: true }));
    navigate("/dashboard");
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center bg-slate-50 px-4 py-12 sm:px-6 lg:px-8">
      <div className="max-w-xl w-full space-y-8 bg-white p-8 rounded-2xl shadow-sm border border-slate-100">
        
        {/* Header */}
        <div className="text-center">
          <div className="inline-flex items-center justify-center h-12 w-12 rounded-xl bg-emerald-50 text-emerald-600 font-bold text-2xl mb-4">
            <Sparkles className="h-6 w-6 text-emerald-600" />
          </div>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Welcome to Mentor AI</h2>
          <p className="mt-2 text-sm text-slate-500">Let's personalize your learning experience.</p>
        </div>

        {error && (
          <div className="p-3.5 bg-red-50 border border-red-100 rounded-lg text-xs font-semibold text-red-600 animate-pulse">
            {error}
          </div>
        )}

        <form onSubmit={handleSave} className="space-y-6">
          
          {/* Full Name display */}
          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">
              Account Name
            </label>
            <div className="text-sm font-semibold text-slate-700 bg-slate-50 p-2.5 rounded-lg border border-slate-100">
              {user?.name} ({user?.email})
            </div>
          </div>

          {/* Skills */}
          <div>
            <label htmlFor="skills" className="flex items-center gap-1 text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              <Award className="h-4 w-4 text-slate-400" />
              Skills (comma separated)
            </label>
            <input
              id="skills"
              type="text"
              value={skills}
              onChange={(e) => setSkills(e.target.value)}
              className="block w-full px-3 py-2.5 border border-slate-200 rounded-lg text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-sm transition-all"
              placeholder="Python, Machine Learning, JavaScript"
            />
          </div>

          {/* Interests */}
          <div>
            <label htmlFor="interests" className="flex items-center gap-1 text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              <BookOpen className="h-4 w-4 text-slate-400" />
              Interests (comma separated)
            </label>
            <input
              id="interests"
              type="text"
              value={interests}
              onChange={(e) => setInterests(e.target.value)}
              className="block w-full px-3 py-2.5 border border-slate-200 rounded-lg text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-sm transition-all"
              placeholder="Web Development, Data Science, AI Ethics"
            />
          </div>

          {/* Goals */}
          <div>
            <label htmlFor="goals" className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Learning Goals
            </label>
            <textarea
              id="goals"
              rows={3}
              value={goals}
              onChange={(e) => setGoals(e.target.value)}
              className="block w-full px-3 py-2.5 border border-slate-200 rounded-lg text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-sm transition-all"
              placeholder="What are you hoping to achieve or build?"
            />
          </div>

          {/* Confidence Slider */}
          <div>
            <div className="flex justify-between items-center mb-1.5">
              <label htmlFor="confidence" className="flex items-center gap-1 text-xs font-bold text-slate-700 uppercase tracking-wider">
                <Sliders className="h-4 w-4 text-slate-400" />
                Confidence Level
              </label>
              <span className="text-xs font-bold text-emerald-600">
                {Math.round(confidence * 100)}%
              </span>
            </div>
            <input
              id="confidence"
              type="range"
              min="0.0"
              max="1.0"
              step="0.05"
              value={confidence}
              onChange={(e) => setConfidence(parseFloat(e.target.value))}
              className="w-full h-1.5 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-emerald-600 focus:outline-none"
            />
            <div className="flex justify-between text-[10px] text-slate-400 font-medium mt-1">
              <span>Beginner</span>
              <span>Intermediate</span>
              <span>Advanced</span>
            </div>
          </div>

          {/* Preferred Difficulty */}
          <div>
            <label htmlFor="difficulty" className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Preferred Difficulty
            </label>
            <select
              id="difficulty"
              value={difficulty}
              onChange={(e) => setDifficulty(e.target.value)}
              className="block w-full px-3 py-2.5 border border-slate-200 rounded-lg text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-sm transition-all"
            >
              <option value="easy">Easy (Fundamentals & Guidance)</option>
              <option value="medium">Medium (Balanced Theory & Coding)</option>
              <option value="hard">Hard (Rigorous & Advanced Problems)</option>
            </select>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-4 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={handleSkip}
              className="flex-1 py-2.5 px-4 border border-slate-200 rounded-lg text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-all cursor-pointer text-center"
            >
              Skip for Now
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 py-2.5 px-4 border border-transparent text-sm font-bold rounded-lg text-white bg-emerald-600 hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500 disabled:opacity-50 transition-all cursor-pointer shadow-sm text-center"
            >
              {loading ? "Saving Profile..." : "Save Profile"}
            </button>
          </div>

        </form>

      </div>
    </div>
  );
}
