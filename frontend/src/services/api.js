import axios from "axios";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 20000,
  headers: {
    "Content-Type": "application/json",
  },
});

function parseError(error) {
  if (error?.response?.data?.detail) {
    return error.response.data.detail;
  }
  if (typeof error?.response?.data === "string") {
    return error.response.data;
  }
  return error?.message || "Request failed";
}

async function request(promise) {
  try {
    const response = await promise;
    return response.data;
  } catch (error) {
    throw new Error(parseError(error));
  }
}

export const profileApi = {
  createStudent: (payload) => request(api.post("/api/profile/create", payload)),
  getStudent: (studentId) => request(api.get(`/api/profile/student/${studentId}`)),
  getProfile: (studentId) => request(api.get(`/api/profile/${studentId}`)),
  updateProfile: (studentId, payload) => request(api.put(`/api/profile/${studentId}`, payload)),
  upsertProfile: (studentId, payload) => request(api.post(`/api/profile/${studentId}/profile`, payload)),
};

export const mentorApi = {
  respond: (payload) => request(api.post("/api/mentor/respond", payload)),
};

export const feedbackApi = {
  submit: (payload) => request(api.post("/api/feedback/submit", payload)),
  rate: (payload) =>
    request(
      api.post("/api/feedback/rate-response", null, {
        params: payload,
      }),
    ),
};

export const wellnessApi = {
  submitQuiz: (payload) => request(api.post("/api/analyze/quiz", payload)),
  getWeakestConcepts: (studentId, limit = 8) =>
    request(api.get(`/api/analyze/weakest-concepts/${studentId}`, { params: { limit } })),
};

export const explainApi = {
  explainMistake: (payload) => request(api.post("/api/explain/mistake", payload)),
};

export const adaptiveApi = {
  createSession: (payload) => request(api.post("/api/adaptive/session", payload)),
  getStatus: (studentId) => request(api.get(`/api/adaptive/status/${studentId}`)),
  getRecommendations: (studentId) => request(api.get(`/api/adaptive/recommendations/${studentId}`)),
};

export const analyticsApi = {
  getDashboard: (studentId) => request(api.get(`/api/analytics/dashboard/${studentId}`)),
  getFeedbackDistribution: (studentId) => request(api.get(`/api/analytics/feedback-distribution/${studentId}`)),
  getPerformanceOverTime: (studentId) => request(api.get(`/api/analytics/performance-over-time/${studentId}`)),
  getWeakestConcepts: (studentId, limit = 8) =>
    request(api.get(`/api/analytics/weakest-concepts/${studentId}`, { params: { limit } })),
  getWeaknessGraph: (studentId, limit = 8) =>
    request(api.get(`/api/analytics/weakest-concepts-graph/${studentId}`, { params: { limit } })),
  getSummary: (studentId) => request(api.get(`/api/analytics/summary/${studentId}`)),
};

export default api;
