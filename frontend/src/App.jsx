import { Navigate, Route, Routes } from "react-router-dom";

import Navbar from "./components/Navbar";
import AnalyticsDashboard from "./pages/AnalyticsDashboard";
import CareerRoadmap from "./pages/CareerRoadmap";
import Chat from "./pages/Chat";
import Dashboard from "./pages/Dashboard";
import ExplainMistake from "./pages/ExplainMistake";
import Home from "./pages/Home";
import InterviewPage from "./pages/InterviewPage";
import Profile from "./pages/Profile";
import ResumeMentor from "./pages/ResumeMentor";
import WeaknessAnalyzer from "./pages/WeaknessAnalyzer";

export default function App() {
  return (
    <div className="app-root">
      <Navbar />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/chat" element={<Chat />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/weakness" element={<WeaknessAnalyzer />} />
        <Route path="/explain" element={<ExplainMistake />} />
        <Route path="/resume" element={<ResumeMentor />} />
        <Route path="/audio-interview" element={<InterviewPage />} />
        <Route path="/analytics" element={<AnalyticsDashboard />} />
        <Route path="/career-roadmap" element={<CareerRoadmap />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  );
}
