import React, { createContext, useState, useEffect, useContext } from "react";
import { authApi } from "../services/api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Load user on mount if token exists
  useEffect(() => {
    async function loadUser() {
      const token = localStorage.getItem("mentor_access_token");
      if (token) {
        try {
          const userData = await authApi.getMe();
          setUser(userData);
          // Set student ID in localStorage for backward compatibility with existing features
          localStorage.setItem("mentor_student_id", String(userData.id));
          localStorage.setItem("studentId", String(userData.id));
        } catch (error) {
          console.error("Failed to load user:", error);
          // Clear invalid session
          logout();
        }
      }
      setLoading(false);
    }
    loadUser();
  }, []);

  const login = async (email, password) => {
    setLoading(true);
    try {
      const data = await authApi.login({ email, password });
      localStorage.setItem("mentor_access_token", data.access_token);
      localStorage.setItem("mentor_refresh_token", data.refresh_token);
      
      const userData = await authApi.getMe();
      setUser(userData);
      localStorage.setItem("mentor_student_id", String(userData.id));
      localStorage.setItem("studentId", String(userData.id));
      setLoading(false);
      return userData;
    } catch (error) {
      setLoading(false);
      throw error;
    }
  };

  const register = async (name, email, password) => {
    setLoading(true);
    try {
      const data = await authApi.register({ name, email, password });
      localStorage.setItem("mentor_access_token", data.access_token);
      localStorage.setItem("mentor_refresh_token", data.refresh_token);
      
      const userData = await authApi.getMe();
      setUser(userData);
      localStorage.setItem("mentor_student_id", String(userData.id));
      localStorage.setItem("studentId", String(userData.id));
      setLoading(false);
      return userData;
    } catch (error) {
      setLoading(false);
      throw error;
    }
  };

  const loginWithGoogle = async (googleData) => {
    setLoading(true);
    try {
      const data = await authApi.google({
        email: googleData.email,
        name: googleData.name,
        google_id: googleData.googleId,
        avatar_url: googleData.imageUrl || ""
      });
      localStorage.setItem("mentor_access_token", data.access_token);
      localStorage.setItem("mentor_refresh_token", data.refresh_token);
      
      const userData = await authApi.getMe();
      setUser(userData);
      localStorage.setItem("mentor_student_id", String(userData.id));
      localStorage.setItem("studentId", String(userData.id));
      setLoading(false);
      return userData;
    } catch (error) {
      setLoading(false);
      throw error;
    }
  };

  const logout = () => {
    localStorage.removeItem("mentor_access_token");
    localStorage.removeItem("mentor_refresh_token");
    localStorage.removeItem("mentor_student_id");
    localStorage.removeItem("studentId");
    setUser(null);
  };

  const value = {
    user,
    loading,
    login,
    register,
    loginWithGoogle,
    logout,
    isAuthenticated: !!user,
    setUser
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
