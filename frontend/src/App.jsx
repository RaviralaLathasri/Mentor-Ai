import React from "react";
import { Navigate, Route, Routes } from "react-router-dom";

import Navbar from "./components/Navbar";
import ProtectedRoute from "./components/ProtectedRoute";
import CareerRoadmap from "./pages/CareerRoadmap";
import Chat from "./pages/Chat";
import Dashboard from "./pages/Dashboard";
import Home from "./pages/Home";
import InterviewPage from "./pages/InterviewPage";
import Profile from "./pages/Profile";
import ResumeMentor from "./pages/ResumeMentor";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Onboarding from "./pages/Onboarding";
import FocusCompanion from "./pages/FocusCompanion";

export default function App() {
  return (
    <div className="app-root">
      <Navbar />
      <Routes>
        {/* Public Routes */}
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />

        {/* Protected Onboarding Route */}
        <Route
          path="/onboarding"
          element={
            <ProtectedRoute>
              <Onboarding />
            </ProtectedRoute>
          }
        />

        {/* Protected Application Routes */}
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/chat"
          element={
            <ProtectedRoute>
              <Chat />
            </ProtectedRoute>
          }
        />
        <Route
          path="/profile"
          element={
            <ProtectedRoute>
              <Profile />
            </ProtectedRoute>
          }
        />
        <Route
          path="/weakness"
          element={<Navigate to="/chat?tab=quiz" replace />}
        />
        <Route
          path="/explain"
          element={<Navigate to="/chat?tab=explain" replace />}
        />
        <Route
          path="/resume"
          element={
            <ProtectedRoute>
              <ResumeMentor />
            </ProtectedRoute>
          }
        />
        <Route
          path="/audio-interview"
          element={
            <ProtectedRoute>
              <InterviewPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/analytics"
          element={<Navigate to="/dashboard" replace />}
        />
        <Route
          path="/career-roadmap"
          element={
            <ProtectedRoute>
              <CareerRoadmap />
            </ProtectedRoute>
          }
        />
        <Route
          path="/focus"
          element={
            <ProtectedRoute>
              <FocusCompanion />
            </ProtectedRoute>
          }
        />
        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  );
}
