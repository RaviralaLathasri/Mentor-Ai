import { useMemo } from "react";
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
import { RefreshCw, BarChart2, TrendingUp, AlertTriangle } from "lucide-react";

import Notice from "../components/Notice";
import PageShell from "../components/PageShell";
import StatCard from "../components/StatCard";
import StudentBanner from "../components/StudentBanner";
import useApiData from "../hooks/useApiData";
import useStudentId from "../hooks/useStudentId";
import { analyticsApi } from "../services/api";

const CHART_COLORS = ["#0F766E", "#2563EB", "#16A34A", "#F59E0B"]; // Teal, Blue, Emerald, Amber

export default function AnalyticsDashboard() {
  const [studentId, setStudentId] = useStudentId();

  const feedbackState = useApiData(() => analyticsApi.getFeedbackDistribution(studentId), [studentId], {
    immediate: Boolean(studentId),
    defaultData: null,
  });
  const performanceState = useApiData(() => analyticsApi.getPerformanceOverTime(studentId), [studentId], {
    immediate: Boolean(studentId),
    defaultData: null,
  });
  const weaknessState = useApiData(() => analyticsApi.getWeakestConcepts(studentId), [studentId], {
    immediate: Boolean(studentId),
    defaultData: null,
  });
  const summaryState = useApiData(() => analyticsApi.getSummary(studentId), [studentId], {
    immediate: Boolean(studentId),
    defaultData: null,
  });

  const loading = feedbackState.loading || performanceState.loading || weaknessState.loading || summaryState.loading;
  const error = feedbackState.error || performanceState.error || weaknessState.error || summaryState.error;

  const feedbackChart = useMemo(() => {
    const dist = feedbackState.data;
    if (!dist) return [];
    return [
      { name: "Helpful", value: dist.helpful || 0 },
      { name: "Too Easy", value: dist.too_easy || 0 },
      { name: "Too Hard", value: dist.too_hard || 0 },
      { name: "Unclear", value: dist.unclear || 0 },
    ].filter(item => item.value > 0);
  }, [feedbackState.data]);

  const performanceData = performanceState.data?.timeline || [];
  const weaknessData = weaknessState.data?.weakest_concepts || [];

  const clearStudent = () => setStudentId(null);

  const handleRefreshAll = () => {
    feedbackState.refresh().catch(() => {});
    performanceState.refresh().catch(() => {});
    weaknessState.refresh().catch(() => {});
    summaryState.refresh().catch(() => {});
  };

  const confidenceValue = summaryState.data?.current_confidence !== undefined && summaryState.data?.current_confidence !== null
    ? `${Math.round(summaryState.data.current_confidence * 100)}%`
    : "-";

  return (
    <PageShell 
      title="Analytics Dashboard" 
      subtitle="Analyze Socratic guide distributions, performance score trends, and concept weakness ratios."
      actions={
        studentId && (
          <button
            type="button"
            className="btn-secondary py-2"
            onClick={handleRefreshAll}
            disabled={loading}
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh Analytics</span>
          </button>
        )
      }
    >
      <StudentBanner studentId={studentId} onClear={clearStudent} />
      <Notice type="error" message={error} />

      {!studentId ? (
        <section className="bg-white border border-brand-border rounded-2xl p-8 shadow-soft text-center space-y-4 max-w-md mx-auto mt-8">
          <BarChart2 className="w-12 h-12 text-brand-primary/45 mx-auto" />
          <h3 className="text-lg font-bold text-brand-textPrimary font-heading">Student Context Required</h3>
          <p className="text-xs text-brand-textSecondary leading-relaxed">
            Please register or load a student profile from the Profile hub to view detailed analytics graphs.
          </p>
        </section>
      ) : (
        <div className="space-y-8">
          
          {/* Top Row Stat Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <StatCard title="Total Feedback" value={feedbackState.data?.total ?? 0} hint="All adaptive interactions" />
            <StatCard title="Confidence Score" value={confidenceValue} hint="Calculated mastery level" />
            <StatCard title="Difficulty Focus" value={summaryState.data?.preferred_difficulty || "-"} hint="Auto difficulty tier" />
            <StatCard title="Top Weak Concept" value={summaryState.data?.top_weakest_concept || "N/A"} hint="Target concept prioritization" />
          </div>

          {/* Charts Row 1 */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            
            {/* Feedback Distribution */}
            <article className="bg-white border border-brand-border rounded-2xl p-6 shadow-soft hover:shadow-softHover transition-saas space-y-4">
              <h3 className="text-base font-bold text-brand-textPrimary font-heading pb-2 border-b border-brand-border/40">
                Feedback Distribution
              </h3>
              {feedbackChart.length === 0 ? (
                <div className="h-[280px] flex items-center justify-center text-xs text-brand-textMuted bg-slate-50 border border-dashed border-brand-border rounded-xl">
                  No feedback distribution records logged.
                </div>
              ) : (
                <div className="h-[280px] w-full flex items-center justify-center">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={feedbackChart}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        outerRadius={95}
                        innerRadius={65}
                        paddingAngle={4}
                      >
                        {feedbackChart.map((entry, index) => (
                          <Cell key={entry.name} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={{ fontSize: '11px', borderRadius: '8px' }} />
                      <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: '11px' }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              )}
            </article>

            {/* Weakness analysis */}
            <article className="bg-white border border-brand-border rounded-2xl p-6 shadow-soft hover:shadow-softHover transition-saas space-y-4">
              <h3 className="text-base font-bold text-brand-textPrimary font-heading pb-2 border-b border-brand-border/40">
                Concepts Weakness Scores
              </h3>
              {weaknessData.length === 0 ? (
                <div className="h-[280px] flex items-center justify-center text-xs text-brand-textMuted bg-slate-50 border border-dashed border-brand-border rounded-xl">
                  No concept weakness scores calculated.
                </div>
              ) : (
                <div className="h-[280px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={weaknessData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                      <XAxis dataKey="concept" tick={{ fontSize: 10 }} />
                      <YAxis domain={[0, 1]} tick={{ fontSize: 10 }} />
                      <Tooltip contentStyle={{ fontSize: '11px', borderRadius: '8px' }} />
                      <Bar dataKey="weakness_score" fill="#0F766E" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </article>

          </div>

          {/* Charts Row 2 */}
          <article className="bg-white border border-brand-border rounded-2xl p-6 shadow-soft hover:shadow-softHover transition-saas space-y-4">
            <h3 className="text-base font-bold text-brand-textPrimary font-heading pb-2 border-b border-brand-border/40">
              Adaptive Performance Trends
            </h3>
            {performanceData.length === 0 ? (
              <div className="h-[320px] flex items-center justify-center text-xs text-brand-textMuted bg-slate-50 border border-dashed border-brand-border rounded-xl">
                No chronological performance stats logged.
              </div>
            ) : (
              <div className="h-[320px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={performanceData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                    <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                    <YAxis yAxisId="left" domain={[0, 1]} tick={{ fontSize: 10 }} />
                    <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10 }} />
                    <Tooltip contentStyle={{ fontSize: '11px', borderRadius: '8px' }} />
                    <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: '11px' }} />
                    <Line
                      yAxisId="left"
                      type="monotone"
                      dataKey="helpful_rate"
                      stroke="#0F766E"
                      name="Helpful Rate"
                      strokeWidth={3}
                      dot={{ r: 4 }}
                    />
                    <Line
                      yAxisId="right"
                      type="monotone"
                      dataKey="feedback_count"
                      stroke="#2563EB"
                      name="Feedback Count"
                      strokeWidth={2}
                      dot={{ r: 3 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </article>

        </div>
      )}
    </PageShell>
  );
}
