import { Link } from "react-router-dom";
import useStudentId from "../hooks/useStudentId";
import PageShell from "../components/PageShell";

export default function Home() {
  const [studentId] = useStudentId();

  return (
    <PageShell
      title="AI Mentor System"
      subtitle="Personalized mentoring with weakness-first adaptation and human feedback loop."
    >
      <section className="panel">
        <h2>System Modules</h2>
        <div className="grid two">
          <ul>
            <li>Student profile personalization</li>
            <li>Weakness-first concept scoring</li>
            <li>Socratic mentor response generation</li>
          </ul>
          <ul>
            <li>Human-in-the-loop feedback adaptation</li>
            <li>Explain-my-mistake analysis</li>
            <li>Learning analytics and recommendations</li>
          </ul>
        </div>
      </section>

      <section className="panel cta-panel">
        <h2>{studentId ? `Continue as Student ${studentId}` : "Start by creating a profile"}</h2>
        <div className="button-row">
          <Link to="/profile" className="primary-btn">
            Student Profile
          </Link>
          <Link to="/dashboard" className="secondary-btn">
            Open Dashboard
          </Link>
          <Link to="/chat" className="secondary-btn">
            Mentor Chat
          </Link>
        </div>
      </section>
    </PageShell>
  );
}
