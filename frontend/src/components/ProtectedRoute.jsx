import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import LoadingSpinner from "./LoadingSpinner";

export default function ProtectedRoute({ children }) {
  const { user, loading, isAuthenticated } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <LoadingSpinner />
          <p className="mt-4 text-sm font-medium text-slate-500">Securing your session...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    // Save the attempted URL for redirection after login
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // If user is authenticated but hasn't created a profile, force them to onboarding
  // (unless they are already on the onboarding page)
  if (!user.has_profile && location.pathname !== "/onboarding") {
    return <Navigate to="/onboarding" replace />;
  }

  return children;
}
