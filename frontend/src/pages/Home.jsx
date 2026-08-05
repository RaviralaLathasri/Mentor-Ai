import { Link } from "react-router-dom";
import {
  User,
  Brain,
  MessageSquare,
  Sparkles,
  GitFork,
  Mic,
  ArrowRight
} from "lucide-react";
import useStudentId from "../hooks/useStudentId";
import PageShell from "../components/PageShell";

export default function Home() {
  const [studentId] = useStudentId();

  const features = [
    {
      title: "Socratic Mentor Chat",
      desc: "Engage in guided conversation where the AI poses strategic questions rather than giving immediate answers.",
      icon: MessageSquare,
      link: "/chat",
    },
    {
      title: "Student Profile Hub",
      desc: "Manage your background, focus concepts, and preferred complexity levels for complete personalization.",
      icon: User,
      link: "/profile",
    },
    {
      title: "Weakness Analysis",
      desc: "Identify critical knowledge gaps using active testing and prioritize learning concepts.",
      icon: Brain,
      link: "/weakness",
    },
    {
      title: "Mock Audio Interview",
      desc: "Practice interviews using live text-to-speech questions and live speech-to-text feedback.",
      icon: Mic,
      link: "/audio-interview",
    },
    {
      title: "Career Roadmap Planner",
      desc: "Generate step-by-step career transition timelines matching your weakness metrics and goals.",
      icon: GitFork,
      link: "/career-roadmap",
    },
  ];

  return (
    <PageShell
      title="Adaptive AI Mentor System"
      subtitle="Optimize your career journey with weakness-first course mapping, conversational guidance, and mock interviews."
    >
      
      {/* Hero Welcome banner */}
      <section className="bg-gradient-to-br from-brand-primaryLight to-white border border-brand-border rounded-2xl p-8 relative overflow-hidden shadow-soft">
        <div className="absolute right-0 top-0 translate-x-12 -translate-y-12 w-64 h-64 bg-brand-primary/5 rounded-full blur-3xl pointer-events-none"></div>
        <div className="relative max-w-2xl space-y-4">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-white border border-brand-border rounded-full text-xs font-semibold text-brand-primary">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Premium Educational Platform</span>
          </div>
          <h2 className="text-2xl md:text-3xl font-bold tracking-tight text-brand-textPrimary font-heading">
            {studentId ? `Welcome back, Student ${studentId}!` : "Personalize Your Learning Strategy"}
          </h2>
          <p className="text-sm md:text-base text-brand-textSecondary leading-relaxed">
            Take structured tests, load a profile, evaluate your resume, and let our Socratic system focus on your exact concepts of weakness to streamline preparation.
          </p>
          <div className="flex flex-wrap gap-3 pt-2">
            <Link to="/profile" className="btn-primary">
              <span>{studentId ? "Update Profile" : "Create Profile"}</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
            <Link to="/dashboard" className="btn-secondary">
              Go to Dashboard
            </Link>
          </div>
        </div>
      </section>

      {/* Feature Grid */}
      <div className="space-y-6">
        <div>
          <h3 className="text-lg font-semibold text-brand-textPrimary font-heading">
            Explore System Modules
          </h3>
          <p className="text-xs text-brand-textSecondary">
            Navigate through targeted features engineered to map weaknesses.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((feat) => {
            const Icon = feat.icon;
            return (
              <article key={feat.title} className="bg-white border border-brand-border rounded-2xl p-6 shadow-soft hover:shadow-softHover hover:-translate-y-0.5 transition-saas flex flex-col justify-between">
                <div className="space-y-3">
                  <div className="w-10 h-10 rounded-xl bg-brand-primaryLight text-brand-primary flex items-center justify-center">
                    <Icon className="w-5 h-5" />
                  </div>
                  <h4 className="text-base font-bold text-brand-textPrimary font-heading">
                    {feat.title}
                  </h4>
                  <p className="text-xs text-brand-textSecondary leading-relaxed">
                    {feat.desc}
                  </p>
                </div>
                <div className="pt-4 border-t border-brand-border/40 mt-4">
                  <Link to={feat.link} className="text-xs font-semibold text-brand-primary hover:text-brand-primaryHover inline-flex items-center gap-1">
                    <span>Open Module</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </article>
            );
          })}
        </div>
      </div>

    </PageShell>
  );
}
