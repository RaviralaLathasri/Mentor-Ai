import { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import Notice from "../components/Notice";
import PageShell from "../components/PageShell";
import RecommendationCard from "../components/RecommendationCard";
import StatCard from "../components/StatCard";
import StudentBanner from "../components/StudentBanner";
import useApiData from "../hooks/useApiData";
import useStudentId from "../hooks/useStudentId";
import { adaptiveApi, analyticsApi } from "../services/api";

const COLORS = ["#0ea5e9", "#22c55e", "#f97316", "#ef4444"];

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
    ];
  }, [dashboard]);

  const performanceData = dashboard?.performance_over_time || [];
  const weaknessData = dashboard?.weakest_concepts || [];

  return (
    <PageShell title="Dashboard" subtitle="Learning analytics, weakness trends, and recommendations.">
      <StudentBanner studentId={studentId} onClear={clearStudent} />
      {!studentId ? (
        <section className="panel">
          <p>Create or load a student from the Profile page to view the dashboard.</p>
        </section>
      ) : (
        <>
          <Notice type="error" message={error} />

          <div className="grid four">
            <StatCard
              title="Feedback Entries"
              value={dashboard?.feedback_distribution?.total ?? 0}
              hint="Human-in-the-loop responses"
            />
            <StatCard
              title="Confidence"
              value={dashboard?.context ? `${Math.round(dashboard.context.confidence_level * 100)}%` : "-"}
              hint="Current confidence estimate"
            />
            <StatCard
              title="Preferred Difficulty"
              value={dashboard?.context?.preferred_difficulty || "-"}
              hint="Adaptive level"
            />
            <StatCard
              title="Weakest Concept"
              value={weaknessData[0]?.concept || "N/A"}
              hint="Highest priority topic"
            />
          </div>

          <div className="grid two">
            <section className="panel chart-panel">
              <h3>Feedback Distribution</h3>
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie data={feedbackChart} dataKey="value" nameKey="name" outerRadius={100}>
                    {feedbackChart.map((entry, index) => (
                      <Cell key={entry.name} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </section>

            <section className="panel chart-panel">
              <h3>Weakest Concepts</h3>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={weaknessData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="concept" />
                  <YAxis domain={[0, 1]} />
                  <Tooltip />
                  <Bar dataKey="weakness_score" fill="#ef4444" />
                </BarChart>
              </ResponsiveContainer>
            </section>
          </div>

          <section className="panel chart-panel">
            <h3>Performance Over Time</h3>
            <ResponsiveContainer width="100%" height={320}>
              <LineChart data={performanceData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis yAxisId="left" domain={[0, 1]} />
                <YAxis yAxisId="right" orientation="right" />
                <Tooltip />
                <Legend />
                <Line
                  yAxisId="left"
                  type="monotone"
                  dataKey="helpful_rate"
                  stroke="#22c55e"
                  name="Helpful Rate"
                  strokeWidth={3}
                />
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="feedback_count"
                  stroke="#0ea5e9"
                  name="Feedback Count"
                  strokeWidth={2}
                />
              </LineChart>
            </ResponsiveContainer>
          </section>

          <section className="panel">
            <div className="section-header-inline">
              <h3>Recommendations</h3>
              <button type="button" className="secondary-btn" onClick={() => refresh().catch(() => {})} disabled={loading}>
                {loading ? "Refreshing..." : "Refresh"}
              </button>
            </div>
            <div className="grid two">
              {(dashboard?.recommendations || []).map((item, index) => (
                <RecommendationCard key={`${item.recommendation_type}-${index}`} recommendation={item} />
              ))}
            </div>
          </section>

          <section className="panel">
            <div className="section-header-inline">
              <h3>Personalized Study Plan</h3>
              <div className="button-row">
                <button type="button" className="secondary-btn" onClick={generateStudyPlan} disabled={studyPlanLoading}>
                  {studyPlanLoading ? "Generating..." : "Generate Plan"}
                </button>
                <button
                  type="button"
                  className="ghost-btn"
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

            <div className="form-grid">
              <div className="grid three">
                <label>
                  Weeks
                  <input
                    type="number"
                    min={STUDY_PLAN_LIMITS.weeks.min}
                    max={STUDY_PLAN_LIMITS.weeks.max}
                    value={planRequest.weeks}
                    onChange={updatePlanRequest("weeks")}
                  />
                </label>
                <label>
                  Days per Week
                  <input
                    type="number"
                    min={STUDY_PLAN_LIMITS.daysPerWeek.min}
                    max={STUDY_PLAN_LIMITS.daysPerWeek.max}
                    value={planRequest.days_per_week}
                    onChange={updatePlanRequest("days_per_week")}
                  />
                </label>
                <label>
                  Daily Minutes
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
            </div>

            <Notice type="error" message={studyPlanError} />

            {!studyPlan ? (
              <p>Generate a plan to get a week-by-week roadmap aligned to goals and current weak concepts.</p>
            ) : (
              <>
                <div className="grid three">
                  <StatCard title="Goal" value={studyPlan.goals || "Not set"} hint="Profile goal alignment" />
                  <StatCard title="Confidence" value={`${Math.round(studyPlan.confidence_level * 100)}%`} hint="Current estimate" />
                  <StatCard title="Difficulty" value={studyPlan.preferred_difficulty} hint="Preferred level" />
                </div>

                <section className="panel">
                  <h4>Key Weaknesses</h4>
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Concept</th>
                        <th>Weakness Score</th>
                        <th>Priority</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(studyPlan.key_weaknesses || []).map((item, index) => (
                        <tr key={`${item.concept}-${index}`}>
                          <td>{item.concept}</td>
                          <td>{item.weakness_score ?? "-"}</td>
                          <td>{item.priority}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </section>

                <section className="panel">
                  <h4>Weekly Roadmap</h4>
                  <div className="grid two">
                    {(studyPlan.weekly_roadmap || []).map((week) => (
                      <article key={`week-${week.week_number}`} className="recommendation-card">
                        <h4>
                          Week {week.week_number}: {week.weekly_focus}
                        </h4>
                        <p>{week.goal_alignment}</p>
                        <table className="data-table">
                          <thead>
                            <tr>
                              <th>Day</th>
                              <th>Focus</th>
                              <th>Objective</th>
                            </tr>
                          </thead>
                          <tbody>
                            {(week.days || []).map((day) => (
                              <tr key={`week-${week.week_number}-day-${day.day_number}`}>
                                <td>{day.day_number}</td>
                                <td>{day.focus_concept}</td>
                                <td>
                                  <strong>{day.objective}</strong>
                                  <br />
                                  {(day.activities || []).join(" ")}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </article>
                    ))}
                  </div>
                </section>

                <section className="panel">
                  <h4>Guidance</h4>
                  <ul>
                    {(studyPlan.guidance || []).map((item, index) => (
                      <li key={`guidance-${index}`}>{item}</li>
                    ))}
                  </ul>
                </section>
              </>
            )}
          </section>
        </>
      )}
    </PageShell>
  );
}
