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

import Notice from "../components/Notice";
import PageShell from "../components/PageShell";
import StatCard from "../components/StatCard";
import StudentBanner from "../components/StudentBanner";
import useApiData from "../hooks/useApiData";
import useStudentId from "../hooks/useStudentId";
import { analyticsApi } from "../services/api";

const COLORS = ["#0ea5e9", "#22c55e", "#f97316", "#ef4444"];

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
    ];
  }, [feedbackState.data]);

  const performanceData = performanceState.data?.timeline || [];
  const weaknessData = weaknessState.data?.weakest_concepts || [];

  const clearStudent = () => setStudentId(null);

  return (
    <PageShell title="Analytics Dashboard" subtitle="Feedback distribution, performance trends, and weakness analysis.">
      <StudentBanner studentId={studentId} onClear={clearStudent} />
      {!studentId ? (
        <section className="panel">
          <p>Load a student profile to inspect analytics.</p>
        </section>
      ) : (
        <>
          <Notice type="error" message={error} />

          <div className="grid four">
            <StatCard title="Total Feedback" value={feedbackState.data?.total ?? 0} hint="All feedback tags" />
            <StatCard title="Current Confidence" value={summaryState.data?.current_confidence ?? "-"} />
            <StatCard title="Difficulty" value={summaryState.data?.preferred_difficulty || "-"} />
            <StatCard title="Weakest Concept" value={summaryState.data?.top_weakest_concept || "N/A"} />
          </div>

          <div className="grid two">
            <section className="panel chart-panel">
              <h3>Feedback Distribution</h3>
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie data={feedbackChart} dataKey="value" nameKey="name" outerRadius={100}>
                    {feedbackChart.map((item, index) => (
                      <Cell key={item.name} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </section>

            <section className="panel chart-panel">
              <h3>Weakness Analysis</h3>
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
            <h3>Performance Trends</h3>
            <ResponsiveContainer width="100%" height={320}>
              <LineChart data={performanceData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis yAxisId="left" domain={[0, 1]} />
                <YAxis yAxisId="right" orientation="right" />
                <Tooltip />
                <Legend />
                <Line yAxisId="left" type="monotone" dataKey="helpful_rate" stroke="#22c55e" strokeWidth={3} />
                <Line yAxisId="right" type="monotone" dataKey="feedback_count" stroke="#0ea5e9" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </section>

          <section className="panel">
            <button
              type="button"
              className="secondary-btn"
              onClick={() => {
                feedbackState.refresh().catch(() => {});
                performanceState.refresh().catch(() => {});
                weaknessState.refresh().catch(() => {});
                summaryState.refresh().catch(() => {});
              }}
              disabled={loading}
            >
              {loading ? "Refreshing..." : "Refresh Analytics"}
            </button>
          </section>
        </>
      )}
    </PageShell>
  );
}
