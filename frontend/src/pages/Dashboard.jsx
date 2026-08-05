import { useMemo, useState, useEffect } from "react";
import { Link } from "react-router-dom";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  PieChart,
  Pie,
} from "recharts";
import {
  Sparkles,
  Award,
  BookOpen,
  ArrowRight,
  TrendingDown,
  FileSpreadsheet,
  Mic,
  Calendar,
  CheckCircle,
  Clock,
  RefreshCw,
  Zap
} from "lucide-react";

import Notice from "../components/Notice";
import PageShell from "../components/PageShell";
import RecommendationCard from "../components/RecommendationCard";
import StatCard from "../components/StatCard";
import StudentBanner from "../components/StudentBanner";
import useApiData from "../hooks/useApiData";
import useStudentId from "../hooks/useStudentId";
import { adaptiveApi, analyticsApi, interviewApi } from "../services/api";

const CHART_COLORS = ["#0F766E", "#2563EB", "#16A34A", "#F59E0B"]; // Teal, Blue, Emerald, Amber

const STUDY_PLAN_LIMITS = {
  weeks: { min: 1, max: 8 },
  daysPerWeek: { min: 3, max: 7 },
  dailyMinutes: { min: 30, max: 240 },
};

function clamp(value, min, max) {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

export default function Dashboard() {
  const [studentId, setStudentId] = useStudentId();
  const [studyPlan, setStudyPlan] = useState(null);
  const [studyPlanLoading, setStudyPlanLoading] = useState(false);
  const [studyPlanError, setStudyPlanError] = useState("");
  const [planRequest, setPlanRequest] = useState({
    weeks: 2,
    days_per_week: 5,
    daily_minutes: 60,
  });

  const [resumeScore, setResumeScore] = useState(null);
  const [interviewHistory, setInterviewHistory] = useState([]);
  const [careerRoadmapRole, setCareerRoadmapRole] = useState(null);

  useEffect(() => {
    if (!studentId) {
      setResumeScore(null);
      setInterviewHistory([]);
      setCareerRoadmapRole(null);
      return;
    }

    const storedResume = localStorage.getItem("mentor_resume_analysis");
    if (storedResume) {
      try {
        const parsed = JSON.parse(storedResume);
        if (parsed?.resume_score) {
          setResumeScore(parsed.resume_score);
        }
      } catch (e) {
        // ignore
      }
    }

    const storedRoadmap = localStorage.getItem("mentor_career_roadmap");
    if (storedRoadmap) {
      try {
        const parsed = JSON.parse(storedRoadmap);
        if (parsed?.role) {
          setCareerRoadmapRole(parsed.role);
        }
      } catch (e) {
        // ignore
      }
    }

    const loadInterviews = async () => {
      try {
        const history = await interviewApi.getMockInterviewHistory(studentId, 5);
        if (history?.interviews) {
          setInterviewHistory(history.interviews);
        }
      } catch (e) {
        // ignore
      }
    };
    loadInterviews();
  }, [studentId]);

  const {
    data: dashboard,
    loading,
    error,
    refresh,
  } = useApiData(() => analyticsApi.getDashboard(studentId), [studentId], {
    immediate: Boolean(studentId),
    defaultData: null,
  });

  const clearStudent = () => {
    setStudentId(null);
    setStudyPlan(null);
    setStudyPlanError("");
  };

  const updatePlanRequest = (field) => (event) => {
    const value = Number(event.target.value);
    setPlanRequest((prev) => ({ ...prev, [field]: value }));
  };

  const generateStudyPlan = async () => {
    if (!studentId) return;

    const payload = {
      student_id: studentId,
      weeks: clamp(planRequest.weeks, STUDY_PLAN_LIMITS.weeks.min, STUDY_PLAN_LIMITS.weeks.max),
      days_per_week: clamp(planRequest.days_per_week, STUDY_PLAN_LIMITS.daysPerWeek.min, STUDY_PLAN_LIMITS.daysPerWeek.max),
      daily_minutes: clamp(planRequest.daily_minutes, STUDY_PLAN_LIMITS.dailyMinutes.min, STUDY_PLAN_LIMITS.dailyMinutes.max),
    };

    setPlanRequest({
      weeks: payload.weeks,
      days_per_week: payload.days_per_week,
      daily_minutes: payload.daily_minutes,
    });

    setStudyPlanLoading(true);
    setStudyPlanError("");
    try {
      const result = await adaptiveApi.generateStudyPlan(payload);
      setStudyPlan(result);
    } catch (planError) {
      setStudyPlanError(planError.message);
    } finally {
      setStudyPlanLoading(false);
    }
  };

  const feedbackChart = useMemo(() => {
    if (!dashboard?.feedback_distribution) return [];
    const dist = dashboard.feedback_distribution;
    return [
      { name: "Helpful", value: dist.helpful || 0 },
      { name: "Too Easy", value: dist.too_easy || 0 },
      { name: "Too Hard", value: dist.too_hard || 0 },
      { name: "Unclear", value: dist.unclear || 0 },
    ].filter(item => item.value > 0);
  }, [dashboard]);

  const performanceData = dashboard?.performance_over_time || [];
  const weaknessData = (dashboard?.weakest_concepts || []).slice(0, 5);

  const topRecommendation = dashboard?.recommendations?.[0];
  const confidence = dashboard?.context ? Math.round(dashboard.context.confidence_level * 100) : 0;

  return (
    <PageShell title="Learning Dashboard" subtitle="Manage your weakness targets, evaluate metrics, and customize study paths.">
      <StudentBanner studentId={studentId} onClear={clearStudent} />

      {!studentId ? (
        <section className="bg-white border border-brand-border rounded-2xl p-6 sm:p-8 shadow-soft text-center space-y-4 max-w-xl mx-auto mt-8">
          <BookOpen className="w-12 h-12 text-brand-primary/45 mx-auto" />
          <h3 className="text-lg font-bold text-brand-textPrimary font-heading">No active student context</h3>
          <p className="text-xs sm:text-sm text-brand-textSecondary leading-relaxed">
            Create or load an active student profile from the Profile hub to generate customized roadmap metrics, track weaknesses, and initiate guides.
          </p>
          <Link to="/profile" className="btn-primary w-full sm:w-auto inline-flex mt-2">
            Go to Profile
          </Link>
        </section>
      ) : (
        <div className="space-y-6 sm:space-y-8">
          <Notice type="error" message={error} />

          {/* ================= TOP ROW (Responsive grid) ================= */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            
            {/* Welcome Card */}
            <article className="bg-white border border-brand-border rounded-2xl shadow-soft p-5 sm:p-6 flex flex-col justify-between hover:shadow-softHover hover:-translate-y-0.5 transition-saas">
              <div className="space-y-3">
                <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 bg-brand-primaryLight text-brand-primary rounded-full text-[11px] font-semibold">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Socratic Guide Active</span>
                </div>
                <h3 className="text-lg sm:text-xl font-bold text-brand-textPrimary font-heading">Welcome back!</h3>
                <p className="text-xs text-brand-textSecondary leading-relaxed">
                  Your difficulty adaptation is set to <strong className="text-brand-textPrimary uppercase">{dashboard?.context?.preferred_difficulty || "medium"}</strong>. Prepare your interview questions or check recommended concepts below.
                </p>
              </div>
              <div className="pt-4 border-t border-brand-border/40 mt-4">
                <Link to="/chat" className="text-xs font-semibold text-brand-primary hover:text-brand-primaryHover inline-flex items-center gap-1">
                  <span>Start Chatting</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </article>

            {/* Today's Progress */}
            <article className="bg-white border border-brand-border rounded-2xl shadow-soft p-5 sm:p-6 hover:shadow-softHover hover:-translate-y-0.5 transition-saas flex items-center justify-between gap-4">
              <div className="space-y-2">
                <p className="text-[10px] font-bold uppercase tracking-wider text-brand-textSecondary">Today's Progress</p>
                <h4 className="text-base sm:text-lg font-bold text-brand-textPrimary font-heading">Confidence level</h4>
                <p className="text-[11px] text-brand-textSecondary leading-relaxed">
                  {dashboard?.feedback_distribution?.total ?? 0} Socratic feedback entries recorded.
                </p>
              </div>
              <div className="relative w-16 h-16 sm:w-20 sm:h-20 shrink-0">
                <svg className="w-full h-full" viewBox="0 0 36 36">
                  <path
                    className="text-slate-100"
                    strokeWidth="3.5"
                    stroke="currentColor"
                    fill="none"
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  />
                  <path
                    className="text-brand-primary transition-all duration-1000"
                    strokeWidth="3.5"
                    strokeDasharray={`${confidence}, 100`}
                    strokeLinecap="round"
                    stroke="currentColor"
                    fill="none"
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center text-xs sm:text-sm font-bold text-brand-textPrimary">
                  {confidence}%
                </div>
              </div>
            </article>

            {/* AI Recommendation */}
            <article className="bg-white border border-brand-border rounded-2xl shadow-soft p-5 sm:p-6 flex flex-col justify-between hover:shadow-softHover hover:-translate-y-0.5 transition-saas md:col-span-2 lg:col-span-1">
              <div className="space-y-2.5">
                <p className="text-[10px] font-bold uppercase tracking-wider text-brand-textSecondary">Top AI Recommendation</p>
                {topRecommendation ? (
                  <>
                    <h4 className="text-xs sm:text-sm font-bold text-brand-primary leading-tight font-heading">
                      {topRecommendation.suggested_action}
                    </h4>
                    <p className="text-[11px] text-brand-textSecondary line-clamp-2 leading-relaxed">
                      {topRecommendation.explanation}
                    </p>
                  </>
                ) : (
                  <>
                    <h4 className="text-xs sm:text-sm font-bold text-brand-textPrimary font-heading">No recommendations yet</h4>
                    <p className="text-[11px] text-brand-textSecondary leading-relaxed">
                      Provide Socratic feedback or take weaknesses tests to start receiving custom tips.
                    </p>
                  </>
                )}
              </div>
              <div className="pt-3 border-t border-brand-border/40 mt-3 flex items-center justify-between text-xs">
                <span className="text-[9px] uppercase font-bold text-brand-textSecondary bg-slate-100 px-2 py-0.5 rounded">
                  Priority: {topRecommendation?.priority || "N/A"}
                </span>
                <Link to="/weakness" className="text-xs font-semibold text-brand-primary hover:text-brand-primaryHover inline-flex items-center gap-1">
                  <span>Work Concepts</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </article>

          </div>

          {/* ================= SECOND ROW (Responsive grid) ================= */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            
            {/* Weakness Analysis */}
            <article className="bg-white border border-brand-border rounded-2xl shadow-soft p-5 sm:p-6 hover:shadow-softHover hover:-translate-y-0.5 transition-saas flex flex-col justify-between">
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-brand-primary">
                  <TrendingDown className="w-4 h-4" />
                  <span className="text-[10px] font-bold uppercase tracking-wider text-brand-textSecondary">Weakness Analysis</span>
                </div>
                <h4 className="text-base sm:text-lg font-bold mt-2 text-brand-textPrimary font-heading">
                  {weaknessData[0]?.concept || "General Learning"}
                </h4>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-xl sm:text-2xl font-bold text-brand-textPrimary">
                    {weaknessData[0] ? `${Math.round(weaknessData[0].weakness_score * 100)}%` : "0%"}
                  </span>
                  <span className="text-xs text-brand-textSecondary">weakness score</span>
                </div>
                <p className="text-[11px] text-brand-textMuted leading-relaxed">
                  Seen {weaknessData[0]?.times_seen || 0} times | Correct {weaknessData[0]?.times_correct || 0} times.
                </p>
              </div>
              <Link to="/weakness" className="text-xs font-semibold text-brand-primary hover:text-brand-primaryHover inline-flex items-center gap-1 mt-4">
                <span>View All Weaknesses</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </article>

            {/* Resume Score */}
            <article className="bg-white border border-brand-border rounded-2xl shadow-soft p-5 sm:p-6 hover:shadow-softHover hover:-translate-y-0.5 transition-saas flex flex-col justify-between">
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-brand-secondary">
                  <FileSpreadsheet className="w-4 h-4" />
                  <span className="text-[10px] font-bold uppercase tracking-wider text-brand-textSecondary">Resume Score</span>
                </div>
                {resumeScore ? (
                  <>
                    <h4 className="text-base sm:text-lg font-bold mt-2 text-brand-textPrimary font-heading">Overall Review</h4>
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-xl sm:text-2xl font-bold text-brand-textPrimary">{resumeScore} / 100</span>
                    </div>
                    <p className="text-[11px] text-brand-textSecondary leading-relaxed">
                      Score imported from your latest resume assessment.
                    </p>
                  </>
                ) : (
                  <>
                    <h4 className="text-base sm:text-lg font-bold mt-2 text-brand-textMuted font-heading">Not Uploaded</h4>
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-xl sm:text-2xl font-bold text-brand-textSecondary">- / 100</span>
                    </div>
                    <p className="text-[11px] text-brand-textSecondary leading-relaxed">
                      Upload your profile resume to unlock structural reviews.
                    </p>
                  </>
                )}
              </div>
              <Link to="/resume" className="text-xs font-semibold text-brand-secondary hover:text-brand-secondary/80 inline-flex items-center gap-1 mt-4">
                <span>Optimize Resume</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </article>

            {/* Interview Progress */}
            <article className="bg-white border border-brand-border rounded-2xl shadow-soft p-5 sm:p-6 hover:shadow-softHover hover:-translate-y-0.5 transition-saas flex flex-col justify-between md:col-span-2 lg:col-span-1">
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-brand-accent">
                  <Mic className="w-4 h-4" />
                  <span className="text-[10px] font-bold uppercase tracking-wider text-brand-textSecondary">Interview Progress</span>
                </div>
                {interviewHistory.length > 0 ? (
                  <>
                    <h4 className="text-base sm:text-lg font-bold mt-2 text-brand-textPrimary font-heading">
                      {interviewHistory[0].role}
                    </h4>
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-xl sm:text-2xl font-bold text-brand-textPrimary">
                        {interviewHistory[0].average_score ? `${interviewHistory[0].average_score.toFixed(1)} / 10` : `${interviewHistory.length} sessions`}
                      </span>
                    </div>
                    <p className="text-[11px] text-brand-textSecondary leading-relaxed">
                      Latest level was {interviewHistory[0].difficulty || "Beginner"}.
                    </p>
                  </>
                ) : (
                  <>
                    <h4 className="text-base sm:text-lg font-bold mt-2 text-brand-textMuted font-heading">No Mock Interviews</h4>
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-xl sm:text-2xl font-bold text-brand-textSecondary">0 sessions</span>
                    </div>
                    <p className="text-[11px] text-brand-textSecondary leading-relaxed">
                      Practice questions with live audio responses.
                    </p>
                  </>
                )}
              </div>
              <Link to="/audio-interview" className="text-xs font-semibold text-brand-accent hover:text-brand-accent/80 inline-flex items-center gap-1 mt-4">
                <span>Start Audio Practice</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </article>

          </div>

          {/* ================= THIRD ROW (Responsive columns) ================= */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
            
            {/* Analytics Panel */}
            <section className="bg-white border border-brand-border rounded-2xl shadow-soft p-5 sm:p-6 lg:col-span-2 space-y-6 hover:shadow-softHover transition-saas">
              <div className="flex justify-between items-center pb-4 border-b border-brand-border/40">
                <div>
                  <h3 className="text-sm sm:text-base font-bold text-brand-textPrimary font-heading">Performance & Analytics</h3>
                  <p className="text-xs text-brand-textSecondary">Overview of metrics over time and concept weaknesses.</p>
                </div>
                <button
                  type="button"
                  className="p-1.5 text-brand-textSecondary hover:bg-brand-hoverBg rounded-lg transition-saas"
                  onClick={() => refresh().catch(() => {})}
                  disabled={loading}
                  title="Refresh metrics"
                >
                  <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Feedback Distribution Pie Chart */}
                <div className="space-y-2">
                  <h4 className="text-[10px] font-bold text-brand-textSecondary uppercase tracking-wider">Feedback Distribution</h4>
                  {feedbackChart.length > 0 ? (
                    <div className="h-[200px] w-full flex items-center justify-center">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={feedbackChart}
                            dataKey="value"
                            nameKey="name"
                            cx="50%"
                            cy="50%"
                            outerRadius={65}
                            innerRadius={45}
                            paddingAngle={4}
                          >
                            {feedbackChart.map((entry, index) => (
                              <Cell key={entry.name} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip contentStyle={{ fontSize: '11px', borderRadius: '8px' }} />
                          <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: '10px' }} />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  ) : (
                    <div className="h-[200px] flex items-center justify-center text-xs text-brand-textMuted bg-slate-50 border border-dashed border-brand-border rounded-xl">
                      No feedback logs registered.
                    </div>
                  )}
                </div>

                {/* Weakest Concepts Bar Chart */}
                <div className="space-y-2">
                  <h4 className="text-[10px] font-bold text-brand-textSecondary uppercase tracking-wider">Concepts Weakness</h4>
                  {weaknessData.length > 0 ? (
                    <div className="h-[200px] w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={weaknessData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                          <XAxis dataKey="concept" tick={{ fontSize: 9 }} />
                          <YAxis domain={[0, 1]} tick={{ fontSize: 9 }} />
                          <Tooltip contentStyle={{ fontSize: '11px', borderRadius: '8px' }} />
                          <Bar dataKey="weakness_score" fill="#0F766E" radius={[4, 4, 0, 0]}>
                            {weaknessData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={index === 0 ? "#2563EB" : "#0F766E"} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  ) : (
                    <div className="h-[200px] flex items-center justify-center text-xs text-brand-textMuted bg-slate-50 border border-dashed border-brand-border rounded-xl">
                      No weakness charts available.
                    </div>
                  )}
                </div>
              </div>

              {/* Performance Over Time Line Chart */}
              {performanceData.length > 0 && (
                <div className="space-y-2 pt-4 border-t border-brand-border/40">
                  <h4 className="text-[10px] font-bold text-brand-textSecondary uppercase tracking-wider">Performance Trend</h4>
                  <div className="h-[200px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={performanceData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                        <XAxis dataKey="date" tick={{ fontSize: 9 }} />
                        <YAxis yAxisId="left" domain={[0, 1]} tick={{ fontSize: 9 }} />
                        <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 9 }} />
                        <Tooltip contentStyle={{ fontSize: '11px', borderRadius: '8px' }} />
                        <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: '10px' }} />
                        <Line
                          yAxisId="left"
                          type="monotone"
                          dataKey="helpful_rate"
                          stroke="#0F766E"
                          name="Helpful Rate"
                          strokeWidth={2.5}
                          dot={{ r: 3 }}
                        />
                        <Line
                          yAxisId="right"
                          type="monotone"
                          dataKey="feedback_count"
                          stroke="#2563EB"
                          name="Feedback Count"
                          strokeWidth={1.5}
                          dot={{ r: 2 }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}
            </section>

            {/* Right column: Recent Activity & Career Roadmap Summary */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-1 gap-4 sm:gap-6">
              
              {/* Recent Activity */}
              <article className="bg-white border border-brand-border rounded-2xl shadow-soft p-5 sm:p-6 hover:shadow-softHover transition-saas">
                <h3 className="text-sm sm:text-base font-bold text-brand-textPrimary font-heading pb-3 border-b border-brand-border/40">
                  Recent Activity
                </h3>
                
                <div className="mt-4 relative pl-4 border-l-2 border-slate-100 space-y-5">
                  <div className="relative">
                    <span className="absolute -left-[21px] top-0.5 bg-brand-primary text-white rounded-full p-0.5 ring-4 ring-white">
                      <CheckCircle className="w-2.5 h-2.5" />
                    </span>
                    <p className="text-xs font-semibold text-brand-textPrimary">Profile updated</p>
                    <p className="text-[10px] text-brand-textSecondary mt-0.5">Loaded student context ID {studentId}</p>
                  </div>
                  {resumeScore && (
                    <div className="relative">
                      <span className="absolute -left-[21px] top-0.5 bg-brand-secondary text-white rounded-full p-0.5 ring-4 ring-white">
                        <CheckCircle className="w-2.5 h-2.5" />
                      </span>
                      <p className="text-xs font-semibold text-brand-textPrimary">Resume analyzed</p>
                      <p className="text-[10px] text-brand-textSecondary mt-0.5">Score updated to {resumeScore}/100</p>
                    </div>
                  )}
                  {interviewHistory.length > 0 && (
                    <div className="relative">
                      <span className="absolute -left-[21px] top-0.5 bg-brand-accent text-white rounded-full p-0.5 ring-4 ring-white">
                        <CheckCircle className="w-2.5 h-2.5" />
                      </span>
                      <p className="text-xs font-semibold text-brand-textPrimary">Mock interview session</p>
                      <p className="text-[10px] text-brand-textSecondary mt-0.5">Completed {interviewHistory[0].role} practice</p>
                    </div>
                  )}
                  <div className="relative">
                    <span className="absolute -left-[21px] top-0.5 bg-slate-300 text-white rounded-full p-0.5 ring-4 ring-white">
                      <Clock className="w-2.5 h-2.5" />
                    </span>
                    <p className="text-xs font-semibold text-brand-textSecondary">System active</p>
                    <p className="text-[10px] text-brand-textMuted mt-0.5">Socratic weights synchronization active</p>
                  </div>
                </div>
              </article>

              {/* Career Roadmap Summary */}
              <article className="bg-white border border-brand-border rounded-2xl shadow-soft p-5 sm:p-6 hover:shadow-softHover transition-saas">
                <h3 className="text-sm sm:text-base font-bold text-brand-textPrimary font-heading pb-3 border-b border-brand-border/40">
                  Career Roadmap Planner
                </h3>
                <div className="mt-4 space-y-3">
                  {careerRoadmapRole ? (
                    <>
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-brand-textSecondary">Target Role</span>
                        <span className="font-bold text-brand-textPrimary">{careerRoadmapRole}</span>
                      </div>
                      <p className="text-xs text-brand-textSecondary leading-relaxed">
                        A customized roadmap has been generated matching your weakness logs and time constraints.
                      </p>
                    </>
                  ) : (
                    <>
                      <p className="text-xs text-brand-textSecondary leading-relaxed">
                        Generate a phase-by-phase learning outline matching timeline availability and weakness concepts.
                      </p>
                    </>
                  )}
                  <div className="pt-2">
                    <Link to="/career-roadmap" className="btn-secondary w-full">
                      <span>{careerRoadmapRole ? "View Roadmap" : "Create Roadmap"}</span>
                      <ArrowRight className="w-4 h-4" />
                    </Link>
                  </div>
                </div>
              </article>

            </div>

          </div>

          {/* ================= ADAPTIVE STUDY PLAN GENERATOR ================= */}
          <section className="bg-white border border-brand-border rounded-2xl p-5 sm:p-6 shadow-soft hover:shadow-softHover transition-saas space-y-6">
            
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center pb-4 border-b border-brand-border/40 gap-4">
              <div>
                <h3 className="text-sm sm:text-base font-bold text-brand-textPrimary font-heading">Personalized Study Plan</h3>
                <p className="text-xs text-brand-textSecondary">Create a weekly roadmap aligned to weak concepts.</p>
              </div>
              <div className="flex gap-2 w-full sm:w-auto shrink-0">
                <button
                  type="button"
                  className="btn-primary flex-1 sm:flex-none py-2"
                  onClick={generateStudyPlan}
                  disabled={studyPlanLoading}
                >
                  {studyPlanLoading ? "Generating..." : "Generate Plan"}
                </button>
                <button
                  type="button"
                  className="btn-secondary flex-1 sm:flex-none py-2"
                  onClick={() => {
                    setStudyPlan(null);
                    setStudyPlanError("");
                  }}
                  disabled={studyPlanLoading}
                >
                  Clear
                </button>
              </div>
            </div>

            {/* Inputs Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <label className="flex flex-col gap-1.5 text-xs font-semibold text-brand-textSecondary">
                Weeks duration
                <input
                  type="number"
                  min={STUDY_PLAN_LIMITS.weeks.min}
                  max={STUDY_PLAN_LIMITS.weeks.max}
                  value={planRequest.weeks}
                  onChange={updatePlanRequest("weeks")}
                />
              </label>
              <label className="flex flex-col gap-1.5 text-xs font-semibold text-brand-textSecondary">
                Days per week
                <input
                  type="number"
                  min={STUDY_PLAN_LIMITS.daysPerWeek.min}
                  max={STUDY_PLAN_LIMITS.daysPerWeek.max}
                  value={planRequest.days_per_week}
                  onChange={updatePlanRequest("days_per_week")}
                />
              </label>
              <label className="flex flex-col gap-1.5 text-xs font-semibold text-brand-textSecondary">
                Daily preparation minutes
                <input
                  type="number"
                  min={STUDY_PLAN_LIMITS.dailyMinutes.min}
                  max={STUDY_PLAN_LIMITS.dailyMinutes.max}
                  step={15}
                  value={planRequest.daily_minutes}
                  onChange={updatePlanRequest("daily_minutes")}
                />
              </label>
            </div>

            <Notice type="error" message={studyPlanError} />

            {!studyPlan ? (
              <p className="text-xs text-brand-textSecondary text-center py-8 border border-dashed border-brand-border rounded-xl">
                Choose parameters above and click <strong>Generate Plan</strong> to retrieve week-by-week lessons matching targets.
              </p>
            ) : (
              <div className="space-y-6 pt-4 border-t border-brand-border/40">
                
                {/* Plan Metadata */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <StatCard title="Target Role / Goal" value={studyPlan.goals || "Career Shift"} hint="Goal alignment" />
                  <StatCard title="Current Confidence" value={`${Math.round(studyPlan.confidence_level * 100)}%`} hint="Calculated confidence level" />
                  <StatCard title="Assigned Level" value={studyPlan.preferred_difficulty} hint="System difficulty profile" />
                </div>

                {/* Key Weaknesses (Responsive table/card list) */}
                <div className="space-y-3">
                  <h4 className="text-sm font-bold text-brand-textPrimary font-heading">Target Weakness Areas</h4>
                  
                  {/* Desktop/Tablet Table Layout */}
                  <div className="hidden sm:block overflow-x-auto border border-brand-border rounded-xl">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="bg-slate-50 border-b border-brand-border">
                          <th className="p-3 font-semibold text-brand-textSecondary">Concept Name</th>
                          <th className="p-3 font-semibold text-brand-textSecondary text-center">Score</th>
                          <th className="p-3 font-semibold text-brand-textSecondary text-center">Action Priority</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {(studyPlan.key_weaknesses || []).map((item, index) => (
                          <tr key={`${item.concept}-${index}`} className="hover:bg-slate-50/50">
                            <td className="p-3 font-medium text-brand-textPrimary">{item.concept}</td>
                            <td className="p-3 text-center font-bold text-brand-textSecondary">{item.weakness_score ?? "-"}</td>
                            <td className="p-3 text-center">
                              <span className={`inline-flex px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                                item.priority === 'High' ? 'bg-red-50 text-red-700' : 'bg-slate-100 text-slate-700'
                              }`}>
                                {item.priority}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Mobile Card List Layout */}
                  <div className="sm:hidden space-y-3">
                    {(studyPlan.key_weaknesses || []).map((item, index) => (
                      <div key={`${item.concept}-${index}`} className="bg-slate-50 border border-brand-border rounded-xl p-3.5 space-y-2 text-xs">
                        <div className="flex justify-between items-center">
                          <span className="font-bold text-brand-textPrimary">{item.concept}</span>
                          <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase ${
                            item.priority === 'High' ? 'bg-red-50 text-red-700' : 'bg-slate-100 text-slate-700'
                          }`}>
                            {item.priority}
                          </span>
                        </div>
                        <div className="flex justify-between items-center text-[11px] text-brand-textSecondary">
                          <span>Weakness score</span>
                          <span className="font-bold text-brand-textPrimary">{item.weakness_score ?? "-"}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Weekly Roadmap Card Grid */}
                <div className="space-y-3">
                  <h4 className="text-sm font-bold text-brand-textPrimary font-heading">Weekly Preparation Roadmap</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {(studyPlan.weekly_roadmap || []).map((week) => (
                      <article key={`week-${week.week_number}`} className="bg-slate-50/50 border border-brand-border rounded-xl p-4 sm:p-5 space-y-4">
                        <div className="flex items-center gap-2">
                          <Calendar className="w-4 h-4 text-brand-primary" />
                          <h5 className="font-bold text-brand-textPrimary font-heading text-sm">
                            Week {week.week_number}: {week.weekly_focus}
                          </h5>
                        </div>
                        <p className="text-xs text-brand-textSecondary leading-relaxed">{week.goal_alignment}</p>
                        
                        {/* Weekly Days: Desktop Table */}
                        <div className="hidden sm:block border border-brand-border rounded-lg bg-white overflow-hidden">
                          <table className="w-full text-left text-xs border-collapse">
                            <thead>
                              <tr className="bg-slate-50 border-b border-brand-border">
                                <th className="p-2 font-semibold text-brand-textSecondary text-center w-12">Day</th>
                                <th className="p-2 font-semibold text-brand-textSecondary">Focus</th>
                                <th className="p-2 font-semibold text-brand-textSecondary">Objective</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                              {(week.days || []).map((day) => (
                                <tr key={`week-${week.week_number}-day-${day.day_number}`}>
                                  <td className="p-2 text-center text-brand-textSecondary font-bold">{day.day_number}</td>
                                  <td className="p-2 font-medium text-brand-textPrimary">{day.focus_concept}</td>
                                  <td className="p-2 text-brand-textSecondary text-[11px] leading-snug">
                                    <strong>{day.objective}</strong>
                                    <br />
                                    <span className="text-brand-textMuted">{(day.activities || []).join(" ")}</span>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>

                        {/* Weekly Days: Mobile Card Stack */}
                        <div className="sm:hidden space-y-3">
                          {(week.days || []).map((day) => (
                            <div key={`week-${week.week_number}-day-${day.day_number}`} className="bg-white border border-brand-border/60 rounded-lg p-3 space-y-1.5 text-xs">
                              <div className="flex justify-between items-center">
                                <span className="font-bold text-brand-primary">Day {day.day_number}</span>
                                <span className="font-semibold text-brand-textSecondary text-[11px]">{day.focus_concept}</span>
                              </div>
                              <div className="text-[11px] text-brand-textSecondary leading-relaxed pt-1.5 border-t border-slate-100">
                                <strong>{day.objective}</strong>
                                <p className="text-brand-textMuted mt-1">{(day.activities || []).join(" ")}</p>
                              </div>
                            </div>
                          ))}
                        </div>

                      </article>
                    ))}
                  </div>
                </div>

                {/* Guidance Section */}
                {(studyPlan.guidance || []).length > 0 && (
                  <div className="p-4 sm:p-5 bg-brand-primaryLight/40 border border-brand-primary/10 rounded-xl space-y-2">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-brand-primary">Guidance Tips</h4>
                    <ul className="list-disc list-inside text-xs text-brand-primary leading-relaxed space-y-1">
                      {(studyPlan.guidance || []).map((item, index) => (
                        <li key={`guidance-${index}`}>{item}</li>
                      ))}
                    </ul>
                  </div>
                )}

              </div>
            )}
          </section>
        </div>
      )}
    </PageShell>
  );
}
